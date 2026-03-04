import { register } from './web-component';

// Auto-register the custom element
register();

// Re-export for programmatic usage
export { register, BogotaInsightsElement } from './web-component';
export { Widget } from './components/Widget';
export type { WidgetProps } from './components/Widget';
