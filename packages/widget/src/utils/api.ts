import type { InsightsResponse } from '@bogota-insights/shared';

const CACHE_KEY_PREFIX = 'bogota-insights:';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface FetchOptions {
  lat: number;
  lng: number;
  radius?: number;
  lang?: 'es' | 'en';
  apiKey?: string;
  apiBaseUrl?: string;
}

function getCacheKey(opts: FetchOptions): string {
  return `${CACHE_KEY_PREFIX}${opts.lat.toFixed(4)}:${opts.lng.toFixed(4)}:${opts.radius ?? 1000}:${opts.lang ?? 'es'}`;
}

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__bi_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function getFromCache(key: string): InsightsResponse | null {
  if (!isLocalStorageAvailable()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { data, expires } = parsed;
    if (typeof expires !== 'number' || Date.now() > expires) {
      localStorage.removeItem(key);
      return null;
    }
    return data as InsightsResponse;
  } catch {
    return null;
  }
}

function setCache(key: string, data: InsightsResponse): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(key, JSON.stringify({ data, expires: Date.now() + CACHE_TTL_MS }));
  } catch {
    // localStorage might be full
  }
}

function resolveBaseUrl(apiBaseUrl?: string): string {
  const url = apiBaseUrl ?? 'http://localhost:3000';
  // Enforce HTTPS in production (non-localhost)
  if (url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    return url.replace('http://', 'https://');
  }
  return url;
}

export async function fetchInsights(opts: FetchOptions): Promise<InsightsResponse> {
  const cacheKey = getCacheKey(opts);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  const baseUrl = resolveBaseUrl(opts.apiBaseUrl);
  const params = new URLSearchParams({
    lat: String(opts.lat),
    lng: String(opts.lng),
    radius: String(opts.radius ?? 1000),
    lang: opts.lang ?? 'es',
  });

  const headers: Record<string, string> = {};
  if (opts.apiKey) {
    headers['X-API-Key'] = opts.apiKey;
  }

  const response = await fetch(`${baseUrl}/v1/insights?${params}`, { headers });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: { code: 'UNKNOWN', message: response.statusText } }));
    throw new APIError(err.error?.code ?? 'UNKNOWN', err.error?.message ?? 'Request failed');
  }

  const data: InsightsResponse = await response.json();
  setCache(cacheKey, data);
  return data;
}

export class APIError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'APIError';
  }
}

export function getMockData(lat: number, lng: number, radius: number): InsightsResponse {
  return {
    location: {
      lat,
      lng,
      address: 'Calle 85 #15-23, Bogota',
      neighborhood: 'Chapinero Alto',
      localidad: 'Chapinero',
      estrato: 4,
    },
    scores: {
      overall: 74,
      transport: 82,
      commerce: 71,
      education: 65,
      health: 58,
      recreation: 76,
    },
    categories: {
      transport: {
        score: 82,
        summary: 'Excelente conectividad de transporte',
        pois: [
          { id: '1', name: 'Estacion Calle 85', type: 'bus_station', category: 'transport', lat: lat + 0.001, lng: lng + 0.002, distance_m: 120, source: 'transmilenio' },
          { id: '2', name: 'Parada SITP Cra 15', type: 'bus_stop', category: 'transport', lat: lat + 0.002, lng: lng - 0.001, distance_m: 250, source: 'transmilenio' },
          { id: '3', name: 'Cicloruta Cra 11', type: 'bicycle_rental', category: 'transport', lat: lat - 0.001, lng: lng + 0.001, distance_m: 380, source: 'osm' },
        ],
        counts: { bus_station: 2, bus_stop: 12, bicycle_rental: 3 },
      },
      commerce: {
        score: 71,
        summary: 'Buena oferta comercial',
        pois: [
          { id: '4', name: 'Exito Express', type: 'supermarket', category: 'commerce', lat: lat + 0.0015, lng: lng - 0.001, distance_m: 180, source: 'osm' },
          { id: '5', name: 'Banco de Bogota', type: 'bank', category: 'commerce', lat: lat - 0.002, lng: lng + 0.001, distance_m: 320, source: 'ideca' },
          { id: '6', name: 'Centro Comercial Andino', type: 'mall', category: 'commerce', lat: lat + 0.003, lng: lng + 0.002, distance_m: 540, source: 'osm' },
        ],
        counts: { supermarket: 4, bank: 6, marketplace: 2, mall: 1 },
      },
      education: {
        score: 65,
        summary: 'Buena oferta educativa',
        pois: [
          { id: '7', name: 'Colegio San Bartolome', type: 'school', category: 'education', lat: lat - 0.002, lng: lng - 0.002, distance_m: 290, source: 'ideca' },
          { id: '8', name: 'Universidad Javeriana', type: 'university', category: 'education', lat: lat + 0.004, lng: lng - 0.003, distance_m: 620, source: 'ideca' },
          { id: '9', name: 'Biblioteca Publica Virgilio Barco', type: 'library', category: 'education', lat: lat - 0.003, lng: lng + 0.004, distance_m: 780, source: 'osm' },
        ],
        counts: { school: 4, university: 2, library: 1 },
      },
      health: {
        score: 58,
        summary: 'Oferta de salud moderada',
        pois: [
          { id: '10', name: 'Clinica del Country', type: 'hospital', category: 'health', lat: lat + 0.005, lng: lng + 0.003, distance_m: 850, source: 'ideca' },
          { id: '11', name: 'Drogueria Colsubsidio', type: 'pharmacy', category: 'health', lat: lat - 0.001, lng: lng - 0.001, distance_m: 150, source: 'osm' },
        ],
        counts: { hospital: 2, pharmacy: 5, doctors: 1 },
      },
      recreation: {
        score: 76,
        summary: 'Buena oferta recreativa',
        pois: [
          { id: '12', name: 'Parque de la 93', type: 'park', category: 'recreation', lat: lat + 0.002, lng: lng + 0.003, distance_m: 350, source: 'ideca' },
          { id: '13', name: 'Restaurante Andres Carne de Res', type: 'restaurant', category: 'recreation', lat: lat - 0.001, lng: lng + 0.002, distance_m: 200, source: 'osm' },
          { id: '14', name: 'Cafe Juan Valdez', type: 'cafe', category: 'recreation', lat: lat + 0.001, lng: lng - 0.001, distance_m: 90, source: 'osm' },
        ],
        counts: { park: 5, restaurant: 23, cafe: 8, cinema: 2 },
      },
    },
    meta: {
      data_timestamp: new Date().toISOString(),
      radius_m: radius,
      cache_hit: false,
      sources: ['ideca', 'osm', 'transmilenio'],
    },
  };
}
