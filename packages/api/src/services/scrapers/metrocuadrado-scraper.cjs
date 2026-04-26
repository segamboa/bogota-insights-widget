#!/usr/bin/env node
/**
 * Metrocuadrado scraper using Playwright - Working version.
 * Extracts real property data from Metrocuadrado listings.
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

async function scrapePropertyDetail(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Extract data from the page's __NEXT_DATA__ or window data
    const propertyData = await page.evaluate(() => {
      // Try to find data in Next.js data
      const nextData = window.__NEXT_DATA__;
      if (nextData?.props?.pageProps?.data) {
        return nextData.props.pageProps.data;
      }
      
      // Try to find in any global data
      const win = window;
      return win.__INITIAL_STATE__ || win.__DATA__ || null;
    });

    if (!propertyData) {
      console.log('    No property data found in page');
      return null;
    }

    // The data structure from Metrocuadrado
    const data = propertyData;
    
    // Extract key fields
    const sourceId = data.propertyId || data.id;
    if (!sourceId) {
      console.log('    No property ID found');
      return null;
    }

    const price = data.salePrice || data.price;
    if (!price || price === 0) {
      console.log('    No price found');
      return null;
    }

    const coords = data.coordinates || {};
    const lat = coords.lat || data.lat;
    const lng = coords.lon || coords.lng || data.lng || data.lon;

    if (!lat || !lng) {
      console.log('    No coordinates found');
      return null;
    }

    // Extract neighborhood and locality from zone/sector
    const neighborhood = data.commonNeighborhood || data.neighborhood || '';
    const locality = data.zone?.nombre || data.locality || '';
    const sector = data.sector?.nombre || '';

    return {
      sourceId: sourceId.toString(),
      sourceUrl: url.split('?')[0], // Remove query params
      propertyType: mapPropertyType(data.propertyType?.nombre || 'apartamento'),
      businessType: data.businessType === 'arriendo' ? 'arriendo' : 'venta',
      lat,
      lng,
      address: data.companyAddress || '',
      neighborhood,
      locality,
      city: data.city?.nombre || 'Bogotá',
      stratum: data.stratum ? parseInt(data.stratum, 10) : undefined,
      builtAreaM2: data.areac || data.area,
      rooms: data.rooms ? parseInt(data.rooms, 10) : undefined,
      bathrooms: data.bathrooms ? parseInt(data.bathrooms, 10) : undefined,
      garages: data.garages ? parseInt(data.garages, 10) : undefined,
      antiquityYears: data.builtTime?.match(/(\d+)/)?.[1] 
        ? parseInt(data.builtTime.match(/(\d+)/)[1], 10)
        : data.builtTime?.toLowerCase().includes('más de 20') ? 25 : undefined,
      priceCop: price,
      adminFeeCop: data.adminPrice || data.detail?.adminPrice,
      title: data.title || '',
      description: data.comment || '',
      agencyName: data.companyName || '',
      features: data.featured ? data.featured.flatMap(f => f.items || []) : [],
      sourceRawData: data,
    };

  } catch (err) {
    console.warn(`  Failed to scrape ${url}:`, err.message);
    return null;
  }
}

async function scrapeSearchPage(page, propertyType = 'apartamento', pageNum = 1) {
  const url = `${METRO_WEB_URL}/inmuebles/venta/${propertyType}/bogota/${pageNum > 1 ? `?page=${pageNum}` : ''}`;
  
  console.log(`  Navigating: ${url}`);
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Extract property URLs from the page
  const propertyUrls = await page.evaluate(() => {
    const urls = [];
    const seen = new Set();
    const links = document.querySelectorAll('a[href*="/inmueble/"]');
    
    for (const link of links) {
      const href = link.href;
      // Get full URL with ID
      const match = href.match(/(https:\/\/www\.metrocuadrado\.com\/inmueble\/[^?]+)/);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        urls.push(match[1]);
      }
    }
    
    return urls;
  });
  
  console.log(`    Found ${propertyUrls.length} unique property URLs`);
  return propertyUrls;
}

async function main() {
  const args = process.argv.slice(2);
  const headless = !args.includes('--headed');
  const maxPages = parseInt(args.find(a => a.startsWith('--pages='))?.split('=')[1] || '5', 10);
  const maxProperties = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '500', 10);
  const batchSize = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '50', 10);

  console.log('=== Metrocuadrado Playwright Scraper ===');
  console.log(`Max pages: ${maxPages}, Max properties: ${maxProperties}, Batch: ${batchSize}`);
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
          const propertyUrls = await scrapeSearchPage(page, propertyType, pageNum);
          
          if (propertyUrls.length === 0) {
            console.log('  No properties found on this page');
            break;
          }

          console.log(`  Processing ${Math.min(propertyUrls.length, maxProperties - result.totalFetched)} properties...`);

          for (const url of propertyUrls) {
            if (result.totalFetched >= maxProperties) break;
            
            result.totalFetched++;
            const prop = await scrapePropertyDetail(page, url);
            
            if (!prop) {
              result.errors++;
              continue;
            }

            try {
              const upsert = await upsertProperty('metrocuadrado', prop.sourceId, prop);

              if (upsert.isNew) {
                result.created++;
                console.log(`    ✅ [${result.totalFetched}] Created: ${prop.neighborhood} - $${(prop.priceCop/1000000).toFixed(1)}M - ${prop.builtAreaM2}m²`);
              } else {
                result.updated++;
                console.log(`    🔄 [${result.totalFetched}] Updated: ${prop.sourceId}`);
              }
            } catch (err) {
              result.errors++;
              console.error(`    ❌ DB error:`, err.message);
            }

            // Rate limiting
            await page.waitForTimeout(1500);
          }

          // Check if we should continue
          if (propertyUrls.length < 10) {
            console.log('  Few properties found, likely last page');
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
