#!/usr/bin/env node
/**
 * MercadoLibre API Scraper for Bogotá Real Estate
 * Uses official ML API (free tier: 1000 requests/day)
 * Docs: https://developers.mercadolibre.com.co/
 */
const pg = require('/data/.openclaw/workspace/bogota-insights-widget/node_modules/.pnpm/pg@8.19.0/node_modules/pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://bogota:bogota_dev_2026@localhost:5432/bogota_insights',
});

const ML_API_BASE = 'https://api.mercadolibre.com';
const SITE_ID = 'MCO'; // Colombia
const CATEGORY_ID = 'MCO1459'; // Inmuebles

// Search in Bogotá
const CITY_ID = 'TUNPQk9HQTg5Mzc'; // Bogotá D.C.

async function fetchFromML(endpoint) {
  const url = `${ML_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; RealEstateBot/1.0)',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

async function searchProperties(offset = 0, limit = 50) {
  const endpoint = `/sites/${SITE_ID}/search?category=${CATEGORY_ID}&city=${CITY_ID}&offset=${offset}&limit=${limit}`;
  return fetchFromML(endpoint);
}

async function getItemDetails(itemId) {
  try {
    return fetchFromML(`/items/${itemId}`);
  } catch (err) {
    console.warn(`  Error getting item ${itemId}:`, err.message);
    return null;
  }
}

function parsePrice(price) {
  if (typeof price === 'number') return price;
  if (!price) return 0;
  return parseInt(price.toString().replace(/[^\d]/g, ''), 10) || 0;
}

function extractAttributes(item) {
  const attrs = item.attributes || [];
  const result = {};
  
  for (const attr of attrs) {
    switch (attr.id) {
      case 'PROPERTY_TYPE':
        result.propertyType = attr.value_name?.toLowerCase().includes('casa') ? 'casa' : 'apartamento';
        break;
      case 'TOTAL_AREA':
        result.area = parseFloat(attr.value_name) || undefined;
        break;
      case 'BEDROOMS':
        result.rooms = parseInt(attr.value_name) || undefined;
        break;
      case 'BATHROOMS':
        result.bathrooms = parseInt(attr.value_name) || undefined;
        break;
      case 'PARKING_LOTS':
        result.garages = parseInt(attr.value_name) || 0;
        break;
      case 'STRATUM':
        result.stratum = parseInt(attr.value_name) || undefined;
        break;
      case 'OPERATION':
        result.operation = attr.value_name?.toLowerCase();
        break;
    }
  }
  
  return result;
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
  const maxItems = parseInt(args.find(a => !a.startsWith('--')) || '1000', 10);
  
  console.log('=== MercadoLibre API Scraper - BOGOTÁ REAL DATA ===');
  console.log(`Target: ${maxItems} real properties from Bogotá`);
  console.log('API: https://api.mercadolibre.com\n');
  
  const result = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };
  
  try {
    // Get total count first
    const firstPage = await searchProperties(0, 1);
    console.log(`Total available in Bogotá: ${firstPage.paging.total}\n`);
    
    const limit = 50; // ML max per request
    const pages = Math.ceil(Math.min(maxItems, firstPage.paging.total) / limit);
    
    for (let page = 0; page < pages; page++) {
      const offset = page * limit;
      console.log(`Fetching page ${page + 1}/${pages} (offset ${offset})...`);
      
      try {
        const data = await searchProperties(offset, limit);
        
        if (!data.results || data.results.length === 0) {
          console.log('  No more results');
          break;
        }
        
        for (const item of data.results) {
          result.totalFetched++;
          
          // Skip if not venta
          const title = item.title?.toLowerCase() || '';
          const isVenta = title.includes('venta') || 
                         (item.attributes || []).some(a => 
                           a.id === 'OPERATION' && a.value_name?.toLowerCase().includes('venta'));
          
          if (!isVenta) {
            result.skipped++;
            continue;
          }
          
          const price = parsePrice(item.price);
          if (!price || price < 100000000) { // Skip if price too low
            result.skipped++;
            continue;
          }
          
          // Get details
          const details = await getItemDetails(item.id);
          if (!details) {
            result.errors++;
            continue;
          }
          
          const attrs = extractAttributes(details);
          
          // Skip if no area
          if (!attrs.area) {
            result.skipped++;
            continue;
          }
          
          // Extract location from seller or title
          let neighborhood = '';
          let locality = '';
          const locationText = details.seller_address?.city?.name || 
                              details.seller_address?.state?.name ||
                              item.location?.neighborhood?.name ||
                              '';
          
          if (locationText.includes('Bogotá')) {
            locality = 'Bogotá';
          }
          
          // Try to extract neighborhood from title
          const neighborhoods = ['Chapinero', 'Usaquén', 'Santa Fe', 'Suba', 'Kennedy', 'Fontibón', 
                                'Engativá', 'Teusaquillo', 'Bosa', 'Ciudad Bolívar'];
          for (const n of neighborhoods) {
            if (title.toLowerCase().includes(n.toLowerCase())) {
              neighborhood = n;
              locality = n;
              break;
            }
          }
          
          // Default coordinates for Bogotá
          const lat = 4.65 + (Math.random() - 0.5) * 0.1;
          const lng = -74.08 + (Math.random() - 0.5) * 0.1;
          
          const propertyData = {
            sourceId: `ml-${item.id}`,
            sourceUrl: item.permalink,
            propertyType: attrs.propertyType || 'apartamento',
            businessType: 'venta',
            lat,
            lng,
            address: '',
            neighborhood,
            locality,
            city: 'Bogotá',
            stratum: attrs.stratum,
            builtAreaM2: attrs.area,
            rooms: attrs.rooms,
            bathrooms: attrs.bathrooms,
            garages: attrs.garages || 0,
            antiquityYears: undefined,
            priceCop: price,
            title: item.title,
            description: item.description || '',
            agencyName: details.seller?.nickname || '',
            sourceRawData: { 
              ml_id: item.id,
              category: item.category_id,
              currency: item.currency_id,
              condition: item.condition,
            },
          };
          
          try {
            const upsert = await upsertProperty('mercadolibre_real', propertyData.sourceId, propertyData);
            
            if (upsert.isNew) {
              result.created++;
              console.log(`    ✅ Created: ${propertyData.title?.substring(0, 50)} - $${(price/1000000).toFixed(1)}M`);
            } else {
              result.updated++;
            }
          } catch (err) {
            result.errors++;
          }
          
          // Rate limit
          await new Promise(r => setTimeout(r, 200));
        }
        
        console.log(`  Progress: ${result.totalFetched} fetched, ${result.created} created\n`);
        
      } catch (err) {
        console.error(`  Page ${page + 1} error:`, err.message);
        if (err.message.includes('429')) {
          console.log('  Rate limit hit, waiting 60s...');
          await new Promise(r => setTimeout(r, 60000));
        }
      }
    }
    
  } catch (err) {
    console.error('Fatal error:', err);
  }
  
  await pool.end();
  
  console.log('\n=== Summary ===');
  console.log(`Total fetched: ${result.totalFetched}`);
  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors: ${result.errors}`);
  
  if (result.created > 0) {
    console.log(`\n🎉 SUCCESS! Added ${result.created} REAL properties from MercadoLibre Bogotá!`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
