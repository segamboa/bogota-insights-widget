import type { InsightsResponse, POI } from '@bogota-insights/shared';

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

// Mock profiles by approximate location
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMockProfile(lat: number, lng: number): any {
  // Use lat/lng to pick a profile
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;

  // Kennedy (lat ~4.629)
  if (lat < 4.63) {
    return {
      neighborhood: 'Kennedy',
      localidad: 'Kennedy',
      estrato: 2,
      scores: { overall: 48, transport: 55, commerce: 52, education: 45, health: 42, recreation: 38 },
      investment: { score: 82, signal: 'strong_buy' as const, summary: 'Alto potencial de valorizacion — infraestructura con espacio de mejora significativo' },
      categories: {
        transport: { score: 55, summary: 'Acceso a transporte en crecimiento', percentile: 35, cityMedian: 55, localMedian: 50, localPercentile: 42, trend: { direction: 'up' as const, delta: 6, monthsAgo: 1 } },
        commerce: { score: 52, summary: 'Comercio local en desarrollo', percentile: 30, cityMedian: 48, localMedian: 45, localPercentile: 38 },
        education: { score: 45, summary: 'Oferta educativa basica', percentile: 25, cityMedian: 52, localMedian: 42, localPercentile: 22 },
        health: { score: 42, summary: 'Servicios de salud limitados', percentile: 20, cityMedian: 50, localMedian: 40, localPercentile: 18, trend: { direction: 'up' as const, delta: 3, monthsAgo: 2 } },
        recreation: { score: 38, summary: 'Areas verdes escasas', percentile: 15, cityMedian: 45, localMedian: 35, localPercentile: 12 },
      },
      pois: {
        transport: [
          { id: '1', name: 'Parada SITP Calle 38 Sur', type: 'bus_stop', category: 'transport' as const, lat: lat + 0.001, lng: lng + 0.002, distance_m: 180, source: 'transmilenio' },
          { id: '2', name: 'Parada SITP Carrera 78', type: 'bus_stop', category: 'transport' as const, lat: lat + 0.002, lng: lng - 0.001, distance_m: 320, source: 'transmilenio' },
        ],
        commerce: [
          { id: '3', name: 'D1 Kennedy Central', type: 'supermarket', category: 'commerce' as const, lat: lat + 0.0015, lng: lng - 0.001, distance_m: 250, source: 'osm' },
          { id: '4', name: 'Tienda de barrio', type: 'tienda', category: 'commerce' as const, lat: lat - 0.002, lng: lng + 0.001, distance_m: 120, source: 'osm' },
        ],
        education: [
          { id: '5', name: 'Colegio Distrital Kennedy', type: 'school', category: 'education' as const, lat: lat - 0.002, lng: lng - 0.002, distance_m: 450, source: 'ideca' },
        ],
        health: [
          { id: '6', name: 'Puesto de salud Kennedy', type: 'clinic', category: 'health' as const, lat: lat + 0.005, lng: lng + 0.003, distance_m: 650, source: 'ideca' },
          { id: '7', name: 'Drogueria La Rebaja', type: 'pharmacy', category: 'health' as const, lat: lat - 0.001, lng: lng - 0.001, distance_m: 200, source: 'osm' },
        ],
        recreation: [
          { id: '8', name: 'Parque Kennedy', type: 'park', category: 'recreation' as const, lat: lat + 0.002, lng: lng + 0.003, distance_m: 500, source: 'ideca' },
        ],
      },
      counts: {
        transport: { bus_stop: 8, parada_sitp: 4 },
        commerce: { supermarket: 2, tienda: 5 },
        education: { school: 3, colegio: 1 },
        health: { clinic: 1, pharmacy: 3, doctors: 1 },
        recreation: { park: 2, playground: 1 },
      },
    };
  }

  // Usaquen (lat ~4.711)
  if (lat > 4.70) {
    return {
      neighborhood: 'Usaquen',
      localidad: 'Usaquen',
      estrato: 6,
      scores: { overall: 88, transport: 85, commerce: 90, education: 82, health: 86, recreation: 84 },
      investment: { score: 32, signal: 'watch' as const, summary: 'En observacion — area ya consolidada, limitado upside' },
      categories: {
        transport: { score: 85, summary: 'Excelente conectividad', percentile: 92, cityMedian: 55, localMedian: 80, localPercentile: 88, trend: { direction: 'stable' as const, delta: 1, monthsAgo: 1 } },
        commerce: { score: 90, summary: 'Oferta comercial premium', percentile: 96, cityMedian: 48, localMedian: 85, localPercentile: 94 },
        education: { score: 82, summary: 'Excelente oferta educativa', percentile: 88, cityMedian: 52, localMedian: 78, localPercentile: 82 },
        health: { score: 86, summary: 'Servicios de salud de alto nivel', percentile: 94, cityMedian: 50, localMedian: 82, localPercentile: 90 },
        recreation: { score: 84, summary: 'Amplia oferta recreativa', percentile: 90, cityMedian: 45, localMedian: 75, localPercentile: 86, trend: { direction: 'stable' as const, delta: 0, monthsAgo: 1 } },
      },
      pois: {
        transport: [
          { id: '1', name: 'Estacion Calle 116', type: 'bus_station', category: 'transport' as const, lat: lat + 0.001, lng: lng + 0.002, distance_m: 200, source: 'transmilenio' },
          { id: '2', name: 'Cicloruta Carrera 7', type: 'bicycle_rental', category: 'transport' as const, lat: lat + 0.002, lng: lng - 0.001, distance_m: 150, source: 'osm' },
        ],
        commerce: [
          { id: '3', name: 'Centro Comercial Unicentro', type: 'mall', category: 'commerce' as const, lat: lat + 0.0015, lng: lng - 0.001, distance_m: 400, source: 'osm' },
          { id: '4', name: 'Zona G Restaurantes', type: 'restaurante', category: 'commerce' as const, lat: lat - 0.002, lng: lng + 0.001, distance_m: 300, source: 'osm' },
        ],
        education: [
          { id: '5', name: 'Colegio San Bartolome', type: 'school', category: 'education' as const, lat: lat - 0.002, lng: lng - 0.002, distance_m: 350, source: 'ideca' },
        ],
        health: [
          { id: '6', name: 'Clinica del Country', type: 'hospital', category: 'health' as const, lat: lat + 0.005, lng: lng + 0.003, distance_m: 600, source: 'ideca' },
        ],
        recreation: [
          { id: '7', name: 'Parque de la 93', type: 'park', category: 'recreation' as const, lat: lat + 0.002, lng: lng + 0.003, distance_m: 450, source: 'ideca' },
        ],
      },
      counts: {
        transport: { bus_station: 3, bus_stop: 10, bicycle_rental: 4 },
        commerce: { mall: 2, restaurante: 25, cafe: 12, bank: 8 },
        education: { school: 5, university: 2, library: 2 },
        health: { hospital: 3, clinic: 4, pharmacy: 6 },
        recreation: { park: 6, cinema: 3, restaurant: 20, cafe: 10 },
      },
    };
  }

  // Suba (lat ~4.74)
  if (lat > 4.73) {
    return {
      neighborhood: 'Suba',
      localidad: 'Suba',
      estrato: 3,
      scores: { overall: 62, transport: 68, commerce: 58, education: 64, health: 55, recreation: 60 },
      investment: { score: 55, signal: 'hold' as const, summary: 'Mercado estable — rendimiento predecible' },
      categories: {
        transport: { score: 68, summary: 'Buena conectividad', percentile: 58, cityMedian: 55, localMedian: 62, localPercentile: 52 },
        commerce: { score: 58, summary: 'Comercio en crecimiento', percentile: 45, cityMedian: 48, localMedian: 52, localPercentile: 42 },
        education: { score: 64, summary: 'Buena oferta educativa', percentile: 55, cityMedian: 52, localMedian: 60, localPercentile: 50 },
        health: { score: 55, summary: 'Servicios de salud basicos', percentile: 40, cityMedian: 50, localMedian: 48, localPercentile: 35 },
        recreation: { score: 60, summary: 'Areas recreativas moderadas', percentile: 50, cityMedian: 45, localMedian: 55, localPercentile: 48 },
      },
      pois: {
        transport: [
          { id: '1', name: 'Estacion Suba', type: 'bus_station', category: 'transport' as const, lat: lat + 0.001, lng: lng + 0.002, distance_m: 250, source: 'transmilenio' },
        ],
        commerce: [
          { id: '2', name: 'Exito Suba', type: 'supermarket', category: 'commerce' as const, lat: lat + 0.0015, lng: lng - 0.001, distance_m: 300, source: 'osm' },
        ],
        education: [
          { id: '3', name: 'Colegio Suba', type: 'school', category: 'education' as const, lat: lat - 0.002, lng: lng - 0.002, distance_m: 400, source: 'ideca' },
        ],
        health: [
          { id: '4', name: 'Clinica Suba', type: 'clinic', category: 'health' as const, lat: lat + 0.005, lng: lng + 0.003, distance_m: 500, source: 'ideca' },
        ],
        recreation: [
          { id: '5', name: 'Parque Suba', type: 'park', category: 'recreation' as const, lat: lat + 0.002, lng: lng + 0.003, distance_m: 350, source: 'ideca' },
        ],
      },
      counts: {
        transport: { bus_station: 2, bus_stop: 6 },
        commerce: { supermarket: 3, tienda: 8, bank: 3 },
        education: { school: 4, university: 1 },
        health: { clinic: 2, pharmacy: 4, doctors: 2 },
        recreation: { park: 3, playground: 2 },
      },
    };
  }

  // Centro / La Candelaria (lat ~4.598)
  if (lat < 4.60) {
    return {
      neighborhood: 'La Candelaria',
      localidad: 'Santa Fe',
      estrato: 3,
      scores: { overall: 52, transport: 75, commerce: 48, education: 55, health: 35, recreation: 42 },
      investment: { score: 75, signal: 'buy' as const, summary: 'Buena oportunidad de inversion — zona historica con potencial de revitalizacion' },
      categories: {
        transport: { score: 75, summary: 'Excelente acceso al centro', percentile: 78, cityMedian: 55, localMedian: 68, localPercentile: 72, trend: { direction: 'up' as const, delta: 5, monthsAgo: 1 } },
        commerce: { score: 48, summary: 'Comercio turistico concentrado', percentile: 35, cityMedian: 48, localMedian: 42, localPercentile: 32 },
        education: { score: 55, summary: 'Universidades cercanas', percentile: 48, cityMedian: 52, localMedian: 55, localPercentile: 45 },
        health: { score: 35, summary: 'Servicios de salud muy limitados', percentile: 12, cityMedian: 50, localMedian: 35, localPercentile: 10, trend: { direction: 'down' as const, delta: -2, monthsAgo: 1 } },
        recreation: { score: 42, summary: 'Patrimonio cultural y museos', percentile: 40, cityMedian: 45, localMedian: 40, localPercentile: 38 },
      },
      pois: {
        transport: [
          { id: '1', name: 'TransMilenio Museo del Oro', type: 'bus_station', category: 'transport' as const, lat: lat + 0.001, lng: lng + 0.002, distance_m: 150, source: 'transmilenio' },
          { id: '2', name: 'SITP Carrera 7', type: 'bus_stop', category: 'transport' as const, lat: lat + 0.002, lng: lng - 0.001, distance_m: 200, source: 'transmilenio' },
        ],
        commerce: [
          { id: '3', name: 'Cafe Pasaje', type: 'cafe', category: 'commerce' as const, lat: lat + 0.0015, lng: lng - 0.001, distance_m: 100, source: 'osm' },
        ],
        education: [
          { id: '4', name: 'Universidad de los Andes', type: 'university', category: 'education' as const, lat: lat - 0.002, lng: lng - 0.002, distance_m: 800, source: 'ideca' },
        ],
        health: [
          { id: '5', name: 'Farmacia Cruz Verde', type: 'pharmacy', category: 'health' as const, lat: lat - 0.001, lng: lng - 0.001, distance_m: 300, source: 'osm' },
        ],
        recreation: [
          { id: '6', name: 'Museo del Oro', type: 'museum', category: 'recreation' as const, lat: lat + 0.002, lng: lng + 0.003, distance_m: 250, source: 'ideca' },
          { id: '7', name: 'Plaza de Bolivar', type: 'attraction', category: 'recreation' as const, lat: lat - 0.001, lng: lng + 0.001, distance_m: 400, source: 'osm' },
        ],
      },
      counts: {
        transport: { bus_station: 4, bus_stop: 8 },
        commerce: { cafe: 8, restaurante: 5, tienda: 3 },
        education: { university: 2, school: 1 },
        health: { pharmacy: 2, clinic: 1 },
        recreation: { museum: 4, attraction: 3, park: 2, historic_site: 2 },
      },
    };
  }

  // Default: Chapinero (lat ~4.653)
  return {
    neighborhood: 'Chapinero Alto',
    localidad: 'Chapinero',
    estrato: 4,
    scores: { overall: 74, transport: 82, commerce: 71, education: 65, health: 58, recreation: 76 },
    investment: { score: 48, signal: 'hold' as const, summary: 'Mercado estable — area bien consolidada con crecimiento moderado' },
    categories: {
      transport: { score: 82, summary: 'Excelente conectividad de transporte', percentile: 88, cityMedian: 55, localMedian: 72, localPercentile: 76, trend: { direction: 'up' as const, delta: 4, monthsAgo: 1 } },
      commerce: { score: 71, summary: 'Buena oferta comercial', percentile: 62, cityMedian: 48, localMedian: 58, localPercentile: 55, trend: { direction: 'stable' as const, delta: 1, monthsAgo: 1 } },
      education: { score: 65, summary: 'Buena oferta educativa', percentile: 58, cityMedian: 52, localMedian: 60, localPercentile: 48 },
      health: { score: 58, summary: 'Oferta de salud moderada', percentile: 45, cityMedian: 50, localMedian: 55, localPercentile: 38, trend: { direction: 'down' as const, delta: -3, monthsAgo: 2 } },
      recreation: { score: 76, summary: 'Buena oferta recreativa', percentile: 92, cityMedian: 45, localMedian: 68, localPercentile: 84, trend: { direction: 'up' as const, delta: 5, monthsAgo: 1 } },
    },
    pois: {
      transport: [
        { id: '1', name: 'Estacion Calle 85', type: 'bus_station', category: 'transport' as const, lat: lat + 0.001, lng: lng + 0.002, distance_m: 120, source: 'transmilenio' },
        { id: '2', name: 'Parada SITP Cra 15', type: 'bus_stop', category: 'transport' as const, lat: lat + 0.002, lng: lng - 0.001, distance_m: 250, source: 'transmilenio' },
        { id: '3', name: 'Cicloruta Cra 11', type: 'bicycle_rental', category: 'transport' as const, lat: lat - 0.001, lng: lng + 0.001, distance_m: 380, source: 'osm' },
      ],
      commerce: [
        { id: '4', name: 'Exito Express', type: 'supermarket', category: 'commerce' as const, lat: lat + 0.0015, lng: lng - 0.001, distance_m: 180, source: 'osm' },
        { id: '5', name: 'Banco de Bogota', type: 'bank', category: 'commerce' as const, lat: lat - 0.002, lng: lng + 0.001, distance_m: 320, source: 'ideca' },
        { id: '6', name: 'Centro Comercial Andino', type: 'mall', category: 'commerce' as const, lat: lat + 0.003, lng: lng + 0.002, distance_m: 540, source: 'osm' },
      ],
      education: [
        { id: '7', name: 'Colegio San Bartolome', type: 'school', category: 'education' as const, lat: lat - 0.002, lng: lng - 0.002, distance_m: 290, source: 'ideca' },
        { id: '8', name: 'Universidad Javeriana', type: 'university', category: 'education' as const, lat: lat + 0.004, lng: lng - 0.003, distance_m: 620, source: 'ideca' },
        { id: '9', name: 'Biblioteca Publica Virgilio Barco', type: 'library', category: 'education' as const, lat: lat - 0.003, lng: lng + 0.004, distance_m: 780, source: 'osm' },
      ],
      health: [
        { id: '10', name: 'Clinica del Country', type: 'hospital', category: 'health' as const, lat: lat + 0.005, lng: lng + 0.003, distance_m: 850, source: 'ideca' },
        { id: '11', name: 'Drogueria Colsubsidio', type: 'pharmacy', category: 'health' as const, lat: lat - 0.001, lng: lng - 0.001, distance_m: 150, source: 'osm' },
      ],
      recreation: [
        { id: '12', name: 'Parque de la 93', type: 'park', category: 'recreation' as const, lat: lat + 0.002, lng: lng + 0.003, distance_m: 350, source: 'ideca' },
        { id: '13', name: 'Restaurante Andres Carne de Res', type: 'restaurant', category: 'recreation' as const, lat: lat - 0.001, lng: lng + 0.002, distance_m: 200, source: 'osm' },
        { id: '14', name: 'Cafe Juan Valdez', type: 'cafe', category: 'recreation' as const, lat: lat + 0.001, lng: lng - 0.001, distance_m: 90, source: 'osm' },
      ],
    },
    counts: {
      transport: { bus_station: 2, bus_stop: 12, bicycle_rental: 3 },
      commerce: { supermarket: 4, bank: 6, marketplace: 2, mall: 1 },
      education: { school: 4, university: 2, library: 1 },
      health: { hospital: 2, pharmacy: 5, doctors: 1 },
      recreation: { park: 5, restaurant: 23, cafe: 8, cinema: 2 },
    },
  };
}

export function getMockData(lat: number, lng: number, radius: number): InsightsResponse {
  const profile = getMockProfile(lat, lng);

  const basePois = profile.pois;
  const baseCounts = profile.counts;

  return {
    location: {
      lat,
      lng,
      address: `Calle ejemplo, ${profile.neighborhood}`,
      neighborhood: profile.neighborhood,
      localidad: profile.localidad,
      estrato: profile.estrato,
    },
    scores: {
      overall: profile.scores.overall,
      transport: profile.scores.transport,
      commerce: profile.scores.commerce,
      education: profile.scores.education,
      health: profile.scores.health,
      recreation: profile.scores.recreation,
      investment: profile.investment.score,
    },
    categories: {
      transport: {
        score: profile.categories.transport.score,
        summary: profile.categories.transport.summary,
        pois: (basePois.transport || []) as POI[],
        counts: (baseCounts.transport || {}) as Record<string, number>,
        percentile: profile.categories.transport.percentile,
        cityMedian: profile.categories.transport.cityMedian,
        localMedian: profile.categories.transport.localMedian,
        localPercentile: profile.categories.transport.localPercentile,
        trend: profile.categories.transport.trend,
      },
      commerce: {
        score: profile.categories.commerce.score,
        summary: profile.categories.commerce.summary,
        pois: (basePois.commerce || []) as POI[],
        counts: (baseCounts.commerce || {}) as Record<string, number>,
        percentile: profile.categories.commerce.percentile,
        cityMedian: profile.categories.commerce.cityMedian,
        localMedian: profile.categories.commerce.localMedian,
        localPercentile: profile.categories.commerce.localPercentile,
        trend: profile.categories.commerce.trend,
      },
      education: {
        score: profile.categories.education.score,
        summary: profile.categories.education.summary,
        pois: (basePois.education || []) as POI[],
        counts: (baseCounts.education || {}) as Record<string, number>,
        percentile: profile.categories.education.percentile,
        cityMedian: profile.categories.education.cityMedian,
        localMedian: profile.categories.education.localMedian,
        localPercentile: profile.categories.education.localPercentile,
        trend: profile.categories.education.trend,
      },
      health: {
        score: profile.categories.health.score,
        summary: profile.categories.health.summary,
        pois: (basePois.health || []) as POI[],
        counts: (baseCounts.health || {}) as Record<string, number>,
        percentile: profile.categories.health.percentile,
        cityMedian: profile.categories.health.cityMedian,
        localMedian: profile.categories.health.localMedian,
        localPercentile: profile.categories.health.localPercentile,
        trend: profile.categories.health.trend,
      },
      recreation: {
        score: profile.categories.recreation.score,
        summary: profile.categories.recreation.summary,
        pois: (basePois.recreation || []) as POI[],
        counts: (baseCounts.recreation || {}) as Record<string, number>,
        percentile: profile.categories.recreation.percentile,
        cityMedian: profile.categories.recreation.cityMedian,
        localMedian: profile.categories.recreation.localMedian,
        localPercentile: profile.categories.recreation.localPercentile,
        trend: profile.categories.recreation.trend,
      },
    },
    investment: profile.investment,
    meta: {
      data_timestamp: new Date().toISOString(),
      radius_m: radius,
      cache_hit: false,
      sources: ['ideca', 'osm', 'transmilenio'],
    },
  };
}
