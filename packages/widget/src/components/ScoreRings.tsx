import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CategoryType } from '@bogota-insights/shared';
import { getScoreColor } from '../utils/scores';
import { getCategoryLabel, getScoreLabel } from '../utils/i18n';

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mql) return;
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}

interface ScoreRingsProps {
  scores: Record<string, number>;
  lang: 'es' | 'en';
  onCategoryClick: (category: CategoryType) => void;
  limitedCategories?: Set<string>;
}

const CATEGORIES: CategoryType[] = ['transport', 'commerce', 'education', 'health', 'recreation'];
const RING_SIZE = 56;
const STROKE_WIDTH = 4;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({
  score,
  category,
  lang,
  index,
  isLimited,
  onClick,
}: {
  score: number;
  category: CategoryType;
  lang: 'es' | 'en';
  index: number;
  isLimited: boolean;
  onClick: () => void;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const rafRef = useRef<number>(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setAnimatedScore(score);
      return;
    }

    const delay = index * 100;
    const duration = 600;
    let start: number | null = null;

    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        setAnimatedScore(Math.round(eased * score));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [score, index, reducedMotion]);

  const color = getScoreColor(score);
  const offset = CIRCUMFERENCE - (animatedScore / 100) * CIRCUMFERENCE;
  const label = getCategoryLabel(category, lang);
  const scoreDescr = getScoreLabel(score, lang);

  return (
    <button
      class="bi-score-ring-btn"
      onClick={onClick}
      aria-label={`${label}: ${score} de 100, ${scoreDescr}`}
      type="button"
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        class="bi-score-svg"
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--bi-border)"
          stroke-width={STROKE_WIDTH}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          stroke-width={STROKE_WIDTH}
          stroke-dasharray={CIRCUMFERENCE}
          stroke-dashoffset={offset}
          stroke-linecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={isLimited ? { strokeDasharray: '4 3' } : undefined}
        />
        <text
          x={RING_SIZE / 2}
          y={RING_SIZE / 2}
          text-anchor="middle"
          dominant-baseline="central"
          class="bi-score-number"
          fill="var(--bi-text)"
        >
          {score > 0 ? animatedScore : '--'}
        </text>
      </svg>
      <span class="bi-score-label">{label}</span>
      {isLimited && <span class="bi-score-limited">*</span>}
    </button>
  );
}

export function ScoreRings({ scores, lang, onCategoryClick, limitedCategories }: ScoreRingsProps) {
  return (
    <div class="bi-score-rings" role="list" aria-label="Category scores">
      {CATEGORIES.filter((cat) => scores[cat] !== undefined).map((cat, i) => (
        <ScoreRing
          key={cat}
          score={scores[cat] ?? 0}
          category={cat}
          lang={lang}
          index={i}
          isLimited={limitedCategories?.has(cat) ?? false}
          onClick={() => onCategoryClick(cat)}
        />
      ))}
    </div>
  );
}
