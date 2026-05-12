import { h } from 'preact';
import type { InvestmentScore } from '@bogota-insights/shared';
import { t } from '../utils/i18n';
import { getScoreColor } from '../utils/scores';
import { investmentIcon } from '../utils/icons';

interface InvestmentCardProps {
  investment: InvestmentScore;
  lang: 'es' | 'en';
}

export function InvestmentCard({ investment, lang }: InvestmentCardProps) {
  const color = getScoreColor(investment.score);
  const signalKey = `investment.signal.${investment.signal}`;

  return (
    <div
      class={`bi-investment-card bi-investment-card-${investment.signal}`}
      role="region"
      aria-label={t('investment.title', lang)}
    >
      <div class="bi-investment-header">
        <div class="bi-investment-title-row">
          <span class="bi-investment-icon">
            {investmentIcon({ size: 18, color })}
          </span>
          <span class="bi-investment-title">{t('investment.title', lang)}</span>
        </div>
        <span class="bi-investment-score" style={{ color }}>
          {investment.score}
        </span>
      </div>
      <div class="bi-investment-body">
        <span class={`bi-signal-badge bi-signal-${investment.signal}`}>
          {t(signalKey, lang)}
        </span>
      </div>
      <p class="bi-investment-summary">{investment.summary}</p>
    </div>
  );
}
