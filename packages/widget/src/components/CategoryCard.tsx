import { h } from 'preact';
import type { CategoryType, CategoryScore, POI } from '@bogota-insights/shared';
import { getCategoryLabel, t } from '../utils/i18n';
import { getScoreColor, formatDistance } from '../utils/scores';

interface CategoryCardProps {
  category: CategoryType;
  data: CategoryScore;
  expanded: boolean;
  onToggle: () => void;
  lang: 'es' | 'en';
  radius: number;
}

function getClosestPOI(pois: POI[]): POI | null {
  if (pois.length === 0) return null;
  return pois.reduce((closest, poi) => (poi.distance_m < closest.distance_m ? poi : closest));
}

function BarIndicator({ count, maxCount }: { count: number; maxCount: number }) {
  const pct = Math.min((count / maxCount) * 100, 100);
  return (
    <div class="bi-bar-track" aria-hidden="true">
      <div class="bi-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CategoryCard({ category, data, expanded, onToggle, lang, radius }: CategoryCardProps) {
  const label = getCategoryLabel(category, lang);
  const color = getScoreColor(data.score);
  const closest = getClosestPOI(data.pois);
  const countValues = Object.values(data.counts) as number[];
  const maxCount = Math.max(...countValues, 1);
  const hasData = data.pois.length > 0;
  const cardId = `bi-card-${category}`;
  const panelId = `bi-panel-${category}`;

  return (
    <div class="bi-category-card" role="listitem">
      <button
        class="bi-card-header"
        id={cardId}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        type="button"
      >
        <svg
          class={`bi-chevron ${expanded ? 'bi-chevron-open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" fill="currentColor" />
        </svg>
        <span class="bi-card-title">
          {label}
        </span>
        <span class="bi-card-score" style={{ color }}>
          {hasData ? `${data.score}/100` : '--'}
        </span>
      </button>

      {expanded && (
        <div
          class="bi-card-panel"
          id={panelId}
          role="region"
          aria-labelledby={cardId}
        >
          {hasData ? (
            <>
              <div class="bi-counts-list">
                {(Object.entries(data.counts) as [string, number][]).map(([subtype, count]) => (
                  <div class="bi-count-row" key={subtype}>
                    <span class="bi-count-label">{formatSubtype(subtype)}</span>
                    <BarIndicator count={count} maxCount={maxCount} />
                    <span class="bi-count-value">
                      {count} {t('category.nearby', lang)}
                    </span>
                  </div>
                ))}
              </div>
              {closest && (
                <div class="bi-closest">
                  {t('category.closest', lang)}: {closest.name} ({formatDistance(closest.distance_m)})
                </div>
              )}
              <div class="bi-card-sources">
                {getSourceLabels(data.pois, lang)}
              </div>
            </>
          ) : (
            <div class="bi-no-data">
              <p>
                {t('category.noData', lang)} {formatDistance(radius)}.
              </p>
              <p>{t('category.tryExpand', lang)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatSubtype(subtype: string): string {
  return subtype
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSourceLabels(pois: POI[], lang: 'es' | 'en'): string {
  const sources = new Set(pois.map((p) => p.source));
  const labels: string[] = [];
  if (sources.has('ideca')) labels.push(t('source.ideca', lang));
  if (sources.has('osm')) labels.push(t('source.osm', lang));
  if (sources.has('transmilenio')) labels.push(t('source.transmilenio', lang));
  return labels.join(', ');
}
