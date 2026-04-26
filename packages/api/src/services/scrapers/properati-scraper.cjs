#!/usr/bin/env node
/**
 * Properati scraper - Free real estate data from properati.com.co
 * More accessible than Metrocuadrado
 */
const { chromium } = require('/skeleton/.npm-global/lib/node_modules/playwright');
const pg = require('/data/.openclaw/workspace/bogota-insights-widget/node_modules/.pnpm/pg@8.19.0/node_modules/pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://bogota:bogota_dev_2026@localhost:5432/bogota_insights',
});

const PROPERATI_URL = 'https://www.properati.com.co';

function mapPropertyType(ptype) {
  const type = (ptype || '').toLowerCase();
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
    await page.waitForTimeout(4000);

    // Extract JSON-LD data
    const propertyData = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data['@type'] === 'SingleFamilyResidence' || 
              data['@type'] === 'Apartment' || 
              data['@type'] === 'Product') {
            return data;
          }
        } catch {}
      }
      return null;
    });

    if (!propertyData) {
      // Fallback: extract from HTML
      const htmlData = await page.evaluate(() => {
        const text = document.body.innerText;
        const priceMatch = text.match(/\$([\d.,]+)/);
        const areaMatch = text.match(/(\d+)\s*m²/);
        const roomsMatch = text.match(/(\d+)\s*habitaciones/i);
        
        return {
          price: priceMatch ? priceMatch[1].replace(/[.,]/g, '') : null,
          area: areaMatch ? areaMatch[1] : null,
          rooms: roomsMatch ? roomsMatch[1] : null,
        };
      });
      
      if (!htmlData.price) return null;
      
      return {
        sourceId: url.split('/').pop() || Date.now().toString(),
        sourceUrl: url,
        propertyType: 'apartamento',
        businessType: 'venta',
        lat: 4.65, // Default Bogotá
        lng: -74.08,
        priceCop: parseInt(htmlData.price, 10),
        builtAreaM2: htmlData.area ? parseFloat(htmlData.area) : undefined,
        rooms: htmlData.rooms ? parseInt(htmlData.rooms) : undefined,
        title: 'Propiedad Properati',
        sourceRawData: htmlData,
      };
    }

    const data = propertyData;
    const price = parsePrice(data.price || data.offers?.price);
    if (!price) return null;

    const address = data.address;
    const coords = data.geo || {};

    return {
      sourceId: data.identifier || data.sku || url.split('/').pop(),
      sourceUrl: url,
      propertyType: mapPropertyType(data['@type']),
      businessType: 'venta',
      lat: coords.latitude,
      lng: coords.longitude,
      address: typeof address === 'object' ? address.streetAddress : address,
      neighborhood: typeof address === 'object' ? address.addressLocality : '',
      locality: typeof address === 'object' ? address.addressRegion : '',
      city: 'Bogotá',
      builtAreaM2: parseArea(data.floorSize?.value),
      rooms: data.numberOfRooms,
      bathrooms: data.numberOfBathroomsTotal,
      priceCop: price,
      title: data.name || '',
      description: data.description || '',
      sourceRawData: data,
    };

  } catch (err) {
    console.warn(`  Failed:`, err.message);
    return null;
  }
}

async function scrapeSearchPage(page, pageNum = 1) {
  const url = `${PROPERATI_URL}/s/bogota/venta/apartamentos/${pageNum > 1 ? `${pageNum}/` : ''}`;
  
  console.log(`  Navigating: ${url}`);
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Extract property URLs
  const propertyUrls = await page.evaluate(() => {
    const urls = [];
    const seen = new Set();
    const links = document.querySelectorAll('a[href*="/detalle/"]');
    
    for (const link of links) {
      const href = link.href;
      if (href && !seen.has(href)) {
        seen.add(href);
        urls.push(href);
      }
    }
    
    return urls.slice(0, 20); // Limit per page
  });
  
  console.log(`    Found ${propertyUrls.length} property URLs`);
  return propertyUrls;
}

async function main() {
  const args = process.argv.slice(2);
  const headless = !args.includes('--headed');
  const maxPages = parseInt(args.find(a => a.startsWith('--pages='))?.split('=')[1] || '3', 10);

  console.log('=== Properati Scraper (FREE data) ===');
  console.log(`Max pages: ${maxPages}, Headless: ${headless}\n`);

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

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const propertyUrls = await scrapeSearchPage(page, pageNum);
        
        if (propertyUrls.length === 0) {
          console.log('  No properties found');
          break;
        }

        console.log(`  Processing ${propertyUrls.length} properties...`);

        for (const url of propertyUrls) {
          result.totalFetched++;
          const prop = await scrapePropertyDetail(page, url);
          
          if (!prop || !prop.priceCop) {
            result.errors++;
            continue;
          }

          try {
            const upsert = await upsertProperty('properati', prop.sourceId, prop);

            if (upsert.isNew) {
              result.created++;
              console.log(`    ✅ [${result.totalFetched}] Created: ${prop.title?.substring(0, 40) || 'Property'} - $${(prop.priceCop/1000000).toFixed(1)}M`);
            } else {
              result.updated++;
            }
          } catch (err) {
            result.errors++;
          }

          await page.waitForTimeout(1500);
        }

      } catch (err) {
        console.error(`  Page ${pageNum} error:`, err.message);
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
  console.log(`Errors: ${result.errors}`);
  
  if (result.created > 0) {
    console.log(`\n🎉 SUCCESS! Scraped ${result.created} FREE properties from Properati!`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
