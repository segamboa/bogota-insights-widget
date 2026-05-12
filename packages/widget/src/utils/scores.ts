export function getScoreColor(score: number): string {
  if (score < 35) return '#D93025';
  if (score < 40) return blendColors('#D93025', '#F9AB00', (score - 35) / 5);
  if (score < 55) return '#F9AB00';
  if (score < 60) return blendColors('#F9AB00', '#34A853', (score - 55) / 5);
  if (score < 75) return '#34A853';
  if (score < 80) return blendColors('#34A853', '#0D8043', (score - 75) / 5);
  return '#0D8043';
}

function blendColors(color1: string, color2: string, ratio: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export function isLimitedData(poiCount: number): boolean {
  return poiCount > 0 && poiCount < 5;
}

export function hasNoData(poiCount: number): boolean {
  return poiCount === 0;
}

export function getScoreTier(score: number): 'low' | 'moderate' | 'good' | 'excellent' {
  if (score < 40) return 'low';
  if (score < 60) return 'moderate';
  if (score < 80) return 'good';
  return 'excellent';
}
