#!/usr/bin/env node
/**
 * Metrocuadrado scraper using Playwright - V2 (more robust selectors).
 */
const { chromium } = require('/skeleton/.npm-global/lib/node_modules/playwright');
const pg = require('/data/.openclaw/workspace/bogota-insights-widget/node_modules/.pnpm/pg@8.19.0/node_modules/pg');

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

async function extractFromSearchPage(page) {
  // Give time for React to render
  await page.waitForTimeout(5000);

  // Extract all links that contain /inmueble/
  const links = await page.evaluate(() => {
    const results = [];
    const allLinks = document.querySelectorAll('a');
    const seen = new Set();
    
    for (const link of allLinks) {
      const href = link.href;
      if (href && href.includes('/inmueble/')) {
        const match = href.match(/\/inmueble\/([^/?#]+)/);
        if (match && !seen.has(match[1])) {
          seen.add(match[1]);
          results.push({
            id: match[1],
            href: href,
            text: link.textContent?.trim().substring(0, 100),
          });
        }
      }
    }
    return results;
  });

  return links;
}

async function scrapePropertyDetail(page, propertyId) {
  const url = `${METRO_WEB_URL}/inmueble/${propertyId}`;
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Debug: save HTML to file
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync(`/tmp/metro-${propertyId}.html`, html);
    console.log(`    Saved HTML to /tmp/metro-${propertyId}.html`);
    
    // Also save text content
    const textContent = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(`/tmp/metro-${propertyId}.txt`, textContent.substring(0, 5000));
    console.log(`    Saved text content to /tmp/metro-${propertyId}.txt`);
    
    // Extract all data from page
    const pageData = await page.evaluate(() => {
      const data = {
        title: '',
        price: '',
        area: '',
        rooms: '',
        bathrooms: '',
        garages: '',
        address: '',
        neighborhood: '',
        stratum: '',
        antiquity: '',
        description: '',
        agency: '',
        lat: null,
        lng: null,
      };

      // Title - try multiple selectors
      const titleSelectors = ['h1', '[data-testid="property-title"]', '.property-title', 'h1.sc-jEACwC', '.sc-fqkvVR'];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) {
          data.title = el.textContent.trim();
          break;
        }
      }

      // Price - look for various patterns
      const allText = document.body.innerText;
      
      // Pattern 1: $1.250.000.000 or $1250000000
      let priceMatch = allText.match(/\$\s*([\d.,]+(?:\s*\.\d+)?)\s*(?:millones?|millón)?/i);
      if (priceMatch) data.price = priceMatch[1].replace(/\./g, '').replace(',', '.');
      
      // Pattern 2: Precio: 1250000000
      if (!data.price) {
        priceMatch = allText.match(/(?:Precio|precio)[\s:]*([\d.,]+)/i);
        if (priceMatch) data.price = priceMatch[1].replace(/\./g, '').replace(',', '.');
      }
      
      // Pattern 3: Look for large numbers (prices are usually >100 million)
      if (!data.price) {
        const numbers = allText.match(/[\d.,]+/g);
        if (numbers) {
          for (const num of numbers) {
            const cleaned = num.replace(/\./g, '').replace(',', '');
            const val = parseInt(cleaned, 10);
            if (val > 100000000 && val < 10000000000) { // Between 100M and 10B
              data.price = cleaned;
              break;
            }
          }
        }
      }

      // Area - look for m² patterns
      const areaMatch = allText.match(/(\d+(?:[.,]\d+)?)\s*m[²2]/i) ||
                       allText.match(/(\d+(?:[.,]\d+)?)\s*(?:metros|m2|mt2)/i);
      if (areaMatch) data.area = areaMatch[1];

      // Rooms
      const roomsMatch = allText.match(/(\d+)\s*(?:habitaciones|hab|alcobas|cuartos)/i);
      if (roomsMatch) data.rooms = roomsMatch[1];

      // Bathrooms
      const bathsMatch = allText.match(/(\d+)\s*(?:baños|banos|baño)/i);
      if (bathsMatch) data.bathrooms = bathsMatch[1];

      // Garages
      const garageMatch = allText.match(/(\d+)\s*(?:garajes?|parqueaderos?)/i);
      if (garageMatch) data.garages = garageMatch[1];

      // Address - look for "dirección" or "ubicación"
      const addressMatch = allText.match(/(?:Direcci[oó]n|Ubicaci[oó]n)[\s:]*([^\n]+)/i);
      if (addressMatch) data.address = addressMatch[1].trim();

      // Neighborhood
      const neighMatch = allText.match(/(?:Barrio|Sector)[\s:]*([^\n,]+)/i);
      if (neighMatch) data.neighborhood = neighMatch[1].trim();

      // Stratum
      const stratumMatch = allText.match(/(?:Estrato)[\s:]*(\d)/i);
      if (stratumMatch) data.stratum = stratumMatch[1];

      // Antiquity
      const antMatch = allText.match(/(?:Antig[uü]edad)[\s:]*(\d+)/i);
      if (antMatch) data.antiquity = antMatch[1];

      // Agency
      const agencyMatch = allText.match(/(?:Inmobiliaria|Agencia)[\s:]*([^\n]+)/i);
      if (agencyMatch) data.agency = agencyMatch[1].trim();

      // Look for JSON-LD with coordinates
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const json = JSON.parse(script.textContent || '');
          if (json.geo?.latitude) data.lat = json.geo.latitude;
          if (json.geo?.longitude) data.lng = json.geo.longitude;
          if (json.latitude) data.lat = json.latitude;
          if (json.longitude) data.lng = json.longitude;
        } catch {}
      }

      // Look for window data
      const win = window;
      const stateData = win.__INITIAL_STATE__ || win.__DATA__ || win.__PROPERTY_DATA__;
      if (stateData) {
        const stateStr = JSON.stringify(stateData);
        const latMatch = stateStr.match(/"latitude":\s*(-?\d+\.?\d*)/);
        const lngMatch = stateStr.match(/"longitude":\s*(-?\d+\.?\d*)/);
        if (latMatch && !data.lat) data.lat = parseFloat(latMatch[1]);
        if (lngMatch && !data.lng) data.lng = parseFloat(lngMatch[1]);
        
        // Try to find price in state
        const priceStateMatch = stateStr.match(/"price"[:\s]*"?(\d+)"?/);
        if (priceStateMatch && !data.price) {
          data.price = priceStateMatch[1];
        }
      }

      return data;
    });

    // Parse data
    const price = parsePrice(pageData.price);
    if (!price) {
      console.log(`    No price found for ${propertyId}`);
      return null;
    }

    // Property type from title
    let propertyType = 'otro';
    if (pageData.title) {
      propertyType = mapPropertyType(pageData.title);
    }

    const builtArea = parseArea(pageData.area);
    const rooms = parseIntValue(pageData.rooms);
    const bathrooms = parseIntValue(pageData.bathrooms);
    const garages = parseIntValue(pageData.garages);
    const stratum = parseIntValue(pageData.stratum);
    const antiquity = parseIntValue(pageData.antiquity);

    return {
      sourceId: propertyId,
      sourceUrl: url,
      propertyType,
      businessType: 'venta',
      lat: pageData.lat,
      lng: pageData.lng,
      address: pageData.address,
      neighborhood: pageData.neighborhood,
      locality: null, // Will try to infer from neighborhood
      stratum,
      builtAreaM2: builtArea,
      rooms,
      bathrooms,
      garages,
      antiquityYears: antiquity,
      priceCop: price,
      title: pageData.title || 'Propiedad en venta',
      description: pageData.description,
      agencyName: pageData.agency,
      features: [],
      sourceRawData: pageData,
    };

  } catch (err) {
    console.warn(`  Failed to scrape ${propertyId}:`, err.message);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const headless = !args.includes('--headed');
  const maxPages = parseInt(args.find(a => a.startsWith('--pages='))?.split('=')[1] || '3', 10);
  const maxProperties = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '100', 10);

  console.log('=== Metrocuadrado Playwright Scraper V2 ===');
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
        const url = `${METRO_WEB_URL}/inmuebles/venta/${propertyType}/bogota/${pageNum > 1 ? `?page=${pageNum}` : ''}`;
        
        try {
          console.log(`  Page ${pageNum}: ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(5000); // Wait for JS to render
          
          const links = await extractFromSearchPage(page);
          console.log(`    Found ${links.length} property links`);

          for (const link of links.slice(0, 10)) {
            if (result.totalFetched >= maxProperties) break;
            
            console.log(`    Processing: ${link.id}`);
            const prop = await scrapePropertyDetail(page, link.id);
            
            if (!prop) {
              result.errors++;
              continue;
            }
            
            result.totalFetched++;

            // Skip if no coordinates
            if (!prop.lat || !prop.lng) {
              console.log(`      ⚠️ No coordinates, skipping`);
              result.skipped++;
              continue;
            }

            try {
              const upsert = await upsertProperty('metrocuadrado', prop.sourceId, prop);

              if (upsert.isNew) {
                result.created++;
                console.log(`      ✅ Created: ${prop.title?.substring(0, 40)} - $${(prop.priceCop/1000000).toFixed(1)}M`);
              } else {
                result.updated++;
                console.log(`      🔄 Updated: ${prop.sourceId}`);
              }
            } catch (err) {
              result.errors++;
              console.error(`      ❌ DB error:`, err.message);
            }

            await page.waitForTimeout(2000);
          }

          // Check for next page
          const hasMore = await page.evaluate(() => {
            return document.body.innerText.toLowerCase().includes('siguiente') ||
                   document.body.innerText.toLowerCase().includes('next') ||
                   !!document.querySelector('a[href*="page="]');
          });

          if (!hasMore) {
            console.log(`  No more pages`);
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
