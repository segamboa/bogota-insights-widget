/**
 * Shared TypeScript types for Bogota Insights Widget
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export const BOGOTA_BOUNDS: BoundingBox = {
  north: 4.84,
  south: 4.45,
  east: -73.88,
  west: -74.27,
};

export type Estrato = 1 | 2 | 3 | 4 | 5 | 6;

export interface Location {
  lat: number;
  lng: number;
  address?: string;
  neighborhood?: string;
  localidad?: string;
  estrato?: Estrato;
}

export type CategoryType = 'transport' | 'commerce' | 'education' | 'health' | 'recreation';

export interface CategoryScore {
  score: number; // 0-100
  summary: string;
  pois: POI[];
  counts: Record<string, number>;
  /** Percentile within Bogotá urban distribution (0-100). Higher = better than more locations. */
  percentile?: number;
  /** City median score for this category (context for comparison). */
  cityMedian?: number;
}

export interface POI {
  id: string;
  name: string;
  type: string;
  category: CategoryType;
  lat: number;
  lng: number;
  distance_m: number;
  source: 'ideca' | 'osm' | 'transmilenio';
  tags?: Record<string, string>;
}

export interface InsightsResponse {
  location: Location;
  scores: {
    overall: number;
    transport: number;
    commerce: number;
    education: number;
    health: number;
    recreation: number;
  };
  categories: Record<CategoryType, CategoryScore>;
  meta: {
    data_timestamp: string;
    radius_m: number;
    cache_hit: boolean;
    sources: string[];
  };
}

export interface WidgetConfig {
  lat: number;
  lng: number;
  radius?: number; // meters, default 1000
  lang?: 'es' | 'en'; // default 'es'
  theme?: 'light' | 'dark'; // default 'light'
  apiKey: string;
  compact?: boolean;
  showMap?: boolean;
  categories?: CategoryType[];
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export const ERROR_CODES = {
  INVALID_COORDINATES: 'INVALID_COORDINATES',
  OUTSIDE_COVERAGE: 'OUTSIDE_COVERAGE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
} as const;
