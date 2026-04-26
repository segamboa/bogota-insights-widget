/**
 * Metrocuadrado HTML scraper (fallback cuando la API requiere auth).
 * Extrae datos del HTML server-side renderizado.
 */
import { upsertProperty } from '../../db/property-queries.js';
import type { PropertyType } from '../../db/types.js';

const METRO_WEB_URL = 'https://www.metrocuadrado.com';

// Rate limiting
const REQUEST_DELAY_MS = 2000;
let lastRequest = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS - elapsed));
  }
  lastRequest = Date.now();

  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
    },
  });
}

function mapPropertyType(mcType: string): PropertyType {
  const type = mcType?.toLowerCase() || '';
  if (type.includes('apartamento')) return 'apartamento';
  if (type.includes('casa')) return 'casa';
  if (type.includes('oficina')) return 'oficina';
  if (type.includes('local') || type.includes('consultorio')) return 'local';
  if (type.includes('bodega')) return 'bodega';
  if (type.includes('lote') || type.includes('terreno')) return 'lote';
  if (type.includes('finca')) return 'finca';
  return 'otro';
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr
    .replace(/[^\d]/g, '')
    .trim();
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

function parseArea(areaStr: string): number | undefined {
  if (!areaStr) return undefined;
  const cleaned = areaStr.replace(/[^\d.,]/g, '').replace(/,/, '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Extract JSON-LD data from HTML.
 */
function extractJsonLd(html: string): any[] {
  const properties: any[] = [];
  
  // Match JSON-LD scripts
  const regex = /<script type="application\/ld\+json"[^\u003e]*>([\s\S]*?)\u003c\/script>/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      
      // Look for RealEstateListing or Product types
      if (data['@type'] === 'RealEstateListing' || data['@type'] === 'Product') {
        properties.push(data);
      }
      
      // Also check for arrays
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item?.['@type'] === 'RealEstateListing' || item?.['@type'] === 'Product') {
            properties.push(item);
          }
        }
      }
    } catch {
      // Skip invalid JSON
    }
  }
  
  return properties;
}

/**
 * Extract data from meta tags and HTML structure.
 */
function extractFromHtml(html: string, url: string): any | null {
  // Try to find property data in window.__INITIAL_STATE__ or similar
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});/);
  if (stateMatch) {
    try {
      const state = JSON.parse(stateMatch[1]);
      if (state.listing?.data || state.property?.data) {
        return state.listing?.data || state.property?.data;
      }
    } catch {
      // Continue to next method
    }
  }

  // Try window.__DATA__
  const dataMatch = html.match(/window\.__DATA__\s*=\s*({.+?});/);
  if (dataMatch) {
    try {
      return JSON.parse(dataMatch[1]);
    } catch {
      // Continue
    }
  }

  // Extract from meta tags
  const metas: Record<string, string> = {};
  const metaRegex = /<meta[^\u003e]*(?:property|name)="([^"]+)"[^\u003e]*content="([^"]*)"[^\u003e]*>/gi;
  let metaMatch;
  while ((metaMatch = metaRegex.exec(html)) !== null) {
    metas[metaMatch[1]] = metaMatch[2];
  }

  // Check for Open Graph data
  if (metas['og:title'] || metas['description']) {
    return {
      title: metas['og:title'] || metas['title'],
      description: metas['description'] || metas['og:description'],
      url: metas['og:url'] || url,
    };
  }

  return null;
}

/**
 * Search and extract listings from a search results page.
 */
export async function searchMetrocuadradoHtml(
  options: {
    businessType?: string;
    propertyType?: string;
    city?: string;
    page?: number;
  } = {}
): Promise<{
  listings: any[];
  hasMore: boolean;
}> {
  const {
    businessType = 'venta',
    propertyType = 'apartamento',
    city = 'bogota',
    page = 1,
  } = options;

  const url = `${METRO_WEB_URL}/inmuebles/${businessType}/${propertyType}/${city}/${page > 1 ? `?page=${page}` : ''}`;
  
  console.log(`  Fetching HTML: ${url}`);
  
  const response = await rateLimitedFetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  
  // Extract JSON-LD data
  const jsonLdData = extractJsonLd(html);
  
  // Extract from page state
  const pageData = extractFromHtml(html, url);
  
  // Try to find listing cards in HTML
  const listings: any[] = [];
  
  // Look for data attributes in listing cards
  const cardRegex = /<div[^\u003e]*data-property-id="([^"]+)"[^\u003e]*>/gi;
  let cardMatch;
  const propertyIds: string[] = [];
  
  while ((cardMatch = cardRegex.exec(html)) !== null) {
    propertyIds.push(cardMatch[1]);
  }
  
  // If we found IDs, try to get details for each
  if (propertyIds.length > 0) {
    console.log(`  Found ${propertyIds.length} property IDs in HTML`);
    
    for (const id of propertyIds.slice(0, 10)) { // Limit for now
      try {
        const detail = await getPropertyDetailsHtml(id);
        if (detail) {
          listings.push(detail);
        }
      } catch (err) {
        console.warn(`  Failed to get details for ${id}:`, err);
      }
    }
  }
  
  // Also try JSON-LD data
  if (jsonLdData.length > 0) {
    console.log(`  Found ${jsonLdData.length} JSON-LD listings`);
    listings.push(...jsonLdData);
  }
  
  // Check for next page
  const hasMore = html.includes('pagination') && 
    (html.includes('next') || html.includes('siguiente') || html.includes(`page=${page + 1}`));

  return { listings, hasMore };
}

/**
 * Get property details from HTML page.
 */
export async function getPropertyDetailsHtml(propertyId: string): Promise<any | null> {
  const url = `${METRO_WEB_URL}/inmueble/${propertyId}`;
  
  try {
    const response = await rateLimitedFetch(url);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Extract JSON-LD
    const jsonLd = extractJsonLd(html);
    if (jsonLd.length > 0) {
      return {
        ...jsonLd[0],
        sourceId: propertyId,
        sourceUrl: url,
      };
    }
    
    // Extract from page state
    const pageData = extractFromHtml(html, url);
    if (pageData) {
      return {
        ...pageData,
        sourceId: propertyId,
        sourceUrl: url,
      };
    }

    return null;
  } catch (err) {
    console.warn(`  Error fetching ${url}:`, err);
    return null;
  }
}

/**
 * Transform extracted data to our format.
 */
function transformListing(item: any): {
  success: boolean;
  data?: any;
  error?: string;
} {
  try {
    const sourceId = item.sourceId || item.id || item.sku || item.identifier;
    if (!sourceId) {
      return { success: false, error: 'No source ID' };
    }

    // Price - try various fields
    const price = parsePrice(
      item.price || 
      item.offers?.price || 
      item.priceSpecification?.price || 
      ''
    );
    if (!price) {
      return { success: false, error: 'No price found' };
    }

    // Property type
    const propertyType = mapPropertyType(
      item.propertyType || item.type || ''
    );

    // Location
    const lat = item.latitude || item.geo?.latitude;
    const lng = item.longitude || item.geo?.longitude;

    // Address
    const address = item.address || item.location || '';
    const neighborhood = item.neighborhood || item.areaServed || '';

    // Features
    const builtArea = parseArea(item.floorSize?.value || item.builtArea);
    const rooms = parseInt(item.numberOfRooms) || undefined;
    const bathrooms = parseInt(item.numberOfBathroomsTotal) || undefined;

    return {
      success: true,
      data: {
        sourceId: sourceId.toString(),
        sourceUrl: item.sourceUrl || item.url,
        propertyType,
        businessType: 'venta',
        lat,
        lng,
        address,
        neighborhood,
        city: 'Bogotá',
        builtAreaM2: builtArea,
        rooms,
        bathrooms,
        priceCop: price,
        title: item.name || item.title,
        description: item.description,
        sourceRawData: item,
      }
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Ingest using HTML scraping.
 */
export async function ingestMetrocuadradoHtml(options: {
  businessType?: string;
  propertyTypes?: string[];
  maxPages?: number;
} = {}): Promise<{
  totalFetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const {
    businessType = 'venta',
    propertyTypes = ['apartamento'],
    maxPages = 3,
  } = options;

  const result = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  console.log(`=== Metrocuadrado HTML Scraper ===`);

  for (const propertyType of propertyTypes) {
    console.log(`\n--- Scraping ${propertyType} ---`);
    
    for (let page = 1; page <= maxPages; page++) {
      try {
        const { listings, hasMore } = await searchMetrocuadradoHtml({
          businessType,
          propertyType,
          page,
        });

        console.log(`  Page ${page}: ${listings.length} listings found`);

        for (const item of listings) {
          result.totalFetched++;
          
          const transform = transformListing(item);
          if (!transform.success) {
            result.skipped++;
            continue;
          }

          const data = transform.data;
          
          // Skip if no coordinates
          if (!data.lat || !data.lng) {
            result.skipped++;
            continue;
          }

          try {
            const upsert = await upsertProperty('metrocuadrado', data.sourceId, {
              sourceUrl: data.sourceUrl,
              propertyType: data.propertyType,
              businessType: data.businessType,
              lat: data.lat,
              lng: data.lng,
              address: data.address,
              neighborhood: data.neighborhood,
              city: data.city,
              builtAreaM2: data.builtAreaM2,
              rooms: data.rooms,
              bathrooms: data.bathrooms,
              priceCop: data.priceCop,
              title: data.title,
              description: data.description,
              sourceRawData: data.sourceRawData,
            });

            if (upsert.isNew) {
              result.created++;
            } else {
              result.updated++;
            }
          } catch (err) {
            result.errors++;
          }
        }

        if (!hasMore) {
          console.log(`  No more pages for ${propertyType}`);
          break;
        }

      } catch (err) {
        console.error(`  Page ${page} error:`, err);
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fetched: ${result.totalFetched}`);
  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);

  return result;
}

// Direct run
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestMetrocuadradoHtml({
    maxPages: 2,
  }).then((result) => {
    console.log('Done:', result);
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
  });
}
