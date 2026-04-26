#!/usr/bin/env node
/**
 * Metrocuadrado scraper using Playwright (standalone version).
 * Run: node metrocuadrado-playwright-standalone.js
 */
const { chromium } = require('/skeleton/.npm-global/lib/node_modules/playwright');
const pg = require('/data/.openclaw/workspace/bogota-insights-widget/node_modules/.pnpm/pg@8.19.0/node_modules/pg');

// Database connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://bogota:bogota_dev_2026@localhost:5432/bogota_insights',
});

const METRO_WEB_URL = 'https://www.metrocuadrado.com';

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

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const cleaned = priceStr.toString().replace(/[^\d]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function parseArea(areaStr) {
  if (!areaStr) return undefined;
  const cleaned = areaStr.toString().replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : parsed;
}

function parseIntValue(val) {
  if (!val) return undefined;
  const parsed = parseInt(val.toString().replace(/\D/g, ''), 10);
  return isNaN(parsed) ? undefined : parsed;
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

async function scrapePropertyDetail(page, propertyId) {
  const url = `${METRO_WEB_URL}/inmueble/${propertyId}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Extract data from page
    const pageData = await page.evaluate(() => {
      const getText = (selectors) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return el.textContent?.trim();
        }
        return undefined;
      };

      // Look for JSON-LD
      let jsonLd = null;
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data['@type'] === 'RealEstateListing' || data['@type'] === 'Product' || 
              data['@type'] === 'SingleFamilyResidence' || data['@type'] === 'Apartment') {
            jsonLd = data;
            break;
          }
        } catch {}
      }

      // Window data
      const win = window;
      const stateData = win.__INITIAL_STATE__ || win.__DATA__ || win.__PROPERTY_DATA__;

      return {
        jsonLd,
        stateData,
        title: getText(['h1', '.property-title', '[data-testid="property-title"]', 'h1.sc-jEACwC']),
        price: getText(['.price', '[data-testid="price"]', '.property-price', '.sc-dcJsrY']),
        area: getText(['.area', '[data-testid="area"]', '.built-area', '[data-testid="built-area"]']),
        rooms: getText(['.rooms', '[data-testid="rooms"]', '[data-testid="room"]']),
        bathrooms: getText(['.bathrooms', '[data-testid="bathrooms"]', '[data-testid="bathroom"]']),
        garages: getText(['.garages', '[data-testid="garages"]', '[data-testid="garage"]']),
        address: getText(['.address', '[data-testid="address"]']),
        neighborhood: getText(['.neighborhood', '[data-testid="neighborhood"]', '.location']),
        stratum: getText(['.stratum', '[data-testid="stratum"]']),
        antiquity: getText(['.antiquity', '[data-testid="antiquity"]']),
        description: getText(['.description', '[data-testid="description"]']),
        agency: getText(['.agency-name', '[data-testid="agency"]']),
      };
    });

    const jsonLd = pageData.jsonLd || {};
    const data = pageData;

    // Parse price - try multiple sources
    let price = parsePrice(jsonLd.price?.toString() || jsonLd.offers?.price?.toString());
    if (!price) price = parsePrice(data.price);
    if (!price && data.stateData) {
      // Try to find price in state data
      const stateStr = JSON.stringify(data.stateData);
      const priceMatch = stateStr.match(/"price":\s*(\d+)/);
      if (priceMatch) price = parseInt(priceMatch[1], 10);
    }
    if (!price) return null;

    // Property type
    let propertyType = mapPropertyType(jsonLd['@type'] || '');
    if (propertyType === 'otro' && data.title) {
      if (data.title.toLowerCase().includes('apartamento')) propertyType = 'apartamento';
      else if (data.title.toLowerCase().includes('casa')) propertyType = 'casa';
    }

    // Location
    let lat = jsonLd.geo?.latitude || jsonLd.latitude;
    let lng = jsonLd.geo?.longitude || jsonLd.longitude;
    
    // Try to extract from state data
    if ((!lat || !lng) && data.stateData) {
      const stateStr = JSON.stringify(data.stateData);
      const latMatch = stateStr.match(/"latitude":\s*(-?\d+\.?\d*)/);
      const lngMatch = stateStr.match(/"longitude":\s*(-?\d+\.?\d*)/);
      if (latMatch) lat = parseFloat(latMatch[1]);
      if (lngMatch) lng = parseFloat(lngMatch[1]);
    }

    // Address
    const address = data.address || jsonLd.address?.streetAddress;
    let neighborhood = data.neighborhood || jsonLd.address?.addressLocality;
    
    // Try to extract neighborhood from address
    if (!neighborhood && address) {
      const parts = address.split(',');
      if (parts.length > 1) neighborhood = parts[parts.length - 2].trim();
    }

    // Extract locality from state or default
    let locality = jsonLd.address?.addressRegion;
    if (!locality && data.stateData) {
      const stateStr = JSON.stringify(data.stateData);
      const locMatch = stateStr.match(/"locality":\s*"([^"]+)"/i) || 
                       stateStr.match(/"localidad":\s*"([^"]+)"/i);
      if (locMatch) locality = locMatch[1];
    }

    // Features
    const builtArea = parseArea(jsonLd.floorSize?.value?.toString() || data.area);
    const rooms = parseIntValue(data.rooms) || parseIntValue(jsonLd.numberOfRooms);
    const bathrooms = parseIntValue(data.bathrooms) || parseIntValue(jsonLd.numberOfBathroomsTotal);
    const garages = parseIntValue(data.garages);
    const antiquity = parseIntValue(data.antiquity);
    const stratum = parseIntValue(data.stratum);

    return {
      sourceId: propertyId,
      sourceUrl: url,
      propertyType,
      businessType: 'venta',
      lat,
      lng,
      address,
      neighborhood,
      locality,
      stratum,
      builtAreaM2: builtArea,
      rooms,
      bathrooms,
      garages,
      antiquityYears: antiquity,
      priceCop: price,
      title: data.title || 'Propiedad en venta',
      description: data.description,
      agencyName: data.agency,
      features: [],
      sourceRawData: { jsonLd, stateData: data.stateData },
    };

  } catch (err) {
    console.warn(`  Failed to scrape ${propertyId}:`, err.message);
    return null;
  }
}

async function scrapeSearchPage(page, options) {
  const { propertyType = 'apartamento', pageNum = 1 } = options;
  
  const url = `${METRO_WEB_URL}/inmuebles/venta/${propertyType}/bogota/${pageNum > 1 ? `?page=${pageNum}` : ''}`;
  
  console.log(`  Navigating: ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Extract property IDs from page
  const propertyIds = await page.evaluate(() => {
    const ids = [];
    const seen = new Set();
    
    // Try multiple selectors
    const selectors = [
      '[data-property-id]',
      '[data-id]',
      'a[href*="/inmueble/"]',
      '.listing-card a',
      '.property-card a',
      'article a',
    ];
    
    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      for (const el of elements) {
        // Try data attribute
        const id = el.getAttribute('data-property-id') || el.getAttribute('data-id');
        if (id && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
          continue;
        }
        
        // Try href
        const href = el.getAttribute('href');
        if (href) {
          const match = href.match(/\/inmueble\/([^/?]+)/);
          if (match && !seen.has(match[1])) {
            seen.add(match[1]);
            ids.push(match[1]);
          }
        }
      }
    }
    
    return ids.slice(0, 12); // Limit per page
  });
  
  console.log(`    Found ${propertyIds.length} property IDs`);

  const properties = [];
  for (const id of propertyIds) {
    const prop = await scrapePropertyDetail(page, id);
    if (prop) properties.push(prop);
    await page.waitForTimeout(1500); // Rate limit
  }

  // Check for next page
  const hasMore = await page.evaluate(() => {
    return !!document.querySelector('a[href*="page="], .pagination a, [data-testid="pagination-next"]');
  });

  return { properties, hasMore };
}

async function main() {
  const args = process.argv.slice(2);
  const headless = !args.includes('--headed');
  const maxPages = parseInt(args.find(a => a.startsWith('--pages='))?.split('=')[1] || '3', 10);
  const maxProperties = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '100', 10);

  console.log('=== Metrocuadrado Playwright Scraper ===');
  console.log(`Max pages: ${maxPages}, Max properties: ${maxProperties}`);
  console.log(`Headless: ${headless}\n`);

  let browser;
  const result = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
    
    const page = await context.newPage();

    for (const propertyType of ['apartamento']) {
      console.log(`\n--- Scraping ${propertyType} ---`);
      
      for (let pageNum = 1; pageNum <= maxPages && result.totalFetched < maxProperties; pageNum++) {
        try {
          const { properties, hasMore } = await scrapeSearchPage(page, {
            propertyType,
            pageNum,
          });

          console.log(`  Page ${pageNum}: ${properties.length} properties scraped`);

          for (const prop of properties) {
            if (result.totalFetched >= maxProperties) break;
            result.totalFetched++;

            // Skip if no coordinates
            if (!prop.lat || !prop.lng) {
              console.log(`    Skipping ${prop.sourceId}: no coordinates`);
              result.skipped++;
              continue;
            }

            try {
              const upsert = await upsertProperty('metrocuadrado', prop.sourceId, prop);

              if (upsert.isNew) {
                result.created++;
                console.log(`    ✅ Created: ${prop.title?.substring(0, 50)} - $${(prop.priceCop/1000000).toFixed(1)}M`);
              } else {
                result.updated++;
              }
            } catch (err) {
              result.errors++;
              console.error(`    ❌ DB error:`, err.message);
            }
          }

          if (!hasMore) {
            console.log(`  No more pages for ${propertyType}`);
            break;
          }

          await page.waitForTimeout(3000);

        } catch (err) {
          console.error(`  Page ${pageNum} error:`, err.message);
        }
      }
    }

  } finally {
    if (browser) await browser.close();
    await pool.end();
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total fetched: ${result.totalFetched}`);
  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors: ${result.errors}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
