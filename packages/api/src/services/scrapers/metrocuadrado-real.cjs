#!/usr/bin/env node
/**
 * Metrocuadrado scraper - Scroll to load more properties.
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

    // Extract data from the page's __NEXT_DATA__
    const propertyData = await page.evaluate(() => {
      const nextData = window.__NEXT_DATA__;
      if (nextData?.props?.pageProps?.data) {
        return nextData.props.pageProps.data;
      }
      return null;
    });

    if (!propertyData) {
      return null;
    }

    const data = propertyData;
    const sourceId = data.propertyId || data.id;
    if (!sourceId) return null;

    const price = data.salePrice || data.price;
    if (!price || price === 0) return null;

    const coords = data.coordinates || {};
    const lat = coords.lat;
    const lng = coords.lon || coords.lng;

    if (!lat || !lng) return null;

    return {
      sourceId: sourceId.toString(),
      sourceUrl: url.split('?')[0],
      propertyType: mapPropertyType(data.propertyType?.nombre || 'apartamento'),
      businessType: data.businessType === 'arriendo' ? 'arriendo' : 'venta',
      lat,
      lng,
      address: data.companyAddress || '',
      neighborhood: data.commonNeighborhood || data.neighborhood || '',
      locality: data.zone?.nombre || '',
      city: data.city?.nombre || 'Bogotá',
      stratum: data.stratum ? parseInt(data.stratum, 10) : undefined,
      builtAreaM2: data.areac || data.area,
      rooms: data.rooms ? parseInt(data.rooms, 10) : undefined,
      bathrooms: data.bathrooms ? parseInt(data.bathrooms, 10) : undefined,
      garages: data.garages ? parseInt(data.garages, 10) : undefined,
      antiquityYears: data.builtTime?.toLowerCase().includes('más de 20') ? 25 : undefined,
      priceCop: price,
      adminFeeCop: data.adminPrice || data.detail?.adminPrice,
      title: data.title || '',
      description: data.comment || '',
      agencyName: data.companyName || '',
      features: data.featured ? data.featured.flatMap(f => f.items || []) : [],
      sourceRawData: data,
    };

  } catch (err) {
    console.warn(`  Failed:`, err.message);
    return null;
  }
}

async function loadPropertiesWithScroll(page) {
  const allUrls = new Set();
  
  console.log('  Scrolling to load properties...');
  
  for (let i = 0; i < 5; i++) { // Scroll 5 times
    // Get current links
    const urls = await page.evaluate(() => {
      const results = [];
      const links = document.querySelectorAll('a[href*="/inmueble/"]');
      for (const link of links) {
        const match = link.href.match(/(https:\/\/www\.metrocuadrado\.com\/inmueble\/[^?]+)/);
        if (match) results.push(match[1]);
      }
      return results;
    });
    
    urls.forEach(url => allUrls.add(url));
    console.log(`    Scroll ${i + 1}: ${allUrls.size} unique URLs found`);
    
    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(3000);
    
    if (allUrls.size >= 50) break; // Stop if we have enough
  }
  
  return Array.from(allUrls);
}

async function main() {
  const args = process.argv.slice(2);
  const headless = !args.includes('--headed');
  const maxProperties = parseInt(args.find(a => a.startsWith('--max='))?.split('=')[1] || '50', 10);

  console.log('=== Metrocuadrado Real Scraper ===');
  console.log(`Max properties: ${maxProperties}, Headless: ${headless}\n`);

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
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
    });
    
    const page = await context.newPage();

    // Load search page and scroll to get URLs
    await page.goto(`${METRO_WEB_URL}/inmuebles/venta/apartamento/bogota/`, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForTimeout(3000);
    
    const propertyUrls = await loadPropertiesWithScroll(page);
    console.log(`\nTotal URLs to process: ${Math.min(propertyUrls.length, maxProperties)}\n`);

    // Process each property
    for (const url of propertyUrls.slice(0, maxProperties)) {
      result.totalFetched++;
      console.log(`[${result.totalFetched}/${maxProperties}] Processing...`);
      
      const prop = await scrapePropertyDetail(page, url);
      
      if (!prop) {
        result.errors++;
        continue;
      }

      try {
        const upsert = await upsertProperty('metrocuadrado', prop.sourceId, prop);

        if (upsert.isNew) {
          result.created++;
          console.log(`    ✅ Created: ${prop.neighborhood} - $${(prop.priceCop/1000000).toFixed(1)}M - ${prop.builtAreaM2}m²`);
        } else {
          result.updated++;
          console.log(`    🔄 Updated: ${prop.sourceId}`);
        }
      } catch (err) {
        result.errors++;
        console.error(`    ❌ DB error:`, err.message);
      }

      await page.waitForTimeout(1500);
    }

  } finally {
    if (browser) await browser.close();
    await pool.end();
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total fetched: ${result.totalFetched}`);
  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Errors: ${result.errors}`);
  
  if (result.created > 0) {
    console.log(`\n🎉 SUCCESS! Scraped ${result.created} real properties from Metrocuadrado!`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
