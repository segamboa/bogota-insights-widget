import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { Location } from '@bogota-insights/shared';
import { t } from '../utils/i18n';
import { getScoreTier } from '../utils/scores';
import { locationPinIcon } from '../utils/icons';

interface HeaderProps {
  location: Location;
  lang: 'es' | 'en';
  showEstrato: boolean;
  theme: 'light' | 'dark';
  overallScore?: number;
}

export function Header({ location, lang, showEstrato, theme, overallScore }: HeaderProps) {
  const [showEstratoTooltip, setShowEstratoTooltip] = useState(false);

  return (
    <div class="bi-header" role="banner">
      <div class="bi-header-top">
        <div class="bi-header-left">
          <span class="bi-pin-icon">
            {locationPinIcon({ size: 18, color: 'var(--bi-primary)' })}
          </span>
          <div class="bi-header-title">
            <span class="bi-neighborhood-name">
              {location.neighborhood ?? t('header.bogota', lang)}
            </span>
            <div class="bi-header-meta">
              {location.localidad && (
                <span>{location.localidad}</span>
              )}
              {showEstrato && location.estrato != null && (
                <>
                  {location.localidad && (
                    <span aria-hidden="true">·</span>
                  )}
                  <span
                    class="bi-estrato-pill"
                    role="note"
                    tabIndex={0}
                    aria-label={`${t('header.estrato', lang)} ${location.estrato}`}
                    onMouseEnter={() => setShowEstratoTooltip(true)}
                    onMouseLeave={() => setShowEstratoTooltip(false)}
                    onFocus={() => setShowEstratoTooltip(true)}
                    onBlur={() => setShowEstratoTooltip(false)}
                  >
                    {t('header.estrato', lang)} {location.estrato}
                    {showEstratoTooltip && (
                      <span class="bi-estrato-tooltip" role="tooltip">
                        {t('estrato.tooltip', lang)}
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {overallScore !== undefined && (
          <span
            class={`bi-overall-score bi-overall-score-${getScoreTier(overallScore)}`}
            aria-label={`${t('score.overall', lang)}: ${overallScore}`}
          >
            {overallScore}
          </span>
        )}
      </div>
    </div>
  );
}
