/**
 * Metrocuadrado property scraper.
 * Uses their public API endpoints.
 */
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { upsertProperty } from '../../db/property-queries.js';
import type { PropertyType } from '../../db/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../../data');

// Metrocuadrado API endpoints
const METRO_API_BASE = 'https://www.metrocuadrado.com/rest-search';
const METRO_WEB_URL = 'https://www.metrocuadrado.com';

// Rate limiting
const REQUEST_DELAY_MS = 1500; // 1.5 segundos entre requests
let lastRequest = 0;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < REQUEST_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS - elapsed));
  }
  lastRequest = Date.now();

  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Referer': 'https://www.metrocuadrado.com/',
      ...options?.headers,
    },
  });

  return response;
}

/**
 * Map Metrocuadrado property type to our enum.
 */
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

/**
 * Map business type (venta/arriendo).
 */
function mapBusinessType(mcBusiness: string): string {
  const business = mcBusiness?.toLowerCase() || '';
  if (business.includes('venta')) return 'venta';
  if (business.includes('arriendo')) return 'arriendo';
  if (business.includes('venta-arriendo') || business.includes('ventaarriendo')) return 'venta-arriendo';
  return 'venta';
}

/**
 * Parse price string to COP number.
 */
function parsePrice(priceStr: string | number): number {
  if (typeof priceStr === 'number') return Math.round(priceStr);
  if (!priceStr) return 0;
  
  // Remove non-numeric characters except decimal point
  const cleaned = priceStr.toString()
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')  // Remove thousand separators
    .replace(/,/, '.');  // Convert decimal comma to point
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

/**
 * Parse area string to number.
 */
function parseArea(areaStr: string | number): number | undefined {
  if (typeof areaStr === 'number') return areaStr;
  if (!areaStr) return undefined;
  
  const cleaned = areaStr.toString().replace(/[^\d.,]/g, '').replace(/,/, '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse integer from various formats.
 */
function parseIntValue(val: string | number | undefined): number | undefined {
  if (typeof val === 'number') return val;
  if (!val) return undefined;
  const parsed = parseInt(val.toString().replace(/\D/g, ''), 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Search properties using Metrocuadrado API.
 */
export async function searchMetrocuadrado(
  options: {
    businessType?: string; // 'venta', 'arriendo'
    propertyType?: string;
    city?: string;
    offset?: number;
    limit?: number;
  } = {}
): Promise<any[]> {
  const {
    businessType = 'venta',
    propertyType,
    city = 'bogota',
    offset = 0,
    limit = 50,
  } = options;

  // Build query URL
  const params = new URLSearchParams();
  params.append('realEstateBusinessList', businessType);
  params.append('city', city.toLowerCase());
  if (propertyType) {
    params.append('propertyTypeList', propertyType);
  }
  params.append('from', offset.toString());
  params.append('size', limit.toString());

  const url = `${METRO_API_BASE}/search?${params.toString()}`;
  
  console.log(`  Fetching: ${url}`);
  
  const response = await rateLimitedFetch(url);
  
  if (!response.ok) {
    throw new Error(`Metrocuadrado API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Handle different response formats
  if (Array.isArray(data)) {
    return data;
  }
  if (data.results) {
    return data.results;
  }
  if (data.hits) {
    return data.hits;
  }
  if (data.data) {
    return Array.isArray(data.data) ? data.data : [data.data];
  }
  
  return [];
}

/**
 * Get property details.
 */
export async function getPropertyDetails(propertyId: string): Promise<any | null> {
  try {
    const url = `${METRO_API_BASE}/detail/${propertyId}`;
    const response = await rateLimitedFetch(url);
    
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to fetch details: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.warn(`  Failed to get details for ${propertyId}:`, err);
    return null;
  }
}

/**
 * Transform Metrocuadrado listing to our format.
 */
function transformListing(item: any): {
  success: boolean;
  data?: any;
  error?: string;
} {
  try {
    // Try multiple possible ID fields
    const sourceId = item.id || item.codigoInmueble || item.propertyId || item.mcoId;
    if (!sourceId) {
      return { success: false, error: 'No source ID found' };
    }

    // Try multiple location formats
    let lat = item.latitude || item.lat || item.location?.lat;
    let lng = item.longitude || item.lng || item.lon || item.location?.lon;
    
    // Parse from geoPoint if available
    if (!lat || !lng) {
      const geoPoint = item.geoPoint || item.geolocation;
      if (geoPoint) {
        if (typeof geoPoint === 'string') {
          const [lon, latVal] = geoPoint.split(',').map(parseFloat);
          lng = lon;
          lat = latVal;
        } else if (Array.isArray(geoPoint)) {
          lng = geoPoint[0];
          lat = geoPoint[1];
        }
      }
    }

    // Price
    const price = parsePrice(
      item.price || item.precioVenta || item.precio || item.priceSale || item.valorVenta
    );
    if (!price || price === 0) {
      return { success: false, error: 'No price found' };
    }

    // Property type
    const propertyType = mapPropertyType(
      item.propertyType || item.tipoInmueble || item.tipoPropiedad || 'otro'
    );

    // Business type
    const businessType = mapBusinessType(
      item.businessType || item.tipoNegocio || item.realEstateBusiness || 'venta'
    );

    // Address components
    const neighborhood = item.neighborhood || item.barrio || item.sector || '';
    const locality = item.locality || item.localidad || item.cityArea || '';
    const address = item.address || item.direccion || item.fullAddress || '';

    // Features
    const builtArea = parseArea(item.builtArea || item.areaConstruida || item.metrosCuadrados);
    const landArea = parseArea(item.landArea || item.areaLote);
    const rooms = parseIntValue(item.rooms || item.habitaciones || item.numHabitaciones);
    const bathrooms = parseIntValue(item.bathrooms || item.banos || item.numBanos);
    const garages = parseIntValue(item.garages || item.garaje || item.numGarajes);
    const floor = parseIntValue(item.floor || item.piso);
    const antiquity = parseIntValue(item.antiquity || item.antiguedad);

    // Stratum
    let stratum: number | undefined;
    const stratumVal = item.stratum || item.estrato || item.estratoSocioeconomico;
    if (stratumVal) {
      const parsed = parseInt(stratumVal.toString().replace(/\D/g, ''), 10);
      if (parsed >= 1 && parsed <= 6) {
        stratum = parsed;
      }
    }

    // Title and description
    const title = item.title || item.titulo || item.propertyTitle || '';
    const description = item.description || item.descripcion || '';

    // Agency info
    const agencyName = item.agencyName || item.empresa || item.companyName || '';
    const contactPhone = item.contactPhone || item.telefono || item.phone || '';

    // Build URL
    const slug = item.slug || item.urlSlug || item.propertySlug || sourceId;
    const sourceUrl = `${METRO_WEB_URL}/inmueble/${slug}`;

    // Published date
    let publishedAt: Date | undefined;
    const pubDate = item.publishedAt || item.fechaPublicacion || item.createdAt;
    if (pubDate) {
      publishedAt = new Date(pubDate);
      if (isNaN(publishedAt.getTime())) publishedAt = undefined;
    }

    // Features array
    const features: string[] = [];
    if (item.features && Array.isArray(item.features)) {
      features.push(...item.features);
    }
    if (item.amenities && Array.isArray(item.amenities)) {
      features.push(...item.amenities);
    }
    if (item.caracteristicas && Array.isArray(item.caracteristicas)) {
      features.push(...item.caracteristicas);
    }

    // Admin fee
    const adminFee = parsePrice(item.adminFee || item.administration || item.valorAdministracion);

    return {
      success: true,
      data: {
        sourceId: sourceId.toString(),
        sourceUrl,
        propertyType,
        businessType,
        lat,
        lng,
        address,
        neighborhood,
        locality,
        city: 'Bogotá',
        stratum,
        builtAreaM2: builtArea,
        landAreaM2: landArea,
        rooms,
        bathrooms,
        garages,
        floor,
        antiquityYears: antiquity,
        priceCop: price,
        adminFeeCop: adminFee || undefined,
        features,
        title,
        description,
        agencyName,
        contactPhone,
        sourceRawData: item,
        publishedAt,
      }
    };
  } catch (err) {
    return { success: false, error: `Transform error: ${err}` };
  }
}

/**
 * Ingest properties from Metrocuadrado.
 */
export async function ingestMetrocuadrado(options: {
  businessType?: string;
  propertyTypes?: string[];
  maxResults?: number;
  includeNoCoords?: boolean;
} = {}): Promise<{
  totalFetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const {
    businessType = 'venta',
    propertyTypes = ['apartamento', 'casa', 'oficina'],
    maxResults = 1000,
    includeNoCoords = false,
  } = options;

  const result = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  console.log(`=== Metrocuadrado Scraper ===`);
  console.log(`Business: ${businessType}`);
  console.log(`Property types: ${propertyTypes.join(', ')}`);
  console.log(`Max results: ${maxResults}`);

  for (const propertyType of propertyTypes) {
    console.log(`\n--- Scraping ${propertyType} ---`);
    
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    let typeCount = 0;

    while (hasMore && result.totalFetched < maxResults) {
      try {
        const listings = await searchMetrocuadrado({
          businessType,
          propertyType,
          offset,
          limit,
        });

        if (!listings || listings.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`  Fetched ${listings.length} listings at offset ${offset}`);

        for (const item of listings) {
          result.totalFetched++;
          typeCount++;

          const transform = transformListing(item);
          
          if (!transform.success) {
            result.skipped++;
            if (result.skipped <= 5) {
              console.log(`    Skip: ${transform.error}`);
            }
            continue;
          }

          const data = transform.data;

          // Skip if no coordinates and we require them
          if (!data.lat || !data.lng) {
            if (!includeNoCoords) {
              result.skipped++;
              continue;
            }
            data.lat = 4.65; // Default Bogotá center
            data.lng = -74.08;
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
              locality: data.locality,
              city: data.city,
              stratum: data.stratum,
              builtAreaM2: data.builtAreaM2,
              landAreaM2: data.landAreaM2,
              rooms: data.rooms,
              bathrooms: data.bathrooms,
              garages: data.garages,
              floor: data.floor,
              antiquityYears: data.antiquityYears,
              priceCop: data.priceCop,
              adminFeeCop: data.adminFeeCop,
              features: data.features,
              title: data.title,
              description: data.description,
              agencyName: data.agencyName,
              contactPhone: data.contactPhone,
              sourceRawData: data.sourceRawData,
              publishedAt: data.publishedAt,
            });

            if (upsert.isNew) {
              result.created++;
            } else {
              result.updated++;
            }
          } catch (err) {
            result.errors++;
            if (result.errors <= 5) {
              console.error(`    DB error:`, err);
            }
          }
        }

        // Check if we've reached the end
        if (listings.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }

        // Progress every 100 items
        if (typeCount % 100 === 0) {
          console.log(`  Progress: ${typeCount} processed (${result.created} created, ${result.updated} updated)`);
        }

      } catch (err) {
        console.error(`  Fetch error at offset ${offset}:`, err);
        hasMore = false;
      }
    }

    console.log(`  Completed ${propertyType}: ${typeCount} listings`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total fetched: ${result.totalFetched}`);
  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors: ${result.errors}`);

  return result;
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestMetrocuadrado({
    businessType: 'venta',
    propertyTypes: ['apartamento'],
    maxResults: 100,
  }).then((result) => {
    console.log('\nDone:', result);
    process.exit(0);
  }).catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
