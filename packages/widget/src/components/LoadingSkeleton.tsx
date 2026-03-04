import { h } from 'preact';
import { t } from '../utils/i18n';

interface LoadingSkeletonProps {
  lang: 'es' | 'en';
}

export function LoadingSkeleton({ lang }: LoadingSkeletonProps) {
  return (
    <div class="bi-skeleton" role="status" aria-live="polite" aria-label={t('loading.text', lang)}>
      {/* Header skeleton */}
      <div class="bi-skeleton-header">
        <div class="bi-skeleton-line bi-skeleton-w60" />
        <div class="bi-skeleton-line bi-skeleton-w40" />
        <div class="bi-skeleton-line bi-skeleton-w30" />
      </div>

      {/* Score rings skeleton */}
      <div class="bi-skeleton-scores">
        {[0, 1, 2, 3, 4].map((i) => (
          <div class="bi-skeleton-ring" key={i} />
        ))}
      </div>

      {/* Category cards skeleton */}
      <div class="bi-skeleton-cards">
        {[0, 1, 2].map((i) => (
          <div class="bi-skeleton-card" key={i}>
            <div class="bi-skeleton-line bi-skeleton-w80" />
          </div>
        ))}
      </div>
    </div>
  );
}
