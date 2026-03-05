/**
 * Simple recreation data ingestion (no sync run tracking)
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CategoryType } from '@bogota-insights/shared';
import { BOGOTA_BOUNDS } from '@bogota-insights/shared';
import { upsertPoi } from '../db/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

const OVERPASS_BBOX = '4.4,-74.3,4.85,-73.9';
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Simple recreation query - parks and sports
const RECREATION_QUERY = `[out:json][timeout:120];
(
  node["leisure"="park"](${OVERPASS_BBOX});
  way["leisure"="park"](${OVERPASS_BBOX});
  node["leisure"="garden"](${OVERPASS_BBOX});
  way["leisure"="garden"](${OVERPASS_BBOX});
  node["leisure"="sports_centre"](${OVERPASS_BBOX});
  way["leisure"="sports_centre"](${OVERPASS_BBOX});
  node["leisure"="pitch"](${OVERPASS_BBOX});
  way["leisure"="pitch"](${OVERPASS_BBOX});
  node["leisure"="playground"](${OVERPASS_BBOX});
  way["leisure"="playground"](${OVERPASS_BBOX});
  node["landuse"="recreation_ground"](${OVERPASS_BBOX});
  way["landuse"="recreation_ground"](${OVERPASS_BBOX});
);
out center tags;`;

async function fetchOverpass(query: string): Promise<any> {
  console.log('Fetching from Overpass API...');
  await new Promise(r => setTimeout(r, 1000)); // Rate limit
  
  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'BogotaInsightsWidget/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

function parseRecreationPois(data: any): Array<{
  name: string;
  lat: number;
  lng: number;
  subcategory: string;
  sourceId: string;
}> {
  const pois: ReturnType<typeof parseRecreationPois> = [];

  for (const el of data.elements || []) {
    const tags = el.tags || {};
    let name = tags.name || tags['name:es'] || tags['name:en'];
    
    // Generate name if not provided
    if (!name) {
      if (tags.leisure === 'park') name = 'Parque';
      else if (tags.leisure === 'garden') name = 'Jardín';
      else if (tags.leisure === 'playground') name = 'Parque Infantil';
      else if (tags.leisure === 'sports_centre') name = 'Centro Deportivo';
      else if (tags.leisure === 'pitch') name = 'Cancha';
      else name = 'Zona Recreativa';
    }

    let lat: number, lng: number;
    if (el.type === 'node') {
      lat = el.lat; lng = el.lon;
    } else if (el.center) {
      lat = el.center.lat; lng = el.center.lon;
    } else continue;

    // Check bounds
    if (lat < BOGOTA_BOUNDS.south || lat > BOGOTA_BOUNDS.north ||
        lng < BOGOTA_BOUNDS.west || lng > BOGOTA_BOUNDS.east) {
      continue;
    }

    // Determine subcategory
    let subcategory = 'park';
    if (tags.leisure === 'garden') subcategory = 'garden';
    else if (tags.leisure === 'playground') subcategory = 'playground';
    else if (tags.leisure === 'sports_centre') subcategory = 'sports';
    else if (tags.leisure === 'pitch') subcategory = 'sports';
    else if (tags.sport) subcategory = tags.sport;

    pois.push({ name, lat, lng, subcategory, sourceId: `osm-${el.type}-${el.id}` });
  }

  return pois;
}

async function main() {
  console.log('=== Simple Recreation Ingest ===\n');

  // Check for local file
  const localFile = join(DATA_DIR, 'osm-recreation-simple.json');
  let data: any;

  if (existsSync(localFile)) {
    console.log('Loading from local file...');
    data = JSON.parse(readFileSync(localFile, 'utf-8'));
  } else {
    data = await fetchOverpass(RECREATION_QUERY);
    writeFileSync(localFile, JSON.stringify(data, null, 2));
    console.log('Saved to local file');
  }

  const pois = parseRecreationPois(data);
  console.log(`Found ${pois.length} recreation POIs\n`);

  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (let i = 0; i < pois.length; i++) {
    const poi = pois[i];
    if (i % 100 === 0) console.log(`Progress: ${i}/${pois.length}`);

    try {
      const result = await upsertPoi({
        name: poi.name,
        category: 'recreation' as CategoryType,
        subcategory: poi.subcategory,
        lat: poi.lat,
        lng: poi.lng,
        source: 'osm',
        sourceDataset: 'osm-recreation',
        sourceId: poi.sourceId,
        rawData: {},
        confidence: 80,
      });

      if (result === 'created') created++;
      else if (result === 'updated') updated++;
      else skipped++;
    } catch (err) {
      console.error(`Error: ${poi.sourceId}`, err.message);
      errors++;
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  console.log(`Total POIs: ${created + updated}`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
