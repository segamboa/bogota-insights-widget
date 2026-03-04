export const widgetStyles = `
:host {
  display: block;
  contain: content;
  font-family: var(--bi-font, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
  line-height: 1.4;
}

/* Theme variables */
.bi-theme-light {
  --bi-primary: #1A73E8;
  --bi-bg: #FFFFFF;
  --bi-surface: #F8F9FA;
  --bi-text: #202124;
  --bi-text-secondary: #5F6368;
  --bi-border: #DADCE0;
  --bi-radius: 8px;
}

.bi-theme-dark {
  --bi-primary: #8AB4F8;
  --bi-bg: #1E1E1E;
  --bi-surface: #2D2D2D;
  --bi-text: #E8EAED;
  --bi-text-secondary: #9AA0A6;
  --bi-border: #3C4043;
  --bi-radius: 8px;
}

/* Widget container */
.bi-widget {
  background: var(--bi-bg);
  color: var(--bi-text);
  border: 1px solid var(--bi-border);
  border-radius: var(--bi-radius);
  overflow: hidden;
  max-width: 800px;
  min-width: 280px;
}

/* ===== HEADER ===== */
.bi-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--bi-border);
}

.bi-header-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bi-pin-icon {
  flex-shrink: 0;
}

.bi-neighborhood-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--bi-text);
}

.bi-header-meta {
  margin-top: 4px;
  font-size: 13px;
  color: var(--bi-text-secondary);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.bi-localidad {
  font-size: 13px;
}

.bi-meta-separator {
  margin: 0 2px;
}

.bi-estrato-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  cursor: help;
  position: relative;
}

.bi-theme-light .bi-estrato-badge {
  color: #5F6368;
  background: #F1F3F4;
}

.bi-theme-dark .bi-estrato-badge {
  color: #9AA0A6;
  background: #3C4043;
}

.bi-estrato-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
  width: 260px;
  z-index: 10;
  pointer-events: none;
}

.bi-theme-light .bi-estrato-tooltip {
  background: #202124;
  color: #fff;
}

.bi-theme-dark .bi-estrato-tooltip {
  background: #E8EAED;
  color: #202124;
}

.bi-header-coords {
  margin-top: 2px;
  font-size: 11px;
  color: var(--bi-text-secondary);
  opacity: 0.7;
}

/* ===== SCORE RINGS ===== */
.bi-score-rings {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--bi-border);
  overflow-x: auto;
}

.bi-score-ring-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  min-width: 56px;
  color: var(--bi-text);
  font-family: inherit;
  transition: background 0.15s;
}

.bi-score-ring-btn:hover {
  background: var(--bi-surface);
}

.bi-score-ring-btn:focus-visible {
  outline: 2px solid var(--bi-primary);
  outline-offset: 2px;
}

.bi-score-svg {
  display: block;
}

.bi-score-number {
  font-size: 18px;
  font-weight: 700;
  font-family: inherit;
}

.bi-score-label {
  font-size: 11px;
  color: var(--bi-text-secondary);
  white-space: nowrap;
}

.bi-score-limited {
  font-size: 10px;
  color: var(--bi-text-secondary);
}

/* ===== RADIUS SELECTOR ===== */
.bi-radius {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--bi-border);
}

.bi-radius-label {
  font-size: 12px;
  color: var(--bi-text-secondary);
  margin-right: 4px;
}

.bi-radius-btn {
  font-size: 12px;
  padding: 3px 10px;
  border: 1px solid var(--bi-border);
  border-radius: 12px;
  background: none;
  color: var(--bi-text-secondary);
  cursor: pointer;
  font-family: inherit;
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

/* ===== CATEGORY CARDS ===== */
.bi-categories {
  list-style: none;
  margin: 0;
  padding: 0;
}

.bi-category-card {
  border-bottom: 1px solid var(--bi-border);
}

.bi-category-card:last-child {
  border-bottom: none;
}

.bi-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--bi-text);
  text-align: left;
  transition: background 0.15s;
}

.bi-card-header:hover {
  background: var(--bi-surface);
}

.bi-card-header:focus-visible {
  outline: 2px solid var(--bi-primary);
  outline-offset: -2px;
}

.bi-chevron {
  flex-shrink: 0;
  transition: transform 0.2s;
  color: var(--bi-text-secondary);
}

.bi-chevron-open {
  transform: rotate(90deg);
}

.bi-card-title {
  flex: 1;
}

.bi-card-score {
  font-weight: 600;
  font-size: 13px;
}

.bi-card-panel {
  padding: 0 16px 12px 40px;
  animation: bi-slideDown 0.2s ease-out;
}

@keyframes bi-slideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes bi-slideDown {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .bi-chevron { transition: none; }
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
}

.bi-bar-track {
  flex: 1;
  height: 6px;
  background: var(--bi-surface);
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
  padding-top: 6px;
  border-top: 1px solid var(--bi-border);
}

.bi-card-sources {
  font-size: 11px;
  color: var(--bi-text-secondary);
  opacity: 0.7;
  margin-top: 6px;
}

.bi-no-data {
  font-size: 13px;
  color: var(--bi-text-secondary);
}

.bi-no-data p {
  margin: 0 0 4px;
}

/* ===== FOOTER ===== */
.bi-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  font-size: 11px;
  color: var(--bi-text-secondary);
  background: var(--bi-surface);
}

.bi-footer-sources {
  opacity: 0.8;
}

.bi-footer-radius {
  opacity: 0.8;
}

/* ===== ERROR STATE ===== */
.bi-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
  text-align: center;
  gap: 12px;
}

.bi-error-icon {
  opacity: 0.8;
}

.bi-error-message {
  font-size: 14px;
  color: var(--bi-text-secondary);
  margin: 0;
  max-width: 300px;
}

.bi-error-retry {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--bi-primary);
  background: none;
  border: 1px solid var(--bi-primary);
  border-radius: 16px;
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
  padding: 16px;
}

.bi-skeleton-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.bi-skeleton-line {
  height: 12px;
  background: var(--bi-surface);
  border-radius: 6px;
  animation: bi-pulse 1.5s ease-in-out infinite;
}

.bi-skeleton-w30 { width: 30%; }
.bi-skeleton-w40 { width: 40%; }
.bi-skeleton-w60 { width: 60%; }
.bi-skeleton-w80 { width: 80%; }

.bi-skeleton-scores {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-bottom: 20px;
}

.bi-skeleton-ring {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--bi-surface);
  animation: bi-pulse 1.5s ease-in-out infinite;
}

.bi-skeleton-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bi-skeleton-card {
  padding: 12px;
  border-radius: 6px;
  background: var(--bi-surface);
  animation: bi-pulse 1.5s ease-in-out infinite;
}

.bi-skeleton-card .bi-skeleton-line {
  background: var(--bi-border);
}

@keyframes bi-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes bi-pulse {
    0%, 100% { opacity: 0.7; }
  }
}

/* ===== RESPONSIVE: Compact mode ===== */
.bi-compact .bi-score-rings {
  gap: 8px;
  padding: 12px;
}

.bi-compact .bi-score-ring-btn {
  min-width: 48px;
}

.bi-compact .bi-count-label {
  min-width: 80px;
}

/* Container-based responsive adjustments */
@container (max-width: 360px) {
  .bi-score-rings {
    gap: 6px;
    padding: 10px 8px;
  }
  .bi-count-label {
    min-width: 70px;
    font-size: 12px;
  }
  .bi-count-value {
    min-width: 50px;
    font-size: 11px;
  }
}

@container (min-width: 600px) {
  .bi-header-top {
    font-size: 18px;
  }
  .bi-score-rings {
    gap: 20px;
    padding: 20px;
  }
  .bi-score-ring-btn {
    min-width: 72px;
  }
  .bi-score-number {
    font-size: 22px;
  }
}
`;
