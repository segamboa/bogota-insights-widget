import { h } from 'preact';
import { t } from '../utils/i18n';
import { formatDistance } from '../utils/scores';

interface FooterProps {
  sources: string[];
  radius: number;
  lang: 'es' | 'en';
}

function formatSourceLabel(source: string): string {
  switch (source) {
    case 'ideca': return 'IDECA';
    case 'osm': return 'OSM';
    case 'transmilenio': return 'TransMilenio';
    default: return source;
  }
}

export function Footer({ sources, radius, lang }: FooterProps) {
  return (
    <div class="bi-footer" role="contentinfo">
      <span class="bi-footer-sources">
        {t('footer.sources', lang)}: {sources.map(formatSourceLabel).join(' \u00B7 ')}
      </span>
      <span class="bi-footer-radius">
        {t('footer.radius', lang)}: {formatDistance(radius)}
      </span>
    </div>
  );
}
