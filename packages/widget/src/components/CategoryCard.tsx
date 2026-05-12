import { h } from 'preact';
import type { CategoryType, CategoryScore, POI } from '@bogota-insights/shared';
import { getCategoryLabel, getSubcategoryLabel, t } from '../utils/i18n';
import { getScoreColor, getScoreTier, formatDistance } from '../utils/scores';
import {
  transportIcon, commerceIcon, educationIcon, healthIcon, recreationIcon,
  chevronDownIcon, trendUpIcon, trendDownIcon, trendStableIcon,
} from '../utils/icons';

interface CategoryCardProps {
  category: CategoryType;
  data: CategoryScore;
  expanded: boolean;
  onToggle: () => void;
  lang: 'es' | 'en';
  radius: number;
}

const CATEGORY_ICONS: Record<CategoryType, (props: { size?: number; color?: string }) => any> = {
  transport: transportIcon,
  commerce: commerceIcon,
  education: educationIcon,
  health: healthIcon,
  recreation: recreationIcon,
};

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

function TrendBadge({ trend, lang }: { trend: { direction: 'up' | 'down' | 'stable'; delta: number }; lang: 'es' | 'en' }) {
  const icons = {
    up: trendUpIcon({ size: 12, color: 'currentColor' }),
    down: trendDownIcon({ size: 12, color: 'currentColor' }),
    stable: trendStableIcon({ size: 12, color: 'currentColor' }),
  };
  const labels = {
    up: t('trend.up', lang),
    down: t('trend.down', lang),
    stable: t('trend.stable', lang),
  };

  return (
    <span class={`bi-trend-badge bi-trend-${trend.direction}`}>
      {icons[trend.direction]}
      {labels[trend.direction]}
    </span>
  );
}

export function CategoryCard({ category, data, expanded, onToggle, lang, radius }: CategoryCardProps) {
  const label = getCategoryLabel(category, lang);
  const color = getScoreColor(data.score);
  const tier = getScoreTier(data.score);
  const Icon = CATEGORY_ICONS[category];
  const hasData = data.pois.length > 0;
  const cardId = `bi-card-${category}`;
  const panelId = `bi-panel-${category}`;
  const countValues = Object.values(data.counts) as number[];
  const maxCount = Math.max(...countValues, 1);

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
        <span class="bi-card-icon" style={{ color, background: `${color}15` }}>
          {Icon({ size: 18, color })}
        </span>

        <div class="bi-card-info">
          <div class="bi-card-title">{label}</div>
          <div class="bi-card-summary">
            {hasData ? data.summary : t('category.noDataShort', lang)}
          </div>
        </div>

        <span
          class={`bi-card-score-pill bi-score-pill-${tier}`}
          aria-label={`${data.score} de 100`}
        >
          {hasData ? data.score : '--'}
        </span>

        <span class={`bi-card-chevron ${expanded ? 'bi-card-chevron-open' : ''}`}>
          {chevronDownIcon({ size: 16, color: 'var(--bi-text-muted)' })}
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
              {/* Metrics row */}
              <div class="bi-metrics-row">
                {data.percentile !== undefined && (
                  <span class={`bi-percentile-badge bi-percentile-${tier}`}>
                    {data.percentile >= 90
                      ? `${t('percentile.top', lang)} ${data.percentile}%`
                      : `${t('percentile.label', lang)} ${data.percentile}%`}
                  </span>
                )}
                {data.trend && (
                  <TrendBadge trend={data.trend} lang={lang} />
                )}
              </div>

              {/* Median comparison */}
              {(data.cityMedian !== undefined || data.localMedian !== undefined) && (
                <div class="bi-median-comparison">
                  {data.cityMedian !== undefined && (
                    <div class="bi-median-row">
                      <span class="bi-median-label">{t('median.city', lang)}</span>
                      <div class="bi-median-bar-track">
                        <div
                          class="bi-median-bar-fill"
                          style={{ width: `${Math.min(data.cityMedian, 100)}%` }}
                        />
                        <div
                          class="bi-median-marker"
                          style={{ left: `${Math.min(data.score, 100)}%` }}
                        />
                      </div>
                      <span class="bi-median-value">{Math.round(data.cityMedian)}</span>
                    </div>
                  )}
                  {data.localMedian !== undefined && (
                    <div class="bi-median-row">
                      <span class="bi-median-label">{t('median.local', lang)}</span>
                      <div class="bi-median-bar-track">
                        <div
                          class="bi-median-bar-fill bi-median-bar-local"
                          style={{ width: `${Math.min(data.localMedian, 100)}%` }}
                        />
                        <div
                          class="bi-median-marker"
                          style={{ left: `${Math.min(data.score, 100)}%` }}
                        />
                      </div>
                      <span class="bi-median-value">{Math.round(data.localMedian)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* POI counts */}
              <div class="bi-counts-list">
                {(Object.entries(data.counts) as [string, number][]).map(([subtype, count]) => (
                  <div class="bi-count-row" key={subtype}>
                    <span class="bi-count-label">{getSubcategoryLabel(subtype, lang)}</span>
                    <BarIndicator count={count} maxCount={maxCount} />
                    <span class="bi-count-value">
                      {count} {t('category.nearby', lang)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Closest POI */}
              {getClosestPOI(data.pois) && (
                <div class="bi-closest">
                  {t('category.closest', lang)}: {getClosestPOI(data.pois)!.name} ({formatDistance(getClosestPOI(data.pois)!.distance_m)})
                </div>
              )}

              {/* Sources */}
              <div class="bi-card-sources">
                {getSourceLabels(data.pois, lang)}
              </div>
            </>
          ) : (
            <div class="bi-no-data">
              <p>{t('category.noData', lang)} {formatDistance(radius)}.</p>
              <p>{t('category.tryExpand', lang)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getSourceLabels(pois: POI[], lang: 'es' | 'en'): string {
  const sources = new Set(pois.map((p) => p.source));
  const labels: string[] = [];
  if (sources.has('ideca')) labels.push(t('source.ideca', lang));
  if (sources.has('osm')) labels.push(t('source.osm', lang));
  if (sources.has('transmilenio')) labels.push(t('source.transmilenio', lang));
  return labels.join(', ');
}
