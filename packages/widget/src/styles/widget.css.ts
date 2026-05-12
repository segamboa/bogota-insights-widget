export const widgetStyles = `
:host {
  display: block;
  contain: content;
  font-family: var(--bi-font, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ===== THEME VARIABLES ===== */
.bi-theme-light {
  --bi-primary: #2563EB;
  --bi-primary-light: #DBEAFE;
  --bi-bg: #F8FAFC;
  --bi-surface: #FFFFFF;
  --bi-surface-hover: #F1F5F9;
  --bi-text: #0F172A;
  --bi-text-secondary: #64748B;
  --bi-text-muted: #94A3B8;
  --bi-border: #E2E8F0;
  --bi-border-light: #F1F5F9;
  --bi-radius-sm: 6px;
  --bi-radius: 10px;
  --bi-radius-lg: 14px;
  --bi-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --bi-shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04);
  --bi-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.03);
}

.bi-theme-dark {
  --bi-primary: #60A5FA;
  --bi-primary-light: #1E3A5F;
  --bi-bg: #0F172A;
  --bi-surface: #1E293B;
  --bi-surface-hover: #334155;
  --bi-text: #F1F5F9;
  --bi-text-secondary: #94A3B8;
  --bi-text-muted: #64748B;
  --bi-border: #334155;
  --bi-border-light: #1E293B;
  --bi-radius-sm: 6px;
  --bi-radius: 10px;
  --bi-radius-lg: 14px;
  --bi-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --bi-shadow-md: 0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -1px rgba(0,0,0,0.2);
  --bi-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.3);
}

/* ===== WIDGET CONTAINER ===== */
.bi-widget {
  background: var(--bi-bg);
  color: var(--bi-text);
  border-radius: var(--bi-radius-lg);
  overflow: hidden;
  max-width: 480px;
  min-width: 320px;
  box-shadow: var(--bi-shadow-lg);
  border: 1px solid var(--bi-border);
}

/* ===== HEADER ===== */
.bi-header {
  padding: 20px 20px 16px;
  background: var(--bi-surface);
  border-bottom: 1px solid var(--bi-border-light);
}

.bi-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.bi-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.bi-pin-icon {
  flex-shrink: 0;
  color: var(--bi-primary);
}

.bi-header-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.bi-neighborhood-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--bi-text);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bi-header-meta {
  font-size: 12px;
  color: var(--bi-text-secondary);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bi-estrato-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  background: var(--bi-primary-light);
  color: var(--bi-primary);
}

.bi-overall-score {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
  box-shadow: var(--bi-shadow-md);
}

.bi-overall-score-low { background: linear-gradient(135deg, #EF4444, #DC2626); }
.bi-overall-score-moderate { background: linear-gradient(135deg, #F59E0B, #D97706); }
.bi-overall-score-good { background: linear-gradient(135deg, #22C55E, #16A34A); }
.bi-overall-score-excellent { background: linear-gradient(135deg, #10B981, #059669); }

/* ===== SCORE RINGS ===== */
.bi-score-rings {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 20px;
  background: var(--bi-surface);
}

.bi-score-ring-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--bi-radius);
  min-width: 52px;
  color: var(--bi-text);
  font-family: inherit;
  transition: background 0.15s, transform 0.1s;
}

.bi-score-ring-btn:hover {
  background: var(--bi-surface-hover);
  transform: translateY(-1px);
}

.bi-score-ring-btn:focus-visible {
  outline: 2px solid var(--bi-primary);
  outline-offset: 2px;
}

.bi-ring-wrap {
  position: relative;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bi-ring-number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 13px;
  font-weight: 800;
  z-index: 1;
}

.bi-score-svg {
  display: block;
}

.bi-score-number {
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
}

.bi-score-label {
  font-size: 10px;
  color: var(--bi-text-secondary);
  white-space: nowrap;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.bi-score-limited {
  font-size: 9px;
  color: var(--bi-text-muted);
}

/* ===== INVESTMENT CARD ===== */
.bi-investment-card {
  margin: 12px 16px;
  padding: 16px;
  background: var(--bi-surface);
  border-radius: var(--bi-radius);
  border-left: 4px solid var(--bi-investment-accent, #2563EB);
  box-shadow: var(--bi-shadow);
}

.bi-investment-card-strong_buy { --bi-investment-accent: #059669; }
.bi-investment-card-buy { --bi-investment-accent: #2563EB; }
.bi-investment-card-hold { --bi-investment-accent: #D97706; }
.bi-investment-card-watch { --bi-investment-accent: #94A3B8; }

.bi-investment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bi-investment-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bi-investment-icon {
  color: var(--bi-investment-accent);
}

.bi-investment-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bi-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bi-investment-score {
  font-size: 24px;
  font-weight: 800;
  color: var(--bi-investment-accent);
  line-height: 1;
}

.bi-investment-body {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.bi-signal-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.bi-theme-light .bi-signal-strong_buy { background: #D1FAE5; color: #065F46; }
.bi-theme-light .bi-signal-buy { background: #DBEAFE; color: #1E40AF; }
.bi-theme-light .bi-signal-hold { background: #FEF3C7; color: #92400E; }
.bi-theme-light .bi-signal-watch { background: #F1F5F9; color: #475569; }

.bi-theme-dark .bi-signal-strong_buy { background: #064E3B; color: #6EE7B7; }
.bi-theme-dark .bi-signal-buy { background: #1E3A5F; color: #93C5FD; }
.bi-theme-dark .bi-signal-hold { background: #451A03; color: #FCD34D; }
.bi-theme-dark .bi-signal-watch { background: #334155; color: #CBD5E1; }

.bi-investment-summary {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--bi-text);
  line-height: 1.5;
  font-weight: 500;
}

/* ===== CATEGORY CARDS ===== */
.bi-categories {
  list-style: none;
  margin: 0;
  padding: 0 16px 12px;
}

.bi-category-card {
  background: var(--bi-surface);
  border-radius: var(--bi-radius);
  margin-bottom: 8px;
  box-shadow: var(--bi-shadow);
  border: 1px solid var(--bi-border);
  overflow: hidden;
  transition: box-shadow 0.15s, transform 0.1s;
}

.bi-category-card:hover {
  box-shadow: var(--bi-shadow-md);
}

.bi-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.15s;
}

.bi-card-header:hover {
  background: var(--bi-surface-hover);
}

.bi-card-header:focus-visible {
  outline: 2px solid var(--bi-primary);
  outline-offset: -2px;
}

.bi-card-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: var(--bi-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bi-border-light);
  color: var(--bi-text-secondary);
}

.bi-card-info {
  flex: 1;
  min-width: 0;
}

.bi-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--bi-text);
  line-height: 1.3;
}

.bi-card-summary {
  font-size: 12px;
  color: var(--bi-text-secondary);
  margin-top: 2px;
  line-height: 1.4;
}

.bi-card-score-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  height: 28px;
  padding: 0 10px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.bi-score-pill-low { background: #EF4444; }
.bi-score-pill-moderate { background: #F59E0B; }
.bi-score-pill-good { background: #22C55E; }
.bi-score-pill-excellent { background: #10B981; }

.bi-card-chevron {
  flex-shrink: 0;
  color: var(--bi-text-muted);
  transition: transform 0.2s;
}

.bi-card-chevron-open {
  transform: rotate(180deg);
}

.bi-card-panel {
  padding: 0 16px 16px 64px;
  animation: bi-slideDown 0.25s ease-out;
  border-top: 1px solid var(--bi-border-light);
}

@keyframes bi-slideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes bi-slideDown {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .bi-card-chevron { transition: none; }
}

/* Metrics section (expanded) */
.bi-metrics-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-top: 10px;
}

.bi-percentile-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
}

.bi-theme-light .bi-percentile-low { background: #FEE2E2; color: #991B1B; }
.bi-theme-light .bi-percentile-moderate { background: #FEF3C7; color: #92400E; }
.bi-theme-light .bi-percentile-good { background: #DCFCE7; color: #166534; }
.bi-theme-light .bi-percentile-excellent { background: #D1FAE5; color: #065F46; }

.bi-theme-dark .bi-percentile-low { background: #450A0A; color: #FCA5A5; }
.bi-theme-dark .bi-percentile-moderate { background: #451A03; color: #FCD34D; }
.bi-theme-dark .bi-percentile-good { background: #064E3B; color: #86EFAC; }
.bi-theme-dark .bi-percentile-excellent { background: #064E3B; color: #6EE7B7; }

.bi-trend-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}

.bi-theme-light .bi-trend-up { background: #DCFCE7; color: #166534; }
.bi-theme-light .bi-trend-down { background: #FEE2E2; color: #991B1B; }
.bi-theme-light .bi-trend-stable { background: #F1F5F9; color: #475569; }

.bi-theme-dark .bi-trend-up { background: #064E3B; color: #86EFAC; }
.bi-theme-dark .bi-trend-down { background: #450A0A; color: #FCA5A5; }
.bi-theme-dark .bi-trend-stable { background: #334155; color: #CBD5E1; }

/* Median comparison bars */
.bi-median-comparison {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: var(--bi-radius-sm);
  background: var(--bi-border-light);
}

.bi-median-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.bi-median-label {
  min-width: 90px;
  color: var(--bi-text-secondary);
  flex-shrink: 0;
  font-weight: 500;
}

.bi-median-bar-track {
  flex: 1;
  height: 6px;
  background: var(--bi-border);
  border-radius: 3px;
  position: relative;
  overflow: visible;
  min-width: 40px;
}

.bi-median-bar-fill {
  height: 100%;
  background: var(--bi-primary);
  border-radius: 3px;
  opacity: 0.35;
}

.bi-median-bar-local {
  background: #94A3B8;
  opacity: 0.5;
}

.bi-median-marker {
  position: absolute;
  top: -3px;
  width: 4px;
  height: 12px;
  background: var(--bi-text);
  border-radius: 2px;
  transform: translateX(-50%);
}

.bi-median-value {
  min-width: 24px;
  text-align: right;
  color: var(--bi-text-secondary);
  font-weight: 600;
  font-size: 11px;
}

/* Count rows */
.bi-counts-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.bi-count-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.bi-count-label {
  min-width: 100px;
  color: var(--bi-text);
  flex-shrink: 0;
  font-weight: 500;
}

.bi-bar-track {
  flex: 1;
  height: 6px;
  background: var(--bi-border);
  border-radius: 3px;
  overflow: hidden;
  min-width: 40px;
}

.bi-bar-fill {
  height: 100%;
  background: var(--bi-primary);
  border-radius: 3px;
  transition: width 0.3s ease-out;
}

.bi-count-value {
  font-size: 12px;
  color: var(--bi-text-secondary);
  white-space: nowrap;
  min-width: 60px;
  text-align: right;
}

.bi-closest {
  font-size: 12px;
  color: var(--bi-text-secondary);
  padding-top: 8px;
  border-top: 1px solid var(--bi-border);
}

.bi-card-sources {
  font-size: 11px;
  color: var(--bi-text-muted);
  margin-top: 8px;
}

.bi-no-data {
  font-size: 13px;
  color: var(--bi-text-secondary);
  padding: 8px 0;
}

.bi-no-data p {
  margin: 0 0 4px;
}

/* ===== RADIUS SELECTOR ===== */
.bi-radius {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border-top: 1px solid var(--bi-border-light);
  background: var(--bi-surface);
}

.bi-radius-label {
  font-size: 12px;
  color: var(--bi-text-secondary);
  margin-right: 4px;
  font-weight: 500;
}

.bi-radius-btn {
  font-size: 12px;
  padding: 4px 12px;
  border: 1px solid var(--bi-border);
  border-radius: 20px;
  background: var(--bi-surface);
  color: var(--bi-text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  transition: all 0.15s;
}

.bi-radius-btn:hover {
  border-color: var(--bi-primary);
  color: var(--bi-primary);
}

.bi-radius-btn:focus-visible {
  outline: 2px solid var(--bi-primary);
  outline-offset: 2px;
}

.bi-radius-active {
  background: var(--bi-primary);
  color: #fff;
  border-color: var(--bi-primary);
}

.bi-radius-active:hover {
  color: #fff;
}

/* ===== FOOTER ===== */
.bi-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  font-size: 11px;
  color: var(--bi-text-muted);
  background: var(--bi-surface);
  border-top: 1px solid var(--bi-border-light);
}

.bi-footer-sources {
  font-weight: 500;
}

/* ===== ERROR STATE ===== */
.bi-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 24px;
  text-align: center;
  gap: 16px;
}

.bi-error-icon {
  width: 48px;
  height: 48px;
  color: var(--bi-text-muted);
}

.bi-error-message {
  font-size: 14px;
  color: var(--bi-text-secondary);
  margin: 0;
  max-width: 280px;
  line-height: 1.5;
}

.bi-error-retry {
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--bi-primary);
  background: var(--bi-primary-light);
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.bi-error-retry:hover {
  background: var(--bi-primary);
  color: #fff;
}

.bi-error-retry:focus-visible {
  outline: 2px solid var(--bi-primary);
  outline-offset: 2px;
}

/* ===== LOADING SKELETON ===== */
.bi-skeleton {
  padding: 20px;
}

.bi-skeleton-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.bi-skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bi-border);
  animation: bi-pulse 1.5s ease-in-out infinite;
  flex-shrink: 0;
}

.bi-skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bi-skeleton-line {
  height: 10px;
  background: var(--bi-border);
  border-radius: 5px;
  animation: bi-pulse 1.5s ease-in-out infinite;
}

.bi-skeleton-w30 { width: 30%; }
.bi-skeleton-w50 { width: 50%; }
.bi-skeleton-w70 { width: 70%; }

.bi-skeleton-rings {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 16px;
}

.bi-skeleton-ring {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--bi-border);
  animation: bi-pulse 1.5s ease-in-out infinite;
}

.bi-skeleton-card {
  height: 56px;
  border-radius: var(--bi-radius);
  background: var(--bi-border);
  animation: bi-pulse 1.5s ease-in-out infinite;
  margin-bottom: 8px;
}

@keyframes bi-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes bi-pulse {
    0%, 100% { opacity: 0.7; }
  }
}

/* ===== RESPONSIVE ===== */
@container (max-width: 360px) {
  .bi-score-rings { gap: 4px; padding: 16px 12px; }
  .bi-ring-wrap { width: 44px; height: 44px; }
  .bi-score-label { font-size: 9px; }
  .bi-count-label { min-width: 80px; font-size: 12px; }
  .bi-count-value { min-width: 50px; font-size: 11px; }
}

@container (min-width: 600px) {
  .bi-neighborhood-name { font-size: 18px; }
  .bi-score-rings { gap: 12px; padding: 24px; }
  .bi-ring-wrap { width: 56px; height: 56px; }
  .bi-score-label { font-size: 11px; }
}
`;
