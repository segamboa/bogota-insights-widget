/**
 * Recreation data ingestion
 * Combines OSM and IDECA data for parks, playgrounds, sports facilities
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CategoryType } from '@bogota-insights/shared';
import { BOGOTA_BOUNDS } from '@bogota-insights/shared';
import { upsertPoi, createSyncRun, completeSyncRun } from '../db/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

// Overpass bbox for Bogota
const OVERPASS_BBOX = '4.4,-74.3,4.85,-73.9';
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

interface OsmRecreationConfig {
  name: string;
  overpassQuery: string;
  localFile: string;
  getSubcategory: (tags: Record<string, string>) => string;
  getName: (tags: Record<string, string>) => string | null;
}

const RECREATION_DATASETS: OsmRecreationConfig[] = [
  {
    name: 'Parks and Gardens',
    localFile: 'osm-recreation-parks.json',
    overpassQuery: `[out:json][timeout:60];
(
  node["leisure"="park"](${OVERPASS_BBOX});
  way["leisure"="park"](${OVERPASS_BBOX});
  node["leisure"="garden"](${OVERPASS_BBOX});
  way["leisure"="garden"](${OVERPASS_BBOX});
  node["landuse"="recreation_ground"](${OVERPASS_BBOX});
  way["landuse"="recreation_ground"](${OVERPASS_BBOX});
);
out center tags;`,
    getSubcategory: (tags) => {
      if (tags.leisure === 'garden') return 'garden';
      if (tags['park:type'] === 'playground' || tags.playground === 'yes') return 'playground';
      if (tags.sport || tags.leisure === 'sports_centre') return 'sports';
      return 'park';
    },
    getName: (tags) => {
      return tags.name || tags['name:es'] || tags['name:en'] || 
             (tags.leisure === 'park' ? 'Parque' : 
              tags.leisure === 'garden' ? 'Jardín' : 'Zona Recreativa');
    },
  },
  {
    name: 'Sports Facilities',
    localFile: 'osm-recreation-sports.json',
    overpassQuery: `[out:json][timeout:60];
(
  node["leisure"="sports_centre"](${OVERPASS_BBOX});
  way["leisure"="sports_centre"](${OVERPASS_BBOX});
  node["leisure"="stadium"](${OVERPASS_BBOX});
  way["leisure"="stadium"](${OVERPASS_BBOX});
  node["leisure"="pitch"](${OVERPASS_BBOX});
  way["leisure"="pitch"](${OVERPASS_BBOX});
  node["leisure"="fitness_centre"](${OVERPASS_BBOX});
  way["leisure"="fitness_centre"](${OVERPASS_BBOX});
  node["leisure"="swimming_pool"](${OVERPASS_BBOX});
  way["leisure"="swimming_pool"](${OVERPASS_BBOX});
);
out center tags;`,
    getSubcategory: (tags) => {
      if (tags.leisure === 'stadium') return 'stadium';
      if (tags.leisure === 'fitness_centre') return 'gym';
      if (tags.leisure === 'swimming_pool') return 'pool';
      if (tags.sport === 'soccer' || tags.sport === 'football') return 'soccer';
      if (tags.sport === 'basketball') return 'basketball';
      if (tags.sport === 'tennis') return 'tennis';
      return 'sports';
    },
    getName: (tags) => {
      return tags.name || tags['name:es'] || 
             (tags.leisure === 'stadium' ? 'Estadio' :
              tags.leisure === 'fitness_centre' ? 'Gimnasio' :
              tags.leisure === 'swimming_pool' ? 'Piscina' :
              tags.sport ? `Cancha de ${tags.sport}` : 'Instalación Deportiva');
    },
  },
  {
    name: 'Playgrounds and Recreation',
    localFile: 'osm-recreation-playgrounds.json',
    overpassQuery: `[out:json][timeout:60];
(
  node["leisure"="playground"](${OVERPASS_BBOX});
  way["leisure"="playground"](${OVERPASS_BBOX});
  node["amenity"="cinema"](${OVERPASS_BBOX});
  way["amenity"="cinema"](${OVERPASS_BBOX});
  node["amenity"="theatre"](${OVERPASS_BBOX});
  way["amenity"="theatre"](${OVERPASS_BBOX});
);
out center tags;`,
    getSubcategory: (tags) => {
      if (tags.leisure === 'playground') return 'playground';
      if (tags.amenity === 'cinema') return 'cinema';
      if (tags.amenity === 'theatre') return 'theatre';
      return 'recreation';
    },
    getName: (tags) => {
      return tags.name || tags['name:es'] ||
             (tags.leisure === 'playground' ? 'Parque Infantil' :
              tags.amenity === 'cinema' ? 'Cine' :
              tags.amenity === 'theatre' ? 'Teatro' : 'Recreación');
    },
  },
];

/**
 * Rate limiter for Overpass API
 */
const OVERPASS_MIN_INTERVAL_MS = 500;
let lastOverpassRequest = 0;

async function rateLimitedFetch(url: string, body: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastOverpassRequest;
  if (elapsed < OVERPASS_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, OVERPASS_MIN_INTERVAL_MS - elapsed));
  }
  lastOverpassRequest = Date.now();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'BogotaInsightsWidget/1.0',
    },
    body: `data=${encodeURIComponent(body)}`,
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(`Overpass API HTTP ${response.status}: ${response.statusText}`);
  }

  return response;
}

/**
 * Fetch data from Overpass API
 */
async function fetchOverpassData(query: string): Promise<any> {
  console.log('  Fetching from Overpass API...');
  const response = await rateLimitedFetch(OVERPASS_API, query);
  return response.json();
}

/**
 * Load local data file if exists
 */
function loadLocalData(filename: string): any | null {
  const filepath = join(DATA_DIR, filename);
  if (existsSync(filepath)) {
    console.log(`  Loading local file: ${filename}`);
    return JSON.parse(readFileSync(filepath, 'utf-8'));
  }
  return null;
}

/**
 * Save data to local file
 */
function saveLocalData(filename: string, data: any): void {
  const filepath = join(DATA_DIR, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`  Saved to: ${filepath}`);
}

/**
 * Parse OSM elements to POIs
 */
function parseOsmElements(
  data: any,
  config: OsmRecreationConfig
): Array<{
  name: string;
  lat: number;
  lng: number;
  subcategory: string;
  sourceId: string;
}> {
  const pois: ReturnType<typeof parseOsmElements> = [];

  for (const element of data.elements || []) {
    const tags = element.tags || {};
    const name = config.getName(tags);
    
    if (!name) continue;

    let lat: number;
    let lng: number;

    if (element.type === 'node') {
      lat = element.lat;
      lng = element.lon;
    } else if (element.center) {
      lat = element.center.lat;
      lng = element.center.lon;
    } else {
      continue;
    }

    // Validate coordinates are within Bogota
    if (
      lat < BOGOTA_BOUNDS.south ||
      lat > BOGOTA_BOUNDS.north ||
      lng < BOGOTA_BOUNDS.west ||
      lng > BOGOTA_BOUNDS.east
    ) {
      continue;
    }

    pois.push({
      name,
      lat,
      lng,
      subcategory: config.getSubcategory(tags),
      sourceId: `osm-${element.type}-${element.id}`,
    });
  }

  return pois;
}

/**
 * Ingest a single recreation dataset
 */
async function ingestRecreationDataset(
  config: OsmRecreationConfig,
  syncRunId: number
): Promise<{ created: number; updated: number; skipped: number }> {
  console.log(`\n--- Ingesting: ${config.name} ---`);

  let data: any;
  
  // Try local file first
  data = loadLocalData(config.localFile);
  
  if (!data) {
    try {
      data = await fetchOverpassData(config.overpassQuery);
      saveLocalData(config.localFile, data);
    } catch (err) {
      console.error(`  Failed to fetch ${config.name}:`, err);
      return { created: 0, updated: 0, skipped: 0 };
    }
  }

  const pois = parseOsmElements(data, config);
  console.log(`  Parsed ${pois.length} elements from ${config.name}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const poi of pois) {
    try {
      const result = await upsertPoi(
        'osm',
        poi.sourceId,
        `osm-recreation-${config.name.toLowerCase().replace(/\s+/g, '-')}`,
        'recreation',
        poi.subcategory,
        poi.name,
        null,
        poi.lng,
        poi.lat,
        null,
        80,
        {},
        null,
      );

      if (result.isNew) created++;
      else updated++;
    } catch (err) {
      console.error(`  Error upserting POI ${poi.sourceId}:`, err);
      skipped++;
    }
  }

  console.log(`  Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  return { created, updated, skipped };
}

/**
 * Main ingestion function
 */
export async function ingestAllRecreationData(): Promise<void> {
  console.log('=== Recreation Data Ingestion ===\n');

  const syncRunId = await createSyncRun('osm', 'recreation');
  console.log(`Created sync run: ${syncRunId}`);

  const totals = { created: 0, updated: 0, skipped: 0 };

  for (const dataset of RECREATION_DATASETS) {
    const result = await ingestRecreationDataset(dataset, syncRunId);
    totals.created += result.created;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
  }

  await completeSyncRun(syncRunId, 'completed', {
    records_created: totals.created,
    records_updated: totals.updated,
  });

  console.log('\n=== Recreation Ingestion Complete ===');
  console.log(`Total: Created ${totals.created}, Updated ${totals.updated}, Skipped ${totals.skipped}`);
}

// CLI runner
if (process.argv[1] && process.argv[1].includes('recreation-ingest')) {
  ingestAllRecreationData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Ingestion failed:', err);
      process.exit(1);
    });
}
