#!/usr/bin/env node
/**
 * Metrocuadrado API scraper.
 * Uses their internal API endpoints.
 */
const pg = require('/data/.openclaw/workspace/bogota-insights-widget/node_modules/.pnpm/pg@8.19.0/node_modules/pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://bogota:bogota_dev_2026@localhost:5432/bogota_insights',
});

const API_BASE = 'https://www.metrocuadrado.com/rest-search';

async function fetchFromApi(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'es-CO',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

async function searchProperties(options = {}) {
  const {
    businessType = 'venta',
    propertyType = 'apartamento',
    city = 'bogota',
    from = 0,
    size = 20
  } = options;
  
  const params = new URLSearchParams({
    realEstateBusinessList: businessType,
    propertyTypeList: propertyType,
    city: city,
    from: from.toString(),
    size: size.toString()
  });
  
  const data = await fetchFromApi(`/search?${params.toString()}`);
  return data.results || data.hits || data;
}

async function getPropertyDetail(propertyId) {
  try {
    const data = await fetchFromApi(`/detail/${propertyId}`);
    return data;
  } catch (err) {
    console.warn(`  Failed to get detail for ${propertyId}:`, err.message);
    return null;
  }
}

function mapPropertyType(mcType) {
  const type = (mcType || '').toLowerCase();
  if (type.includes('apartamento')) return 'apartamento';
  if (type.includes('casa')) return 'casa';
  if (type.includes('oficina')) return 'oficina';
  if (type.includes('local')) return 'local';
  if (type.includes('bodega')) return 'bodega';
  if (type.includes('lote')) return 'lote';
  return 'otro';
}

function parsePrice(price) {
  if (typeof price === 'number') return price;
  if (!price) return 0;
  return parseInt(price.toString().replace(/[^\d]/g, ''), 10) || 0;
}

async function upsertProperty(source, sourceId, data) {
  const pricePerM2 = data.builtAreaM2 && data.builtAreaM2 > 0
    ? Math.round(data.priceCop / data.builtAreaM2)
    : null;

  const result = await pool.query(
    `INSERT INTO properties (
      source, source_id, source_url, property_type, business_type,
      location, address, neighborhood, locality, city, stratum,
      built_area_m2, rooms, bathrooms, garages, antiquity_years,
      price_cop, price_per_m2, admin_fee_cop,
      title, description, agency_name, features,
      source_raw_data, scraped_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      ST_MakePoint($6, $7)::geography, $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17,
      $18, $19, $20,
      $21, $22, $23, $24,
      $25, NOW()
    )
    ON CONFLICT (source, source_id)
    DO UPDATE SET
      source_url = EXCLUDED.source_url,
      property_type = EXCLUDED.property_type,
      business_type = EXCLUDED.business_type,
      location = EXCLUDED.location,
      address = EXCLUDED.address,
      neighborhood = EXCLUDED.neighborhood,
      locality = EXCLUDED.locality,
      stratum = EXCLUDED.stratum,
      built_area_m2 = EXCLUDED.built_area_m2,
      rooms = EXCLUDED.rooms,
      bathrooms = EXCLUDED.bathrooms,
      garages = EXCLUDED.garages,
      antiquity_years = EXCLUDED.antiquity_years,
      price_cop = EXCLUDED.price_cop,
      price_per_m2 = EXCLUDED.price_per_m2,
      admin_fee_cop = EXCLUDED.admin_fee_cop,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      agency_name = EXCLUDED.agency_name,
      features = EXCLUDED.features,
      source_raw_data = EXCLUDED.source_raw_data,
      scraped_at = NOW()
    RETURNING id, (xmax = 0) AS is_new`,
    [
      source, sourceId, data.sourceUrl, data.propertyType, data.businessType,
      data.lng, data.lat, data.address, data.neighborhood, data.locality, 
      data.city || 'Bogotá', data.stratum,
      data.builtAreaM2, data.rooms, data.bathrooms, data.garages, data.antiquityYears,
      data.priceCop, pricePerM2, data.adminFeeCop,
      data.title, data.description, data.agencyName, data.features || [],
      data.sourceRawData ? JSON.stringify(data.sourceRawData) : null,
    ]
  );

  return {
    id: result.rows[0].id,
    isNew: result.rows[0].is_new,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const maxResults = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '100', 10);
  const batchSize = 20;

  console.log('=== Metrocuadrado API Scraper ===');
  console.log(`Max results: ${maxResults}\n`);

  const result = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    for (let offset = 0; offset < maxResults; offset += batchSize) {
      const currentBatch = Math.min(batchSize, maxResults - offset);
      console.log(`Fetching batch ${offset}-${offset + currentBatch}...`);
      
      const listings = await searchProperties({
        from: offset,
        size: currentBatch
      });
      
      if (!Array.isArray(listings) || listings.length === 0) {
        console.log('No more results');
        break;
      }
      
      console.log(`  Got ${listings.length} listings`);

      for (const item of listings) {
        result.totalFetched++;
        
        const propertyId = item.id || item.codigoInmueble || item.propertyId;
        if (!propertyId) {
          result.skipped++;
          continue;
        }

        // Get full details
        const detail = await getPropertyDetail(propertyId);
        if (!detail) {
          result.errors++;
          continue;
        }

        const data = detail.data || detail;
        
        const price = parsePrice(data.salePrice || data.precioVenta || data.price);
        if (!price) {
          result.skipped++;
          continue;
        }

        const coords = data.coordinates || data.geoPoint || {};
        const lat = coords.lat || data.latitude;
        const lng = coords.lon || coords.lng || data.longitude;

        if (!lat || !lng) {
          result.skipped++;
          continue;
        }

        const propertyData = {
          sourceId: propertyId.toString(),
          sourceUrl: `https://www.metrocuadrado.com/inmueble/${data.detail?.urlDetail || propertyId}`,
          propertyType: mapPropertyType(data.propertyType?.nombre || data.tipoInmueble),
          businessType: 'venta',
          lat,
          lng,
          address: data.companyAddress || data.direccion || '',
          neighborhood: data.commonNeighborhood || data.barrio || '',
          locality: data.zone?.nombre || data.localidad || '',
          city: data.city?.nombre || 'Bogotá',
          stratum: data.stratum ? parseInt(data.stratum, 10) : undefined,
          builtAreaM2: data.areac || data.areaConstruida,
          rooms: data.rooms || data.habitaciones,
          bathrooms: data.bathrooms || data.banos,
          garages: data.garages || data.garaje,
          antiquityYears: data.antiquity || data.antiguedad,
          priceCop: price,
          adminFeeCop: data.adminPrice || data.administracion,
          title: data.title || data.titulo || '',
          description: data.comment || data.descripcion || '',
          agencyName: data.companyName || data.empresa || '',
          features: [],
          sourceRawData: data,
        };

        try {
          const upsert = await upsertProperty('metrocuadrado', propertyData.sourceId, propertyData);

          if (upsert.isNew) {
            result.created++;
            console.log(`    ✅ Created: ${propertyData.neighborhood} - $${(propertyData.priceCop/1000000).toFixed(1)}M`);
          } else {
            result.updated++;
          }
        } catch (err) {
          result.errors++;
          console.error(`    ❌ DB error:`, err.message);
        }

        // Rate limiting
        await new Promise(r => setTimeout(r, 500));
      }
    }

  } catch (err) {
    console.error('Fatal error:', err);
  }

  await pool.end();

  console.log(`\n=== Summary ===`);
  console.log(`Total fetched: ${result.totalFetched}`);
  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors: ${result.errors}`);
  
  if (result.created > 0) {
    console.log(`\n🎉 SUCCESS! Scraped ${result.created} real properties!`);
  }
}

main();
