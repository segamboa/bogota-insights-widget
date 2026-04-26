/**
 * Metrocuadrado scraper using Playwright.
 * Handles JavaScript rendering and extracts real property data.
 */
import { chromium, Browser, Page } from 'playwright';
import { upsertProperty } from '../../db/property-queries.js';
import type { PropertyType } from '../../db/types.js';

const METRO_WEB_URL = 'https://www.metrocuadrado.com';

function mapPropertyType(mcType: string): PropertyType {
  const type = mcType?.toLowerCase() || '';
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

function parseIntValue(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const parsed = parseInt(val.replace(/\D/g, ''), 10);
  return isNaN(parsed) ? undefined : parsed;
}

interface ScrapedProperty {
  sourceId: string;
  sourceUrl: string;
  propertyType: PropertyType;
  businessType: string;
  lat?: number;
  lng?: number;
  address?: string;
  neighborhood?: string;
  locality?: string;
  stratum?: number;
  builtAreaM2?: number;
  rooms?: number;
  bathrooms?: number;
  garages?: number;
  antiquityYears?: number;
  priceCop: number;
  adminFeeCop?: number;
  title: string;
  description?: string;
  agencyName?: string;
  features: string[];
}

/**
 * Extract property data from listing card element.
 */
async function extractListingData(page: Page, cardElement: any): Promise<ScrapedProperty | null> {
  try {
    // Get property ID from data attribute or URL
    const propertyId = await cardElement.getAttribute('data-property-id') ||
      await cardElement.getAttribute('data-id');
    
    if (!propertyId) {
      // Try to extract from link
      const link = await cardElement.locator('a[href*="/inmueble/"]').first();
      const href = await link.getAttribute('href');
      if (href) {
        const match = href.match(/\/inmueble\/([^/]+)/);
        if (match) return await scrapePropertyDetail(page, match[1]);
      }
      return null;
    }

    return await scrapePropertyDetail(page, propertyId);
  } catch (err) {
    return null;
  }
}

/**
 * Scrape property detail page.
 */
async function scrapePropertyDetail(page: Page, propertyId: string): Promise<ScrapedProperty | null> {
  const url = `${METRO_WEB_URL}/inmueble/${propertyId}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    await page.waitForSelector('h1, .property-title, [data-testid="property-title"]', { timeout: 10000 });

    // Extract JSON-LD data
    const jsonLdData = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || '');
          if (data['@type'] === 'RealEstateListing' || data['@type'] === 'Product' || data['@type'] === 'SingleFamilyResidence' || data['@type'] === 'Apartment') {
            return data;
          }
        } catch {}
      }
      return null;
    });

    // Extract from page if JSON-LD not available
    const pageData = await page.evaluate(() => {
      const getText = (selectors: string[]) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) return el.textContent?.trim();
        }
        return undefined;
      };

      const getNumber = (text: string | undefined) => {
        if (!text) return undefined;
        const num = parseInt(text.replace(/\D/g, ''), 10);
        return isNaN(num) ? undefined : num;
      };

      // Try to find window data
      const win = window as any;
      const stateData = win.__INITIAL_STATE__ || win.__DATA__ || win.__PROPERTY_DATA__;

      return {
        title: getText(['h1', '.property-title', '[data-testid="property-title"]']),
        price: getText(['.price', '[data-testid="price"]', '.property-price']),
        area: getText(['.area', '[data-testid="area"]', '.built-area']),
        rooms: getNumber(getText(['.rooms', '[data-testid="rooms"]'])),
        bathrooms: getNumber(getText(['.bathrooms', '[data-testid="bathrooms"]'])),
        garages: getNumber(getText(['.garages', '[data-testid="garages"]'])),
        address: getText(['.address', '[data-testid="address"]']),
        neighborhood: getText(['.neighborhood', '[data-testid="neighborhood"]']),
        stratum: getNumber(getText(['.stratum', '[data-testid="stratum"]'])),
        antiquity: getNumber(getText(['.antiquity', '[data-testid="antiquity"]'])),
        description: getText(['.description', '[data-testid="description"]']),
        agency: getText(['.agency-name', '[data-testid="agency"]']),
        stateData,
      };
    });

    // Combine data sources
    const jsonLd = jsonLdData || {};
    const data = pageData || {};

    // Parse price
    const price = parsePrice(jsonLd.price?.toString() || jsonLd.offers?.price?.toString() || data.price);
    if (!price) return null;

    // Property type
    const propertyType = mapPropertyType(jsonLd['@type'] || '');

    // Location
    const lat = jsonLd.geo?.latitude || jsonLd.latitude;
    const lng = jsonLd.geo?.longitude || jsonLd.longitude;

    // Address components
    const address = data.address || jsonLd.address?.streetAddress;
    const neighborhood = data.neighborhood || jsonLd.address?.addressLocality;
    const locality = jsonLd.address?.addressRegion || 'Bogotá';

    // Features
    const builtArea = parseArea(jsonLd.floorSize?.value?.toString() || data.area);
    const rooms = data.rooms || parseIntValue(jsonLd.numberOfRooms);
    const bathrooms = data.bathrooms || parseIntValue(jsonLd.numberOfBathroomsTotal);
    const garages = data.garages;
    const antiquity = data.antiquity;
    const stratum = data.stratum;

    // Features array
    const features: string[] = [];
    if (jsonLd.amenityFeature) {
      features.push(...jsonLd.amenityFeature.map((a: any) => a.value));
    }

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
      title: data.title || jsonLd.name || 'Propiedad en venta',
      description: data.description || jsonLd.description,
      agencyName: data.agency,
      features,
    };

  } catch (err) {
    console.warn(`  Failed to scrape ${propertyId}:`, err);
    return null;
  }
}

/**
 * Scrape search results page.
 */
async function scrapeSearchPage(
  page: Page,
  options: {
    propertyType?: string;
    businessType?: string;
    pageNum?: number;
  }
): Promise<{ properties: ScrapedProperty[]; hasMore: boolean }> {
  const { propertyType = 'apartamento', businessType = 'venta', pageNum = 1 } = options;
  
  const url = `${METRO_WEB_URL}/inmuebles/${businessType}/${propertyType}/bogota/${pageNum > 1 ? `?page=${pageNum}` : ''}`;
  
  console.log(`  Navigating: ${url}`);
  
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  
  // Wait for listings to load
  await page.waitForTimeout(3000);
  
  // Try multiple selectors for listing cards
  const cardSelectors = [
    '[data-testid="listing-card"]',
    '.listing-card',
    '[data-property-id]',
    '.property-card',
    '.card--property',
    'article[role="article"]',
  ];
  
  let cards: any[] = [];
  for (const selector of cardSelectors) {
    cards = await page.locator(selector).all();
    if (cards.length > 0) {
      console.log(`    Found ${cards.length} cards with selector: ${selector}`);
      break;
    }
  }
  
  if (cards.length === 0) {
    console.log('    No cards found, trying to extract from page data...');
    
    // Try to extract property IDs from page
    const propertyIds = await page.evaluate(() => {
      const ids: string[] = [];
      const links = document.querySelectorAll('a[href*="/inmueble/"]');
      for (const link of links) {
        const match = link.getAttribute('href')?.match(/\/inmueble\/([^/?]+)/);
        if (match && !ids.includes(match[1])) {
          ids.push(match[1]);
        }
      }
      return ids.slice(0, 20); // Limit to avoid too many page loads
    });
    
    console.log(`    Extracted ${propertyIds.length} property IDs from links`);
    
    const properties: ScrapedProperty[] = [];
    for (const id of propertyIds) {
      const prop = await scrapePropertyDetail(page, id);
      if (prop) properties.push(prop);
      await page.waitForTimeout(1500); // Rate limit
    }
    
    const hasMore = await page.locator('a[href*="page="], .pagination a, [data-testid="pagination-next"]').count() > 0;
    return { properties, hasMore };
  }
  
  // Extract from cards
  const properties: ScrapedProperty[] = [];
  for (const card of cards.slice(0, 10)) { // Limit per page
    const prop = await extractListingData(page, card);
    if (prop) properties.push(prop);
  }
  
  // Check for next page
  const hasMore = await page.locator('a[href*="page="], .pagination a, [data-testid="pagination-next"]').count() > 0;
  
  return { properties, hasMore };
}

/**
 * Main ingestion function.
 */
export async function ingestMetrocuadradoPlaywright(options: {
  propertyTypes?: string[];
  maxPages?: number;
  headless?: boolean;
} = {}): Promise<{
  totalFetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const {
    propertyTypes = ['apartamento'],
    maxPages = 5,
    headless = true,
  } = options;

  const result = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  console.log('=== Metrocuadrado Playwright Scraper ===');
  console.log(`Property types: ${propertyTypes.join(', ')}`);
  console.log(`Max pages: ${maxPages}`);
  console.log(`Headless: ${headless}\n`);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });
    
    const page = await context.newPage();

    for (const propertyType of propertyTypes) {
      console.log(`\n--- Scraping ${propertyType} ---`);
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const { properties, hasMore } = await scrapeSearchPage(page, {
            propertyType,
            pageNum,
          });

          console.log(`  Page ${pageNum}: ${properties.length} properties found`);

          for (const prop of properties) {
            result.totalFetched++;

            // Skip if no coordinates (optional)
            if (!prop.lat || !prop.lng) {
              // Try to geocode from address or skip
              result.skipped++;
              continue;
            }

            try {
              const upsert = await upsertProperty('metrocuadrado', prop.sourceId, {
                sourceUrl: prop.sourceUrl,
                propertyType: prop.propertyType,
                businessType: prop.businessType,
                lat: prop.lat,
                lng: prop.lng,
                address: prop.address,
                neighborhood: prop.neighborhood,
                locality: prop.locality,
                city: 'Bogotá',
                stratum: prop.stratum,
                builtAreaM2: prop.builtAreaM2,
                rooms: prop.rooms,
                bathrooms: prop.bathrooms,
                garages: prop.garages,
                antiquityYears: prop.antiquityYears,
                priceCop: prop.priceCop,
                adminFeeCop: prop.adminFeeCop,
                title: prop.title,
                description: prop.description,
                agencyName: prop.agencyName,
                features: prop.features,
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

          if (!hasMore) {
            console.log(`  No more pages for ${propertyType}`);
            break;
          }

          // Rate limit between pages
          await page.waitForTimeout(3000);

        } catch (err) {
          console.error(`  Page ${pageNum} error:`, err);
        }
      }
    }

  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total fetched: ${result.totalFetched}`);
  console.log(`Created: ${result.created}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors: ${result.errors}`);

  return result;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const headless = !args.includes('--headed');
  const maxPages = parseInt(args.find(a => a.startsWith('--pages='))?.split('=')[1] || '3', 10);
  
  ingestMetrocuadradoPlaywright({ headless, maxPages })
    .then((result) => {
      console.log('\nDone:', result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
}
