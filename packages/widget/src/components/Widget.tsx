import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import type { CategoryType } from '@bogota-insights/shared';
import { useInsights } from '../hooks/useInsights';
import { Header } from './Header';
import { ScoreRings } from './ScoreRings';
import { RadiusSelector } from './RadiusSelector';
import { CategoryCard } from './CategoryCard';
import { Footer } from './Footer';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ErrorState } from './ErrorState';
import { isLimitedData } from '../utils/scores';

export interface WidgetProps {
  lat: number;
  lng: number;
  radius?: number;
  lang?: 'es' | 'en';
  theme?: 'light' | 'dark';
  apiKey?: string;
  apiBaseUrl?: string;
  showEstrato?: boolean;
  compact?: boolean;
  useMock?: boolean;
}

const CATEGORIES: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];

export function Widget({
  lat,
  lng,
  radius: initialRadius = 1000,
  lang = 'es',
  theme = 'light',
  apiKey,
  apiBaseUrl,
  showEstrato = true,
  compact = false,
  useMock = false,
}: WidgetProps) {
  const [radius, setRadius] = useState(initialRadius);
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryType>>(
    new Set([CATEGORIES[0]])
  );

  const { data, loading, error, refetch } = useInsights({
    lat,
    lng,
    radius,
    lang,
    apiKey,
    apiBaseUrl,
    useMock,
  });

  const handleCategoryClick = useCallback(
    (category: CategoryType) => {
      setExpandedCategories((prev) => {
        const next = new Set(prev);
        if (compact) {
          // Accordion mode: only one open at a time
          if (next.has(category)) {
            next.delete(category);
          } else {
            next.clear();
            next.add(category);
          }
        } else {
          if (next.has(category)) {
            next.delete(category);
          } else {
            next.add(category);
          }
        }
        return next;
      });
    },
    [compact]
  );

  const handleRadiusChange = useCallback((newRadius: number) => {
    setRadius(newRadius);
  }, []);

  const limitedCategories = data
    ? new Set(
        CATEGORIES.filter((cat) => {
          const catData = data.categories[cat];
          return catData && isLimitedData(catData.pois.length);
        })
      )
    : new Set<string>();

  return (
    <div
      class={`bi-widget bi-theme-${theme} ${compact ? 'bi-compact' : ''}`}
      role="region"
      aria-label="Bogota neighborhood insights"
    >
      {loading && <LoadingSkeleton lang={lang} />}

      {error && !loading && <ErrorState error={error} lang={lang} onRetry={refetch} />}

      {data && !loading && (
        <>
          <Header
            location={data.location}
            lang={lang}
            showEstrato={showEstrato}
            theme={theme}
          />

          <ScoreRings
            scores={data.scores}
            lang={lang}
            onCategoryClick={handleCategoryClick}
            limitedCategories={limitedCategories}
          />

          <RadiusSelector radius={radius} onChange={handleRadiusChange} lang={lang} />

          <div class="bi-categories" role="list" aria-label="Category details">
            {CATEGORIES.filter((cat) => data.categories[cat]).map((cat) => (
              <CategoryCard
                key={cat}
                category={cat}
                data={data.categories[cat]}
                expanded={expandedCategories.has(cat)}
                onToggle={() => handleCategoryClick(cat)}
                lang={lang}
                radius={radius}
              />
            ))}
          </div>

          <Footer
            sources={data.meta.sources}
            radius={radius}
            lang={lang}
          />
        </>
      )}
    </div>
  );
}
