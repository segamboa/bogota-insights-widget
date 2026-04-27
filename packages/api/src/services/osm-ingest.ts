import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CategoryType } from '@bogota-insights/shared';
import { BOGOTA_BOUNDS } from '@bogota-insights/shared';
import { upsertPoi, createSyncRun, completeSyncRun } from '../db/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

/**
 * Rate limiter for Overpass API requests (max 2 req/sec).
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

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

/**
 * OSM dataset configuration. Each entry defines an Overpass query
 * and the mapping to our POI schema.
 */
interface OsmDatasetConfig {
  name: string;
  category: CategoryType;
  sourceDataset: string;
  overpassQuery: string;
  localFile: string;
  getSubcategory: (tags: Record<string, string>) => string;
  getName: (tags: Record<string, string>) => string | null;
  getAddress: (tags: Record<string, string>) => string | null;
  getConfidence: (tags: Record<string, string>) => number;
}

/**
 * Bogota bounding box for Overpass queries.
 * Format: south,west,north,east
 * Uses validated bounds from data-engineer analysis.
 */
const OVERPASS_BBOX = '4.4,-74.3,4.85,-73.9';

const OSM_DATASETS: OsmDatasetConfig[] = [
  {
    name: 'Commerce - Amenities',
    category: 'commerce',
    sourceDataset: 'osm-commerce-amenities',
    localFile: 'osm-commerce-amenities.json',
    overpassQuery: `[out:json][timeout:30];
(
  node["amenity"~"^(restaurant|cafe|bank)$"](${OVERPASS_BBOX});
  way["amenity"~"^(restaurant|cafe|bank)$"](${OVERPASS_BBOX});
);
out center tags;`,
    getSubcategory: (tags) => {
      if (tags.amenity === 'restaurant') return 'restaurante';
      if (tags.amenity === 'cafe') return 'cafe';
      if (tags.amenity === 'bank') return 'banco';
      return 'commerce';
    },
    getName: (tags) => tags.name || tags['name:es'] || null,
    getAddress: (tags) => tags['addr:street']
      ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}`
      : null,
    getConfidence: (tags) => {
      let score = 65;
      if (tags.name) score += 15;
      if (tags['addr:street']) score += 5;
      if (tags.brand) score += 5;
      if (tags.opening_hours) score += 5;
      return Math.min(100, score);
    },
  },
  {
    name: 'Commerce - Shops',
    category: 'commerce',
    sourceDataset: 'osm-commerce-shops',
    localFile: 'osm-commerce-shops.json',
    overpassQuery: `[out:json][timeout:30];
(
  node["shop"~"^(supermarket|convenience|department_store|mall)$"](${OVERPASS_BBOX});
  way["shop"~"^(supermarket|convenience|department_store|mall)$"](${OVERPASS_BBOX});
);
out center tags;`,
    getSubcategory: (tags) => {
      if (tags.shop === 'supermarket') return 'supermercado';
      if (tags.shop === 'convenience') return 'tienda';
      if (tags.shop === 'mall' || tags.shop === 'department_store') return 'centro_comercial';
      return 'tienda';
    },
    getName: (tags) => tags.name || tags['name:es'] || null,
    getAddress: (tags) => tags['addr:street']
      ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}`
      : null,
    getConfidence: (tags) => {
      let score = 65;
      if (tags.name) score += 15;
      if (tags['addr:street']) score += 5;
      if (tags.brand) score += 5;
      if (tags.opening_hours) score += 5;
      return Math.min(100, score);
    },
  },
  {
    name: 'SITP Bus Stops',
    category: 'transport',
    sourceDataset: 'osm-sitp-bus-stops',
    localFile: 'osm-sitp-bus-stops.json',
    overpassQuery: `[out:json][timeout:30];
(
  node["highway"="bus_stop"](${OVERPASS_BBOX});
  node["public_transport"="platform"]["bus"="yes"](${OVERPASS_BBOX});
);
out body;`,
    getSubcategory: () => 'parada_sitp',
    getName: (tags) => tags.name || tags['name:es'] || null,
    getAddress: (tags) => tags['addr:street']
      ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}`
      : null,
    getConfidence: (tags) => {
      let score = 70;
      if (tags.name) score += 10;
      if (tags.operator) score += 5;
      if (tags.network) score += 5;
      if (tags.ref) score += 5;
      return Math.min(100, score);
    },
  },
  {
    name: 'Health Amenities',
    category: 'health',
    sourceDataset: 'osm-health-amenities',
    localFile: 'osm-health-amenities.json',
    overpassQuery: `[out:json][timeout:30];
(
  node["amenity"~"^(hospital|clinic|doctors|pharmacy)$"](${OVERPASS_BBOX});
  way["amenity"~"^(hospital|clinic|doctors|pharmacy)$"](${OVERPASS_BBOX});
);
out center tags;`,
    getSubcategory: (tags) => {
      if (tags.amenity === 'hospital') return 'hospital';
      if (tags.amenity === 'clinic') return 'clinica';
      if (tags.amenity === 'doctors') return 'medico';
      if (tags.amenity === 'pharmacy') return 'farmacia';
      return 'salud';
    },
    getName: (tags) => tags.name || tags['name:es'] || null,
    getAddress: (tags) => tags['addr:street']
      ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}`
      : null,
    getConfidence: (tags) => {
      let score = 70;
      if (tags.name) score += 15;
      if (tags['addr:street']) score += 5;
      if (tags.operator || tags.healthcare) score += 5;
      if (tags.phone) score += 5;
      return Math.min(100, score);
    },
  },
  {
    name: 'Education Facilities',
    category: 'education',
    sourceDataset: 'osm-education-facilities',
    localFile: 'osm-education-facilities.json',
    overpassQuery: `[out:json][timeout:30];
(
  node["amenity"~"^(school|university|kindergarten|college)$"](${OVERPASS_BBOX});
  way["amenity"~"^(school|university|kindergarten|college)$"](${OVERPASS_BBOX});
);
out center tags;`,
    getSubcategory: (tags) => {
      if (tags.amenity === 'university' || tags.amenity === 'college') return 'universidad';
      if (tags.amenity === 'kindergarten') return 'jardin';
      if (tags.amenity === 'school') return 'colegio';
      return 'educacion';
    },
    getName: (tags) => tags.name || tags['name:es'] || null,
    getAddress: (tags) => tags['addr:street']
      ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}`
      : null,
    getConfidence: (tags) => {
      let score = 75;
      if (tags.name) score += 15;
      if (tags['addr:street']) score += 5;
      if (tags.operator) score += 5;
      return Math.min(100, score);
    },
  },
  {
    name: 'Museums and Cultural Attractions',
    category: 'recreation',
    sourceDataset: 'osm-museums-attractions',
    localFile: 'osm-museums-attractions.json',
    overpassQuery: `[out:json][timeout:60];
(
  node["tourism"="museum"](${OVERPASS_BBOX});
  way["tourism"="museum"](${OVERPASS_BBOX});
  node["tourism"="gallery"](${OVERPASS_BBOX});
  way["tourism"="gallery"](${OVERPASS_BBOX});
  node["tourism"="attraction"](${OVERPASS_BBOX});
  way["tourism"="attraction"](${OVERPASS_BBOX});
  node["historic"="monument"](${OVERPASS_BBOX});
  way["historic"="monument"](${OVERPASS_BBOX});
  node["historic"="building"](${OVERPASS_BBOX});
  way["historic"="building"](${OVERPASS_BBOX});
  node["amenity"="arts_centre"](${OVERPASS_BBOX});
  way["amenity"="arts_centre"](${OVERPASS_BBOX});
);
out center tags;`,
    getSubcategory: (tags) => {
      if (tags.tourism === 'museum') return 'museum';
      if (tags.tourism === 'gallery') return 'gallery';
      if (tags.tourism === 'attraction') return 'attraction';
      if (tags.historic === 'monument') return 'monument';
      if (tags.historic === 'building') return 'historic_site';
      if (tags.amenity === 'arts_centre') return 'arts_centre';
      return 'culture';
    },
    getName: (tags) => tags.name || tags['name:es'] || null,
    getAddress: (tags) => tags['addr:street']
      ? `${tags['addr:street']}${tags['addr:housenumber'] ? ' ' + tags['addr:housenumber'] : ''}`
      : null,
    getConfidence: (tags) => {
      let score = 75;
      if (tags.name) score += 15;
      if (tags['addr:street']) score += 5;
      if (tags.website) score += 5;
      return Math.min(100, score);
    },
  },
];

/**
 * Overpass JSON element type.
 */
interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  version: number;
  elements: OverpassElement[];
}

/**
 * Extract coordinates from an Overpass element.
 * Nodes have lat/lon directly; ways use the `center` field (from `out center`).
 */
function extractCoordinates(element: OverpassElement): { lat: number; lng: number } | null {
  let lat: number | undefined;
  let lng: number | undefined;

  if (element.type === 'node') {
    lat = element.lat;
    lng = element.lon;
  } else if (element.center) {
    lat = element.center.lat;
    lng = element.center.lon;
  }

  if (lat === undefined || lng === undefined) return null;
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat === 0 && lng === 0) return null;

  return { lat, lng };
}

/**
 * Validate coordinates are within Bogota bounds.
 */
function isWithinBogota(lat: number, lng: number): boolean {
  return (
    lat >= BOGOTA_BOUNDS.south &&
    lat <= BOGOTA_BOUNDS.north &&
    lng >= BOGOTA_BOUNDS.west &&
    lng <= BOGOTA_BOUNDS.east
  );
}

/**
 * Validate and sanitize a string value.
 * Prevents overly long strings and trims whitespace.
 */
function sanitizeString(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  // Strip HTML tags for defense-in-depth against XSS
  const stripped = value.replace(/<[^>]*>/g, '').trim();
  if (stripped.length === 0) return null;
  return stripped.slice(0, maxLength);
}

/**
 * Sanitize OSM tags to prevent storing excessively large metadata.
 * Only keeps relevant tags, strips long values.
 */
function sanitizeTags(tags: Record<string, string>): Record<string, string> {
  const ALLOWED_KEYS = new Set([
    'name', 'name:es', 'name:en', 'amenity', 'shop', 'highway',
    'public_transport', 'bus', 'network', 'operator', 'brand',
    'addr:street', 'addr:housenumber', 'addr:city',
    'opening_hours', 'phone', 'website', 'ref',
    'wheelchair', 'building', 'cuisine', 'atm',
    'route_ref', 'shelter', 'tourism', 'historic',
  ]);

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (ALLOWED_KEYS.has(key) && typeof value === 'string') {
      sanitized[key] = value.slice(0, 500);
    }
  }
  return sanitized;
}

/**
 * Load Overpass data from local cache file or fetch from API.
 */
async function loadOverpassData(
  overpassQuery: string,
  localFile: string,
): Promise<OverpassElement[]> {
  const localPath = join(DATA_DIR, localFile);

  // Try local file first
  if (existsSync(localPath)) {
    console.log(`  Loading cached: ${localPath}`);
    const raw = readFileSync(localPath, 'utf-8');
    const data = JSON.parse(raw) as OverpassResponse;
    if (data.elements && Array.isArray(data.elements)) {
      return data.elements;
    }
    throw new Error(`Unexpected local file format: missing elements array`);
  }

  // Fetch from Overpass API with rate limiting
  console.log(`  Querying Overpass API...`);
  const response = await rateLimitedFetch(OVERPASS_API, overpassQuery);
  const data = await response.json() as OverpassResponse;

  if (!data.elements || !Array.isArray(data.elements)) {
    throw new Error(`Unexpected Overpass response: missing elements array`);
  }

  // Cache locally for future runs
  try {
    writeFileSync(localPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`  Cached ${data.elements.length} elements to ${localPath}`);
  } catch (cacheErr) {
    console.warn(`  Warning: could not cache Overpass response:`, cacheErr);
  }

  return data.elements;
}

/**
 * Ingest a single OSM dataset into the pois table.
 */
export async function ingestOsmDataset(dataset: OsmDatasetConfig): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const result = { created: 0, updated: 0, skipped: 0, errors: 0 };

  const elements = await loadOverpassData(dataset.overpassQuery, dataset.localFile);
  console.log(`  Parsed ${elements.length} elements from ${dataset.name}`);

  for (const element of elements) {
    const tags = element.tags || {};
    const coords = extractCoordinates(element);

    if (!coords) {
      result.skipped++;
      continue;
    }

    // Validate coordinates within Bogota bounds
    if (!isWithinBogota(coords.lat, coords.lng)) {
      result.skipped++;
      continue;
    }

    const sourceId = `osm-${element.type}-${element.id}`;
    const name = sanitizeString(dataset.getName(tags), 500);
    const address = sanitizeString(dataset.getAddress(tags), 500);
    const subcategory = dataset.getSubcategory(tags);
    const confidence = dataset.getConfidence(tags);
    const sanitizedTags = sanitizeTags(tags);

    try {
      const upserted = await upsertPoi(
        'osm',
        sourceId,
        dataset.sourceDataset,
        dataset.category,
        subcategory,
        name,
        name, // name_es same for OSM Spanish-language data
        coords.lng,
        coords.lat,
        address,
        confidence,
        sanitizedTags,
        null,
      );

      if (upserted.isNew) {
        result.created++;
      } else {
        result.updated++;
      }
    } catch (err) {
      result.errors++;
      if (result.errors <= 5) {
        console.error(`  Error upserting ${sourceId}:`, err);
      }
    }
  }

  return result;
}

/**
 * Ingest all OSM datasets (commerce + SITP bus stops).
 */
export async function ingestAllOsmDatasets(): Promise<void> {
  const syncRunId = await createSyncRun('osm', 'full');
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFetched = 0;
  let totalErrors = 0;

  try {
    for (const dataset of OSM_DATASETS) {
      console.log(`\n--- Ingesting: ${dataset.name} ---`);
      try {
        const result = await ingestOsmDataset(dataset);
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalFetched += result.created + result.updated + result.skipped;
        totalErrors += result.errors;
        console.log(`  Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
      } catch (err) {
        console.error(`  Failed to ingest ${dataset.name}:`, err);
        totalErrors++;
      }
    }

    await completeSyncRun(syncRunId, totalErrors > 0 ? 'partial' : 'completed', {
      records_fetched: totalFetched,
      records_created: totalCreated,
      records_updated: totalUpdated,
    });

    console.log(`\nOSM ingestion complete: ${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors`);
  } catch (err: any) {
    await completeSyncRun(syncRunId, 'failed', {}, err.message, { stack: err.stack });
    throw err;
  }
}

export function getOsmDatasets(): OsmDatasetConfig[] {
  return OSM_DATASETS;
}
