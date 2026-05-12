/**
 * Investment / Growth Potential Score (v2)
 *
 * Heurística híbrida que mide potencial de valorización inmobiliaria.
 * No requiere datos de precios de propiedades.
 *
 * Factores:
 *   30% Basic upside      → 100 - overall_score (zonas con poca infra hoy)
 *   25% Gap vs median     → suma de gaps donde score < cityMedian
 *   20% Diversity         → subcategorías únicas (mix de usos)
 *   15% Proximity         → qué tan cerca están los POIs
 *   10% Trend momentum    → categorías con trend ↑
 *
 * Señales:
 *   80-100: strong_buy
 *   60-79:  buy
 *   40-59:  hold
 *   25-39:  watch
 */

import type { CategoryType } from '@bogota-insights/shared';

const CATEGORIES: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];

interface InvestmentInputs {
  overall: number;
  scores: Record<string, number>;
  cityMedians: Record<string, number>;
  categoryPois: Record<string, Array<{ subcategory: string; distance_m: number }>>;
  trendingUpCount: number;
  radiusM: number;
}

export interface InvestmentResult {
  score: number;
  summary: string;
  signal: 'strong_buy' | 'buy' | 'hold' | 'watch';
}

function computeDiversityScore(pois: Array<{ subcategory: string }>): number {
  const unique = new Set(pois.map((p) => p.subcategory));
  return Math.min(unique.size / 5, 1) * 100;
}

function computeProximityBonus(
  pois: Array<{ distance_m: number }>,
  radiusM: number,
): number {
  if (pois.length === 0) return 0;
  const avgDist = pois.reduce((s, p) => s + p.distance_m, 0) / pois.length;
  const normalized = 1 - Math.min(avgDist / radiusM, 1);
  return normalized * 100;
}

export function computeInvestmentScore(inputs: InvestmentInputs): InvestmentResult {
  const { overall, scores, cityMedians, categoryPois, trendingUpCount, radiusM } = inputs;

  // Factor 1: Basic upside (30%)
  // Simple logic: lower current score = more room to grow
  const basicUpside = Math.min(Math.max(100 - overall, 0), 100);

  // Factor 2: Gap vs city median (25%)
  // Where score < median, there is a gap that could close with development
  let totalGap = 0;
  let gapCount = 0;
  for (const cat of CATEGORIES) {
    const score = scores[cat] ?? 0;
    const median = cityMedians[cat] ?? 50;
    if (score < median) {
      totalGap += Math.min(median - score, 40);
      gapCount++;
    }
  }
  const avgGap = gapCount > 0 ? totalGap / gapCount : 0;
  const gapPotential = Math.min((avgGap / 25) * 100, 100);

  // Factor 3: Diversity (20%)
  let totalDiversity = 0;
  let diversityCount = 0;
  for (const cat of CATEGORIES) {
    const pois = categoryPois[cat] || [];
    if (pois.length > 0) {
      totalDiversity += computeDiversityScore(pois);
      diversityCount++;
    }
  }
  const diversityScore = diversityCount > 0 ? totalDiversity / diversityCount : 0;

  // Factor 4: Proximity (15%)
  let totalProximity = 0;
  let proximityCount = 0;
  for (const cat of CATEGORIES) {
    const pois = categoryPois[cat] || [];
    if (pois.length > 0) {
      totalProximity += computeProximityBonus(pois, radiusM);
      proximityCount++;
    }
  }
  const proximityScore = proximityCount > 0 ? totalProximity / proximityCount : 0;

  // Factor 5: Trend momentum (10%)
  const trendBonus = Math.min((trendingUpCount / 3) * 100, 100);

  // Weighted composite (0-100 scale)
  const raw =
    basicUpside * 0.30 +
    gapPotential * 0.25 +
    diversityScore * 0.20 +
    proximityScore * 0.15 +
    trendBonus * 0.10;

  // Map raw 0-100 to final score 25-100 so even modest potential isn't clamped to 25
  const score = Math.round(Math.min(100, 25 + (raw / 100) * 75));

  // Signal + summary
  let signal: InvestmentResult['signal'];
  let summary: string;

  if (score >= 80) {
    signal = 'strong_buy';
    summary = 'Alto potencial de valorización — infraestructura con espacio de mejora significativo';
  } else if (score >= 60) {
    signal = 'buy';
    summary = 'Buena oportunidad de inversión — área con crecimiento sostenido';
  } else if (score >= 40) {
    signal = 'hold';
    summary = 'Mercado estable — rendimiento predecible';
  } else {
    signal = 'watch';
    summary = 'En observación — esperar señales de desarrollo';
  }

  return { score, summary, signal };
}
