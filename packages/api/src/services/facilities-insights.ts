/**
 * Facilities-focused insights and scoring
 * Designed for real estate - highlights strengths and accessibility
 */

import type { CategoryType, POI } from '@bogota-insights/shared';
import type { PoiRow } from '../db/queries.js';
import { findPoisWithinRadius, getCategoryCounts } from '../db/queries.js';
import { pool } from '../db/connection.js';

export interface FacilityWithAccess {
  id: string;
  name: string;
  category: CategoryType;
  subcategory: string;
  distanceM: number;
  walkingTimeMin: number;
  drivingTimeMin: number | null;
  isPremium: boolean;
  source: string;
}

export interface CategoryStrength {
  category: CategoryType;
  score: number;
  label: string;
  icon: string;
  topFacilities: FacilityWithAccess[];
  totalNearby: number;
  percentile: number;
}

export interface FacilitiesInsights {
  overallScore: number;
  scoreLabel: string;
  stars: number;
  mainStrength: CategoryStrength;
  secondaryStrengths: CategoryStrength[];
  topFacilities: FacilityWithAccess[];
  accessibility: {
    walkable: boolean;
    walkScore: number;
    carDependent: boolean;
  };
  cityPercentile: number;
  summary: string;
}

// Walking speed: 5 km/h = 83 m/min
// Driving speed in city: 25 km/h = 417 m/min (with traffic)
const WALKING_SPEED_MPM = 83;
const DRIVING_SPEED_MPM = 417;

// Premium facility thresholds (for highlighting)
const PREMIUM_FACILITIES: Record<string, string[]> = {
  transport: ['transmilenio', 'bus_station'],
  commerce: ['centro_comercial', 'supermarket', 'mall'],
  education: ['university', 'school', 'college'],
  health: ['hospital', 'clinic'],
  recreation: ['park', 'gym', 'sports_centre'],
};

/**
 * Calculate walking and driving times
 */
function calculateAccessTimes(distanceM: number): { walk: number; drive: number | null } {
  const walkTime = Math.round(distanceM / WALKING_SPEED_MPM);
  // Only show driving time if walking takes more than 15 minutes
  const driveTime = walkTime > 15 ? Math.round(distanceM / DRIVING_SPEED_MPM) : null;
  return { walk: walkTime, drive: driveTime };
}

/**
 * Convert POI row to facility with access info
 */
function toFacility(poi: PoiRow): FacilityWithAccess {
  const times = calculateAccessTimes(poi.distance_m);
  const isPremium = PREMIUM_FACILITIES[poi.category]?.includes(poi.subcategory) || false;
  
  return {
    id: String(poi.id),
    name: poi.name || poi.name_es || 'Sin nombre',
    category: poi.category,
    subcategory: poi.subcategory,
    distanceM: Math.round(poi.distance_m),
    walkingTimeMin: times.walk,
    drivingTimeMin: times.drive,
    isPremium,
    source: poi.source,
  };
}

/**
 * Get score label and stars
 */
function getScorePresentation(score: number): { label: string; stars: number } {
  if (score >= 85) return { label: 'Excelente', stars: 5 };
  if (score >= 70) return { label: 'Muy Bueno', stars: 4 };
  if (score >= 55) return { label: 'Bueno', stars: 3 };
  if (score >= 40) return { label: 'Aceptable', stars: 2 };
  return { label: 'Básico', stars: 1 };
}

/**
 * Calculate city percentile based on heatmap data
 */
async function calculateCityPercentile(
  lat: number,
  lng: number,
  radiusM: number
): Promise<number> {
  // Get current cell's overall score
  const currentResult = await pool.query(
    `SELECT score_overall FROM heatmap_cells 
     WHERE ST_DWithin(
       geom, 
       ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
       500
     )
     ORDER BY ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)
     LIMIT 1`,
    [lng, lat]
  );

  if (currentResult.rows.length === 0) return 50;

  const currentScore = currentResult.rows[0].score_overall;

  // Count cells with lower scores
  const percentileResult = await pool.query(
    `SELECT 
      COUNT(*) FILTER (WHERE score_overall < $1) as lower,
      COUNT(*) as total
    FROM heatmap_cells`,
    [currentScore]
  );

  const { lower, total } = percentileResult.rows[0];
  return Math.round((lower / total) * 100);
}

/**
 * Get facilities-focused insights for a location
 */
export async function getFacilitiesInsights(
  lat: number,
  lng: number,
  radiusM: number = 1000,
  lang: string = 'es'
): Promise<FacilitiesInsights> {
  // Get all POIs
  const allPois = await findPoisWithinRadius(lng, lat, radiusM);
  
  // Group by category
  const poisByCategory: Record<CategoryType, PoiRow[]> = {
    transport: [],
    commerce: [],
    education: [],
    health: [],
    recreation: [],
  };
  
  for (const poi of allPois) {
    if (poisByCategory[poi.category]) {
      poisByCategory[poi.category].push(poi);
    }
  }

  // Calculate category strengths
  const categoryStrengths: CategoryStrength[] = [];
  
  for (const category of Object.keys(poisByCategory) as CategoryType[]) {
    const pois = poisByCategory[category];
    if (pois.length === 0) continue;

    // Get top 3 facilities for this category
    const topFacilities = pois
      .slice(0, 3)
      .map(toFacility);

    // Calculate category score based on count and proximity
    const countScore = Math.min(pois.length / 5, 1) * 40; // Max 40 points for count
    const proximityScore = pois.slice(0, 5).reduce((sum, p) => {
      const proximity = Math.max(0, 1 - p.distance_m / radiusM);
      return sum + proximity * 12; // Max 12 points per nearby POI
    }, 0);
    
    const score = Math.round(Math.min(40 + countScore + proximityScore, 100));
    
    // Get percentile for this category
    const percentile = await calculateCategoryPercentile(category, pois.length);

    categoryStrengths.push({
      category,
      score,
      label: getCategoryLabel(category, lang),
      icon: getCategoryIcon(category),
      topFacilities,
      totalNearby: pois.length,
      percentile,
    });
  }

  // Sort by score
  categoryStrengths.sort((a, b) => b.score - a.score);

  // Main strength is highest score
  const mainStrength = categoryStrengths[0];
  const secondaryStrengths = categoryStrengths.slice(1, 3);

  // Overall score is weighted average
  const overallScore = Math.round(
    categoryStrengths.reduce((sum, cs) => sum + cs.score, 0) / 
    Math.max(categoryStrengths.length, 1)
  );

  // Adjust overall to minimum 60 for real estate appeal
  const adjustedOverall = Math.round(60 + (overallScore / 100) * 40);

  const { label: scoreLabel, stars } = getScorePresentation(adjustedOverall);

  // Top facilities across all categories
  const topFacilities = allPois
    .slice(0, 5)
    .map(toFacility);

  // Calculate accessibility
  const walkScore = calculateWalkScore(allPois);
  const cityPercentile = await calculateCityPercentile(lat, lng, radiusM);

  // Generate summary
  const summary = generateSummary(
    mainStrength,
    secondaryStrengths[0],
    topFacilities.length,
    walkScore,
    lang
  );

  return {
    overallScore: adjustedOverall,
    scoreLabel,
    stars,
    mainStrength,
    secondaryStrengths,
    topFacilities,
    accessibility: {
      walkable: walkScore > 70,
      walkScore,
      carDependent: walkScore < 40,
    },
    cityPercentile,
    summary,
  };
}

/**
 * Calculate walk score (0-100)
 */
function calculateWalkScore(pois: PoiRow[]): number {
  if (pois.length === 0) return 0;
  
  // Score based on having diverse facilities within walking distance
  const walkingDistance = 800; // 800m = ~10 min walk
  const walkablePois = pois.filter(p => p.distance_m <= walkingDistance);
  
  // Points for each category represented
  const categories = new Set(walkablePois.map(p => p.category));
  const categoryPoints = categories.size * 15;
  
  // Points for quantity
  const quantityPoints = Math.min(walkablePois.length * 2, 30);
  
  // Points for proximity (closer = better)
  const proximityPoints = walkablePois.slice(0, 10).reduce((sum, p) => {
    return sum + Math.max(0, (walkingDistance - p.distance_m) / walkingDistance) * 5;
  }, 0);

  return Math.round(Math.min(categoryPoints + quantityPoints + proximityPoints, 100));
}

/**
 * Calculate percentile for a category based on POI count
 */
async function calculateCategoryPercentile(
  category: CategoryType,
  count: number
): Promise<number> {
  const result = await pool.query(
    `WITH cell_counts AS (
      SELECT geohash_6, COUNT(*) as cnt
      FROM pois p
      JOIN heatmap_cells h ON ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(h.lng_center, h.lat_center), 4326)::geography,
        1000
      )
      WHERE p.category = $1 AND p.is_canonical = true
      GROUP BY geohash_6
    )
    SELECT 
      COUNT(*) FILTER (WHERE cnt < $2) as lower,
      COUNT(*) as total
    FROM cell_counts`,
    [category, count]
  );

  if (result.rows[0].total === 0) return 50;
  return Math.round((result.rows[0].lower / result.rows[0].total) * 100);
}

/**
 * Get category label
 */
function getCategoryLabel(category: CategoryType, lang: string): string {
  const labels: Record<CategoryType, Record<string, string>> = {
    transport: { es: 'Conectividad', en: 'Connectivity' },
    commerce: { es: 'Comercio', en: 'Commerce' },
    education: { es: 'Educación', en: 'Education' },
    health: { es: 'Salud', en: 'Health' },
    recreation: { es: 'Recreación', en: 'Recreation' },
  };
  return labels[category][lang] || labels[category]['es'];
}

/**
 * Get category icon
 */
function getCategoryIcon(category: CategoryType): string {
  const icons: Record<CategoryType, string> = {
    transport: '🚌',
    commerce: '🛒',
    education: '🎓',
    health: '🏥',
    recreation: '🌳',
  };
  return icons[category];
}

/**
 * Generate human-readable summary
 */
function generateSummary(
  mainStrength: CategoryStrength,
  secondaryStrength: CategoryStrength | undefined,
  totalFacilities: number,
  walkScore: number,
  lang: string
): string {
  if (lang === 'en') {
    let summary = `Area with excellent ${mainStrength.label.toLowerCase()}`;
    if (secondaryStrength) {
      summary += ` and good ${secondaryStrength.label.toLowerCase()}`;
    }
    summary += `. ${totalFacilities} facilities within 1km.`;
    if (walkScore > 70) {
      summary += ' Highly walkable.';
    }
    return summary;
  }

  let summary = `Zona con excelente ${mainStrength.label.toLowerCase()}`;
  if (secondaryStrength) {
    summary += ` y buena ${secondaryStrength.label.toLowerCase()}`;
  }
  summary += `. ${totalFacilities} facilidades dentro de 1km.`;
  if (walkScore > 70) {
    summary += ' Ideal para caminar.';
  }
  return summary;
}

// Test
if (process.argv[1] && process.argv[1].includes('facilities-insights')) {
  const lat = parseFloat(process.argv[2] || '4.65');
  const lng = parseFloat(process.argv[3] || '-74.08');
  
  getFacilitiesInsights(lat, lng)
    .then(insights => {
      console.log(JSON.stringify(insights, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}
