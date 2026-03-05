/**
 * Ingest recreation data from existing local files
 * Corrected version with proper upsertPoi signature
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CategoryType } from '@bogota-insights/shared';
import { BOGOTA_BOUNDS } from '@bogota-insights/shared';
import { upsertPoi } from '../db/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

interface LocalFileConfig {
  filename: string;
  sourceDataset: string;
  getSubcategory: (tags: Record<string, string>) => string;
  getName: (tags: Record<string, string>) => string | null;
  getNameEs: (tags: Record<string, string>) => string | null;
}

const RECREATION_FILES: LocalFileConfig[] = [
  {
    filename: 'osm-recreation-sports.json',
    sourceDataset: 'osm-recreation-sports',
    getSubcategory: (tags) => {
      if (tags.leisure === 'stadium') return 'stadium';
      if (tags.leisure === 'fitness_centre') return 'gym';
      if (tags.leisure === 'swimming_pool') return 'pool';
      if (tags.sport) return tags.sport;
      return 'sports';
    },
    getName: (tags) => tags.name || tags['name:en'] || null,
    getNameEs: (tags) => tags['name:es'] || tags.name || null,
  },
  {
    filename: 'osm-recreation-playgrounds.json',
    sourceDataset: 'osm-recreation-playgrounds',
    getSubcategory: (tags) => {
      if (tags.leisure === 'playground') return 'playground';
      if (tags.amenity === 'cinema') return 'cinema';
      if (tags.amenity === 'theatre') return 'theatre';
      return 'recreation';
    },
    getName: (tags) => tags.name || tags['name:en'] || null,
    getNameEs: (tags) => tags['name:es'] || tags.name || null,
  },
];

function parseOsmFile(filepath: string, config: LocalFileConfig) {
  const data = JSON.parse(readFileSync(filepath, 'utf-8'));
  const pois: Array<{
    name: string | null;
    nameEs: string | null;
    lat: number;
    lng: number;
    subcategory: string;
    sourceId: string;
  }> = [];

  for (const el of data.elements || []) {
    const tags = el.tags || {};
    const name = config.getName(tags);
    const nameEs = config.getNameEs(tags);
    
    let lat: number, lng: number;
    if (el.type === 'node') {
      lat = el.lat; lng = el.lon;
    } else if (el.center) {
      lat = el.center.lat; lng = el.center.lon;
    } else continue;

    if (lat < BOGOTA_BOUNDS.south || lat > BOGOTA_BOUNDS.north ||
        lng < BOGOTA_BOUNDS.west || lng > BOGOTA_BOUNDS.east) {
      continue;
    }

    pois.push({
      name,
      nameEs,
      lat,
      lng,
      subcategory: config.getSubcategory(tags),
      sourceId: `osm-${el.type}-${el.id}`,
    });
  }

  return pois;
}

async function main() {
  console.log('=== Recreation Ingest from Local Files ===\n');

  let totalCreated = 0, totalUpdated = 0, totalErrors = 0;

  for (const config of RECREATION_FILES) {
    const filepath = join(DATA_DIR, config.filename);
    console.log(`Processing: ${config.filename}`);

    let pois: ReturnType<typeof parseOsmFile> = [];
    try {
      pois = parseOsmFile(filepath, config);
      console.log(`  Found ${pois.length} POIs`);
    } catch (err) {
      console.error(`  Error reading file: ${err.message}`);
      continue;
    }

    let created = 0, updated = 0, errors = 0;

    for (let i = 0; i < pois.length; i++) {
      const poi = pois[i];
      if (i % 500 === 0) console.log(`    Progress: ${i}/${pois.length}`);

      try {
        const result = await upsertPoi(
          'osm',                    // source
          poi.sourceId,             // sourceId
          config.sourceDataset,     // sourceDataset
          'recreation' as CategoryType, // category
          poi.subcategory,          // subcategory
          poi.name,                 // name
          poi.nameEs,               // nameEs
          poi.lng,                  // lng
          poi.lat,                  // lat
          null,                     // address
          80,                       // confidence
          {},                       // sourceTags
          null,                     // sourceUpdatedAt
        );

        if (result.isNew) created++;
        else updated++;
      } catch (err) {
        if (errors < 5) console.error(`    Error: ${err.message}`);
        errors++;
      }
    }

    console.log(`  Created: ${created}, Updated: ${updated}, Errors: ${errors}\n`);
    totalCreated += created;
    totalUpdated += updated;
    totalErrors += errors;
  }

  console.log('=== Complete ===');
  console.log(`Total: Created ${totalCreated}, Updated ${totalUpdated}, Errors ${totalErrors}`);
  console.log(`Total recreation POIs: ${totalCreated + totalUpdated}`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
