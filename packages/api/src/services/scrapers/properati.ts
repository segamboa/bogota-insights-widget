/**
 * Properati property scraper.
 * Properati es más scraper-friendly y tiene estructura HTML más simple.
 */
import { upsertProperty } from '../../db/property-queries.js';
import type { PropertyType } from '../../db/types.js';

const PROPERATI_URL = 'https://www.properati.com.co';

const REQUEST_DELAY_MS = 1500;
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
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-CO,es;q=0.9',
    },
  });
}

function mapPropertyType(ptype: string): PropertyType {
  const type = ptype?.toLowerCase() || '';
  if (type.includes('apartamento')) return 'apartamento';
  if (type.includes('casa')) return 'casa';
  if (type.includes('oficina')) return 'oficina';
  if (type.includes('local')) return 'local';
  if (type.includes('bodega')) return 'bodega';
  if (type.includes('lote')) return 'lote';
  return 'otro';
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function parseArea(areaStr: string): number | undefined {
  if (!areaStr) return undefined;
  const cleaned = areaStr.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Search Properati listings.
 */
export async function searchProperati(
  options: {
    propertyType?: string;
    businessType?: string;
    location?: string;
    page?: number;
  } = {}
): Promise<{ listings: any[]; hasMore: boolean }> {
  const {
    propertyType = 'apartamentos',
    businessType = 'venta',
    location = 'bogota',
    page = 1,
  } = options;

  const url = `${PROPERATI_URL}/s/${location}/${businessType}/${propertyType}/${page > 1 ? `?page=${page}` : ''}`;
  
  console.log(`  Fetching: ${url}`);
  
  const response = await rateLimitedFetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  
  // Extract JSON-LD
  const listings: any[] = [];
  const regex = /<script type="application\/ld\+json"[^\u003e]*>([\s\S]*?)\u003c\/script>/gi;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      if (data['@type'] === 'SingleFamilyResidence' || data['@type'] === 'Apartment') {
        listings.push(data);
      }
    } catch {
      // Skip
    }
  }

  // Check for next page
  const hasMore = html.includes('pagination') && !html.includes('disabled');

  return { listings, hasMore };
}

/**
 * Ingest from Properati.
 */
export async function ingestProperati(options: {
  maxPages?: number;
} = {}): Promise<{
  totalFetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const { maxPages = 3 } = options;
  
  const result = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  console.log('=== Properati Scraper ===');

  for (let page = 1; page <= maxPages; page++) {
    try {
      const { listings, hasMore } = await searchProperati({ page });
      console.log(`  Page ${page}: ${listings.length} listings`);

      for (const item of listings) {
        result.totalFetched++;
        
        const price = parsePrice(item.price || '');
        if (!price) {
          result.skipped++;
          continue;
        }

        const propertyType = mapPropertyType(item['@type'] || '');
        
        // Properati usually has address structure
        const address = item.address;
        let neighborhood = '';
        let locality = '';
        
        if (typeof address === 'object') {
          neighborhood = address.addressLocality || '';
          locality = address.addressRegion || '';
        }

        const lat = item.geo?.latitude;
        const lng = item.geo?.longitude;

        if (!lat || !lng) {
          result.skipped++;
          continue;
        }

        try {
          const upsert = await upsertProperty('properati', item.identifier || item.url, {
            sourceUrl: item.url,
            propertyType,
            businessType: 'venta',
            lat,
            lng,
            address: typeof address === 'string' ? address : address?.streetAddress,
            neighborhood,
            locality,
            city: 'Bogotá',
            builtAreaM2: parseArea(item.floorSize?.value),
            rooms: item.numberOfRooms,
            bathrooms: item.numberOfBathroomsTotal,
            priceCop: price,
            title: item.name,
            description: item.description,
            sourceRawData: item,
          });

          if (upsert.isNew) result.created++;
          else result.updated++;
          
        } catch (err) {
          result.errors++;
        }
      }

      if (!hasMore) break;
      
    } catch (err) {
      console.error(`  Page ${page} error:`, err);
    }
  }

  console.log(`\nSummary: ${result.created} created, ${result.updated} updated`);
  return result;
}
