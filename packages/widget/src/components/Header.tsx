import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { Location } from '@bogota-insights/shared';
import { t } from '../utils/i18n';

interface HeaderProps {
  location: Location;
  lang: 'es' | 'en';
  showEstrato: boolean;
  theme: 'light' | 'dark';
}

export function Header({ location, lang, showEstrato, theme }: HeaderProps) {
  const [showEstratoTooltip, setShowEstratoTooltip] = useState(false);
  const isDark = theme === 'dark';

  return (
    <div class="bi-header" role="banner">
      <div class="bi-header-top">
        <svg class="bi-pin-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
            fill={isDark ? '#8AB4F8' : '#1A73E8'}
          />
        </svg>
        <span class="bi-neighborhood-name">
          {location.neighborhood ?? t('header.bogota', lang)}, {t('header.bogota', lang)}
        </span>
      </div>
      <div class="bi-header-meta">
        {location.localidad && (
          <span class="bi-localidad">
            {t('header.localidad', lang)}: {location.localidad}
          </span>
        )}
        {showEstrato && location.estrato != null && (
          <>
            <span class="bi-meta-separator" aria-hidden="true">
              {' \u00B7 '}
            </span>
            <span
              class="bi-estrato-badge"
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
      <div class="bi-header-coords">
        {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
      </div>
    </div>
  );
}
