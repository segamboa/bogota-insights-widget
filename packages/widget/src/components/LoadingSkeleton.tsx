import { h } from 'preact';

interface LoadingSkeletonProps {
  lang: 'es' | 'en';
}

export function LoadingSkeleton({ lang }: LoadingSkeletonProps) {
  return (
    <div class="bi-skeleton" role="status" aria-live="polite">
      {/* Header skeleton */}
      <div class="bi-skeleton-header">
        <div class="bi-skeleton-avatar" />
        <div class="bi-skeleton-lines">
          <div class="bi-skeleton-line bi-skeleton-w70" />
          <div class="bi-skeleton-line bi-skeleton-w50" />
        </div>
      </div>

      {/* Score rings skeleton */}
      <div class="bi-skeleton-rings">
        <div class="bi-skeleton-ring" />
        <div class="bi-skeleton-ring" />
        <div class="bi-skeleton-ring" />
        <div class="bi-skeleton-ring" />
        <div class="bi-skeleton-ring" />
      </div>

      {/* Category cards skeleton */}
      <div class="bi-skeleton-card" />
      <div class="bi-skeleton-card" />
      <div class="bi-skeleton-card" />
      <div class="bi-skeleton-card" />
      <div class="bi-skeleton-card" />

      <span class="sr-only">
        {lang === 'es' ? 'Cargando información del barrio...' : 'Loading neighborhood information...'}
      </span>
    </div>
  );
}
