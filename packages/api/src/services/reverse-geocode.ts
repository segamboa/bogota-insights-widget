/**
 * Reverse geocoding for Bogotá neighborhood names.
 *
 * Uses Nominatim (OpenStreetMap) with Redis caching.
 * Falls back to null if the service is unavailable.
 */

import { getCache, setCache } from '../cache/redis.js';

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 1 week
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
}

interface NominatimResponse {
  address?: NominatimAddress;
  display_name?: string;
}

function buildCacheKey(lat: number, lng: number): string {
  // Round to 4 decimals (~11m precision) for cache stability
  return `neighborhood:${lat.toFixed(4)}:${lng.toFixed(4)}`;
}

/**
 * Get neighborhood name for coordinates.
 * Returns null if unable to resolve.
 */
export async function getNeighborhood(
  lat: number,
  lng: number,
): Promise<string | null> {
  const cacheKey = buildCacheKey(lat, lng);

  // 1. Check Redis cache
  const cached = await getCache(cacheKey);
  if (cached) {
    return cached === '__null__' ? null : cached;
  }

  // 2. Call Nominatim
  try {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=es&zoom=15`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BogotaInsightsWidget/1.0' },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    const data: NominatimResponse = await response.json();
    const address = data.address;

    // Pick the most specific name available
    const name =
      address?.neighbourhood ||
      address?.suburb ||
      address?.city_district ||
      null;

    // 3. Store in cache
    await setCache(cacheKey, name ?? '__null__', CACHE_TTL_SECONDS);

    return name ?? null;
  } catch (err) {
    // Fail silently — neighborhood is optional UX sugar
    await setCache(cacheKey, '__null__', 300); // short cache for failures
    return null;
  }
}
