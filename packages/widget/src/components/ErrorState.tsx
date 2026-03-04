import { h } from 'preact';
import { t } from '../utils/i18n';

interface ErrorStateProps {
  error: { code: string; message: string };
  lang: 'es' | 'en';
  onRetry: () => void;
}

function getErrorMessage(code: string, lang: 'es' | 'en'): string {
  switch (code) {
    case 'OUTSIDE_COVERAGE':
    case 'INVALID_COORDINATES':
      return t('error.outside', lang);
    case 'RATE_LIMIT_EXCEEDED':
      return t('error.rateLimit', lang);
    default:
      return t('error.network', lang);
  }
}

export function ErrorState({ error, lang, onRetry }: ErrorStateProps) {
  const message = getErrorMessage(error.code, lang);
  const showRetry = error.code !== 'OUTSIDE_COVERAGE' && error.code !== 'INVALID_COORDINATES';

  return (
    <div class="bi-error" role="alert">
      <svg class="bi-error-icon" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          fill="#D93025"
        />
      </svg>
      <p class="bi-error-message">{message}</p>
      {showRetry && (
        <button class="bi-error-retry" onClick={onRetry} type="button">
          {t('error.retry', lang)}
        </button>
      )}
    </div>
  );
}
