/**
 * Shared constants for Bogota Insights Widget
 */

import type { CategoryType } from './types';

export const DEFAULT_RADIUS = 1000; // meters
export const DEFAULT_LANG = 'es';
export const DEFAULT_THEME = 'light';

export const CACHE_TTL = {
  INSIGHTS: 24 * 60 * 60, // 24 hours
  POIS: 12 * 60 * 60, // 12 hours
  RATE_LIMIT: 120, // 2 minutes
  OVERPASS_STATUS: 5 * 60, // 5 minutes
};

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  transport: '#1976d2',
  commerce: '#f57c00',
  education: '#388e3c',
  health: '#d32f2f',
  recreation: '#7b1fa2',
};

export const SCORE_THRESHOLDS = {
  LOW: 40,
  MEDIUM: 60,
  GOOD: 80,
};

export const ESTRATO_COLORS = {
  1: '#D93025', // red
  2: '#E8710A', // dark orange
  3: '#F9AB00', // amber
  4: '#FBBC04', // yellow
  5: '#34A853', // green
  6: '#0D8043', // dark green
};

// OSM amenity tags mapped to categories
export const OSM_TAG_MAPPING: Record<CategoryType, string[]> = {
  transport: [
    'bus_station',
    'bus_stop',
    'railway=station',
    'bicycle_rental',
    'parking',
    'fuel',
  ],
  commerce: [
    'marketplace',
    'bank',
    'atm',
    'shop=supermarket',
    'shop=convenience',
    'shop=mall',
  ],
  education: ['school', 'university', 'college', 'kindergarten', 'library'],
  health: ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy'],
  recreation: [
    'restaurant',
    'cafe',
    'fast_food',
    'bar',
    'pub',
    'cinema',
    'theatre',
    'leisure=park',
    'leisure=playground',
    'leisure=sports_centre',
  ],
};

// IDECA dataset IDs (placeholders - update with actual dataset IDs)
export const IDECA_DATASETS = {
  schools: 'colegios-bogota',
  hospitals: 'hospitales-clinicas',
  libraries: 'bibliotecas-publicas',
  parks: 'parques-zonas-verdes',
  banks: 'entidades-financieras',
  equipamientos: 'equipamientos-colectivos',
};

// Scoring weights
// Calibrated for real estate: favor diversity over clustering (wealthy areas have spread-out services)
export const SCORING_WEIGHTS = {
  count: 0.30,
  proximity: 0.20,    // Reduced (don't penalize wealthy areas with spread-out POIs)
  diversity: 0.35,    // Reward variety of services
  quality: 0.15,      // Increased (higher-quality data = more reliable score)
};
