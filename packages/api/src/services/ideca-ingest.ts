import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CategoryType } from '@bogota-insights/shared';
import { upsertPoi, createSyncRun, completeSyncRun } from '../db/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * IDECA dataset configuration.
 * Uses real GeoJSON download URLs from datosabiertos.bogota.gov.co.
 */
interface IdecaDatasetConfig {
  name: string;
  url: string;
  category: CategoryType;
  sourceDataset: string;
  /** Function to extract name from feature properties */
  getName: (props: Record<string, any>) => string | null;
  /** Function to extract address from feature properties */
  getAddress: (props: Record<string, any>) => string | null;
  /** Function to extract subcategory from feature properties */
  getSubcategory: (props: Record<string, any>) => string;
  /** Function to extract a unique source ID */
  getSourceId: (props: Record<string, any>, index: number) => string;
  /** Local file path for pre-downloaded data */
  localFile?: string;
}

const IDECA_DATASETS: IdecaDatasetConfig[] = [
  {
    name: 'Colegios (Schools)',
    url: 'https://datosabiertos.bogota.gov.co/dataset/d451b52f-e30c-43b3-9066-3a7816638fea/resource/733a1015-d6e3-44c2-bddb-937e7665da14/download/colegios06_2025.geojson',
    category: 'education',
    sourceDataset: 'colegios-bogota-d-c',
    getName: (props) => props.NOMBRE_SED || props.NOMBRE_EST || props.nombre || null,
    getAddress: (props) => props.DIRECCION || props.direccion || null,
    getSubcategory: (props) => {
      const nombre = (props.NOMBRE_SED || props.NOMBRE_EST || '').toLowerCase();
      if (nombre.includes('universidad') || nombre.includes('universitari')) return 'university';
      if (nombre.includes('jardin') || nombre.includes('jardín')) return 'kindergarten';
      return 'school';
    },
    getSourceId: (props, i) => `colegios-${props.OBJECTID || props.NIT || i}`,
    localFile: 'colegios.geojson',
  },
  {
    name: 'Instituciones de Salud (Health)',
    url: 'https://datosabiertos.bogota.gov.co/dataset/fc66362f-ba91-4d7a-af9c-d0b3d3a60106/resource/0e432b79-8c0f-4a0c-a592-43330712fe03/download/ips.geojson',
    category: 'health',
    sourceDataset: 'ips-bogota',
    getName: (props) => props.nombre || props.nombre_pre || props.NOMBRE || null,
    getAddress: (props) => props.direccion || props.DIRECCION || null,
    getSubcategory: (props) => {
      const nombre = (props.nombre || props.nombre_pre || '').toLowerCase();
      if (nombre.includes('hospital')) return 'hospital';
      if (nombre.includes('clinica') || nombre.includes('clínica')) return 'clinic';
      const naturaleza = (props.naturaleza || '').toLowerCase();
      if (naturaleza.includes('publica') || naturaleza.includes('pública')) return 'clinic';
      return 'doctors';
    },
    getSourceId: (props, i) => `ips-${props.codigo_pre || props.OBJECTID || i}`,
    localFile: 'ips.geojson',
  },
  {
    name: 'Bibliotecas (Libraries)',
    url: 'https://datosabiertos.bogota.gov.co/dataset/0975fb88-7a10-4b1d-957a-467339905787/resource/0b82bfe3-dd45-4ac4-9fdd-7bdc2bc5e3fd/download/biblored.geojson',
    category: 'education',
    sourceDataset: 'bibliored-bogota',
    getName: (props) => props.nombre || props.NOMBRE || props.name || null,
    getAddress: (props) => props.direccion || props.DIRECCION || props.address || null,
    getSubcategory: () => 'library',
    getSourceId: (props, i) => `bibliored-${props.OBJECTID || props.id || i}`,
    localFile: 'biblored.geojson',
  },
  {
    name: 'Parques (Parks)',
    url: 'https://datosabiertos.bogota.gov.co/dataset/1ca41514-3671-41d6-8c3b-a970dc8c24a7/resource/16288e7f-0345-4680-84aa-40e987706ea8/download/parque.json',
    category: 'recreation',
    sourceDataset: 'parques-pot-bogota',
    getName: (props) => props.NOMBRE || props.nombre || null,
    getAddress: () => null,
    getSubcategory: (props) => {
      const nivel = (props.NIVEL || '').toLowerCase();
      if (nivel.includes('metropolitano') || nivel.includes('regional')) return 'park';
      if (nivel.includes('zonal') || nivel.includes('estructurante')) return 'park';
      const vocacion = (props.VOCACION || '').toLowerCase();
      if (vocacion.includes('deporte') || vocacion.includes('recreacion')) return 'playground';
      return 'park';
    },
    getSourceId: (props, i) => `parques-${props.OBJECTID || props.CODIGO_ID || i}`,
    localFile: 'parques.geojson',
  },
];

interface GeoJsonFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: Record<string, any>;
}

/**
 * Compute confidence score for an IDECA record.
 */
function computeIdecaConfidence(props: Record<string, any>, hasName: boolean): number {
  let score = 85; // Base confidence for government data
  if (hasName) score += 5;
  if (props.direccion || props.DIRECCION) score += 5;
  if (props.telefono || props.TELEFONO) score += 2;
  return Math.min(100, score);
}

/**
 * Extract coordinates from a GeoJSON geometry.
 * Handles Point and returns centroid for Polygon/MultiPolygon.
 */
function extractCoordinates(geometry: GeoJsonFeature['geometry']): { lng: number; lat: number } | null {
  if (!geometry || !geometry.coordinates) return null;

  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates;
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return { lng, lat };
    }
  }

  if (geometry.type === 'Polygon' && geometry.coordinates.length > 0) {
    // Compute centroid of the first ring
    const ring = (geometry.coordinates as any)[0] as number[][];
    if (ring && ring.length > 0) {
      let sumLng = 0, sumLat = 0;
      for (const [lng, lat] of ring) {
        sumLng += lng;
        sumLat += lat;
      }
      return { lng: sumLng / ring.length, lat: sumLat / ring.length };
    }
  }

  return null;
}

/**
 * Load GeoJSON from a local file or fetch from URL.
 * Prefers local file in the data/ directory to avoid TLS issues with IDECA.
 */
async function loadGeoJson(url: string, localFile?: string): Promise<GeoJsonFeature[]> {
  // Try local file first
  if (localFile) {
    const localPath = join(__dirname, '../../data', localFile);
    if (existsSync(localPath)) {
      console.log(`  Loading local file: ${localPath}`);
      const raw = readFileSync(localPath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        return data.features;
      }
      throw new Error(`Unexpected local file format: ${Object.keys(data).join(', ')}`);
    }
  }

  // Fall back to remote URL
  console.log(`  Fetching: ${url}`);
  const response = await fetch(url, {
    headers: { 'User-Agent': 'BogotaInsightsWidget/1.0' },
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as any;

  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return data.features;
  }

  throw new Error(`Unexpected response format: ${Object.keys(data).join(', ')}`);
}

/**
 * Ingest a single IDECA dataset into the pois table.
 */
export async function ingestIdecaDataset(dataset: IdecaDatasetConfig): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const result = { created: 0, updated: 0, skipped: 0, errors: 0 };

  const features = await loadGeoJson(dataset.url, dataset.localFile);
  console.log(`  Parsed ${features.length} features from ${dataset.name}`);

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const props = feature.properties || {};
    const coords = extractCoordinates(feature.geometry);

    if (!coords) {
      result.skipped++;
      continue;
    }

    // Validate coordinates are within Bogota bounds
    if (coords.lat < 4.45 || coords.lat > 4.84 || coords.lng < -74.27 || coords.lng > -73.88) {
      result.skipped++;
      continue;
    }

    const sourceId = `ideca-${dataset.sourceDataset}-${dataset.getSourceId(props, i)}`;
    const name = dataset.getName(props);
    const address = dataset.getAddress(props);
    const subcategory = dataset.getSubcategory(props);
    const confidence = computeIdecaConfidence(props, !!name);

    try {
      const upserted = await upsertPoi(
        'ideca',
        sourceId,
        dataset.sourceDataset,
        dataset.category,
        subcategory,
        name,
        name, // name_es is the same for IDECA
        coords.lng,
        coords.lat,
        address,
        confidence,
        props,
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
 * Ingest all IDECA datasets.
 */
export async function ingestAllIdecaDatasets(): Promise<void> {
  const syncRunId = await createSyncRun('ideca', 'full');
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalFetched = 0;
  let totalErrors = 0;

  try {
    for (const dataset of IDECA_DATASETS) {
      console.log(`\n--- Ingesting: ${dataset.name} ---`);
      try {
        const result = await ingestIdecaDataset(dataset);
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

    console.log(`\nIDECA ingestion complete: ${totalCreated} created, ${totalUpdated} updated, ${totalErrors} errors`);
  } catch (err: any) {
    await completeSyncRun(syncRunId, 'failed', {}, err.message, { stack: err.stack });
    throw err;
  }
}

export function getIdecaDatasets(): IdecaDatasetConfig[] {
  return IDECA_DATASETS;
}
