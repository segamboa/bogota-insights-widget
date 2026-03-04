import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { upsertPoi, createSyncRun, completeSyncRun } from '../db/queries.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');

const TM_STATIONS_URL = 'https://gis.transmilenio.gov.co/arcgis/rest/services/Troncal/consulta_estaciones_troncales/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultRecordCount=500';
const TM_LOCAL_FILE = 'tm-estaciones.geojson';

interface GeoJsonFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: Record<string, any>;
}

/**
 * Load TransMilenio stations from local file or Esri REST service.
 */
async function loadStations(): Promise<GeoJsonFeature[]> {
  // Try local file first
  const localPath = join(DATA_DIR, TM_LOCAL_FILE);
  if (existsSync(localPath)) {
    console.log(`  Loading local file: ${localPath}`);
    const raw = readFileSync(localPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      return data.features;
    }
  }

  // Fall back to remote URL
  console.log(`  Fetching: ${TM_STATIONS_URL}`);
  const response = await fetch(TM_STATIONS_URL, {
    headers: { 'User-Agent': 'BogotaInsightsWidget/1.0' },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as any;
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return data.features;
  }

  throw new Error('Unexpected response format from TransMilenio Esri REST');
}

/**
 * Determine subcategory from station properties.
 */
function getSubcategory(props: Record<string, any>): string {
  const tipo = String(props.tipo_estacion || '').toLowerCase();
  const nombre = String(props.nombre_estacion || '').toLowerCase();

  if (nombre.includes('portal')) return 'bus_station';
  if (tipo.includes('cabecera') || tipo.includes('portal')) return 'bus_station';
  if (tipo.includes('intermedi') || tipo.includes('sencill')) return 'bus_stop';
  return 'bus_station'; // TransMilenio troncal stations are generally major
}

/**
 * Compute confidence for TransMilenio station.
 */
function computeConfidence(props: Record<string, any>): number {
  let score = 92; // High base confidence for official data
  if (props.nombre_estacion) score += 3;
  if (props.ubicacion_estacion) score += 3;
  return Math.min(100, score);
}

/**
 * Ingest TransMilenio stations into the pois table.
 */
export async function ingestTransmilenioStops(): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}> {
  const syncRunId = await createSyncRun('transmilenio', 'full');
  const result = { created: 0, updated: 0, skipped: 0, errors: 0 };

  try {
    const features = await loadStations();
    console.log(`  Loaded ${features.length} TransMilenio stations`);

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const props = feature.properties || {};

      if (!feature.geometry || feature.geometry.type !== 'Point') {
        result.skipped++;
        continue;
      }

      const [lng, lat] = feature.geometry.coordinates;

      // Validate coordinates are within Bogota bounds
      if (lat < 4.45 || lat > 4.84 || lng < -74.27 || lng > -73.88) {
        result.skipped++;
        continue;
      }

      const sourceId = `tm-${props.objectid || props.numero_estacion || i}`;
      const name = props.nombre_estacion || 'Estacion TransMilenio';
      const address = props.ubicacion_estacion || null;
      const subcategory = getSubcategory(props);
      const confidence = computeConfidence(props);

      try {
        const upserted = await upsertPoi(
          'transmilenio',
          sourceId,
          'estaciones-troncales',
          'transport',
          subcategory,
          name,
          name,
          lng,
          lat,
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

    await completeSyncRun(
      syncRunId,
      result.errors > 0 ? 'partial' : 'completed',
      {
        records_fetched: features.length,
        records_created: result.created,
        records_updated: result.updated,
      },
    );

    console.log(`  TransMilenio ingestion: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);
  } catch (err: any) {
    await completeSyncRun(syncRunId, 'failed', {}, err.message, { stack: err.stack });
    throw err;
  }

  return result;
}
