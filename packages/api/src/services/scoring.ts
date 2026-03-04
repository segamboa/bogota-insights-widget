import type { CategoryType } from '@bogota-insights/shared';
import { SCORING_WEIGHTS } from '@bogota-insights/shared';
import type { PoiRow } from '../db/queries.js';

/**
 * Average POI counts per category within 1000m radius for Bogota.
 * Calibrated based on load test data across 11 diverse neighborhoods.
 * Optimized for real estate use: balanced differentiation without extreme scores.
 */
const BOGOTA_AVERAGES: Record<CategoryType, number> = {
  transport: 25,      // Calibrated avg after analysis (SITP + TransMilenio)
  commerce: 90,       // Calibrated avg after pharmacy dedup (OSM)
  education: 15,      // Calibrated avg (IDECA + OSM with cross-source dedup)
  health: 20,         // Calibrated avg after analysis (IDECA + OSM)
  recreation: 30,     // Calibrated avg after analysis (IDECA parks)
};

/**
 * Expected subcategory diversity per category.
 */
const EXPECTED_DIVERSITY: Record<CategoryType, number> = {
  transport: 3,  // bus_station (TransMilenio), bus_stop (TransMilenio), parada_sitp (OSM)
  commerce: 6,   // restaurante, cafe, banco, supermercado, tienda, centro_comercial
  education: 4,  // school, university, library, kindergarten
  health: 4,     // hospital, clinic, doctors, dentist
  recreation: 3, // park, playground, cinema
};

interface CategoryScoreResult {
  score: number;
  countScore: number;
  proximityScore: number;
  diversityScore: number;
  qualityScore: number;
}

/**
 * Compute a category score (0-100) from a list of POIs.
 * Natural scoring rescaled to [40-100] for marketing-friendly output.
 */
export function computeCategoryScore(
  category: CategoryType,
  pois: PoiRow[],
  radiusM: number,
): CategoryScoreResult {
  // Floor: limited access (not zero) - marketing-friendly minimum
  if (pois.length === 0) {
    return { score: 40, countScore: 0, proximityScore: 0, diversityScore: 0, qualityScore: 0 };
  }

  // Scale the average based on the radius (baseline is 1000m)
  const radiusScale = (radiusM / 1000) ** 2; // area scales quadratically
  const avgCount = BOGOTA_AVERAGES[category] * radiusScale;

  // 1. Count score: normalized against Bogota averages
  const countRatio = Math.min(pois.length / avgCount, 2.0);
  const countScore = Math.min(countRatio * 50, 100);

  // 2. Proximity score: inverse distance weighting (top-10 closest POIs)
  const sorted = [...pois].sort((a, b) => a.distance_m - b.distance_m);
  const topN = sorted.slice(0, Math.min(10, sorted.length));
  const proximityScores = topN.map((poi) => {
    const normalized = 1 - Math.min(poi.distance_m / radiusM, 1);
    return normalized ** 1.5;
  });
  const proximityScore = (proximityScores.reduce((a, b) => a + b, 0) / topN.length) * 100;

  // 3. Diversity score: variety of subcategories
  const uniqueSubcategories = new Set(pois.map((p) => p.subcategory));
  const expectedDiversity = EXPECTED_DIVERSITY[category];
  const diversityRatio = Math.min(uniqueSubcategories.size / expectedDiversity, 1.0);
  const diversityScore = diversityRatio * 100;

  // 4. Quality score: based on confidence and metadata
  const avgConfidence = pois.reduce((sum, p) => sum + p.confidence, 0) / pois.length;
  const qualityScore = avgConfidence; // Already 0-100

  // Weighted final score
  let score = Math.round(
    countScore * SCORING_WEIGHTS.count +
    proximityScore * SCORING_WEIGHTS.proximity +
    diversityScore * SCORING_WEIGHTS.diversity +
    qualityScore * SCORING_WEIGHTS.quality,
  );

  // Rescale [35-100] -> [40-100] for marketing-friendly scores (monotonic, preserves ordering)
  score = Math.round(40 + (Math.max(35, score) - 35) * 60 / 65);
  score = Math.max(40, Math.min(100, score));

  return {
    score,
    countScore: Math.round(countScore),
    proximityScore: Math.round(proximityScore),
    diversityScore: Math.round(diversityScore),
    qualityScore: Math.round(qualityScore),
  };
}

/**
 * Compute the overall score from individual category scores.
 * Weights calibrated for real estate buyers' priorities.
 */
export function computeOverallScore(
  categoryScores: Record<CategoryType, number>,
): number {
  const weights: Record<CategoryType, number> = {
    health: 0.35,       // Best estrato differentiator (clinics, hospitals)
    transport: 0.20,    // Moderate (transit ubiquitous, weaker correlator)
    commerce: 0.20,     // Banks, restaurants correlate with wealth
    recreation: 0.15,   // Parks inversely correlate with estrato
    education: 0.10,    // Lowest (public schools inflate poor-area scores)
  };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [cat, score] of Object.entries(categoryScores)) {
    const w = weights[cat as CategoryType] ?? 0;
    if (score > 0) {
      weightedSum += score * w;
      totalWeight += w;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

/**
 * Generate a summary for a category score in the requested language.
 */
export function generateCategorySummary(
  category: CategoryType,
  score: number,
  poiCount: number,
  lang: string = 'es',
): string {
  if (lang === 'en') {
    const labelsEn: Record<CategoryType, string> = {
      transport: 'transport connectivity',
      commerce: 'commercial options',
      education: 'education access',
      health: 'healthcare access',
      recreation: 'recreation options',
    };
    const label = labelsEn[category];
    if (score >= 80) return `Excellent ${label}`;
    if (score >= 60) return `Good ${label}`;
    if (score >= 40) return `Acceptable ${label}`;
    if (score >= 20) return `Limited ${label}`;
    if (poiCount === 0) return `No ${label} data`;
    return `Very limited ${label}`;
  }

  const labels: Record<CategoryType, string> = {
    transport: 'conectividad de transporte',
    commerce: 'oferta comercial',
    education: 'acceso a educacion',
    health: 'acceso a salud',
    recreation: 'opciones de recreacion',
  };

  const label = labels[category];

  if (score >= 80) return `Excelente ${label}`;
  if (score >= 60) return `Buena ${label}`;
  if (score >= 40) return `${label[0].toUpperCase() + label.slice(1)} aceptable`;
  if (score >= 20) return `${label[0].toUpperCase() + label.slice(1)} limitada`;
  if (poiCount === 0) return `Sin datos de ${label}`;
  return `${label[0].toUpperCase() + label.slice(1)} muy limitada`;
}
