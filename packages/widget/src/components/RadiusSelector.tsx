import { h } from 'preact';
import { t } from '../utils/i18n';

interface RadiusSelectorProps {
  radius: number;
  onChange: (radius: number) => void;
  lang: 'es' | 'en';
}

const RADIUS_OPTIONS = [500, 1000, 1500, 2000];

export function RadiusSelector({ radius, onChange, lang }: RadiusSelectorProps) {
  return (
    <div class="bi-radius" role="radiogroup" aria-label={t('radius.label', lang)}>
      <span class="bi-radius-label">{t('radius.label', lang)}:</span>
      {RADIUS_OPTIONS.map((r) => (
        <button
          key={r}
          class={`bi-radius-btn ${r === radius ? 'bi-radius-active' : ''}`}
          role="radio"
          aria-checked={r === radius}
          onClick={() => onChange(r)}
          type="button"
        >
          {r >= 1000 ? `${r / 1000}km` : `${r}m`}
        </button>
      ))}
    </div>
  );
}
