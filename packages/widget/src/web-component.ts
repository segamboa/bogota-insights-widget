import { h, render } from 'preact';
import { Widget, type WidgetProps } from './components/Widget';
import { ErrorBoundary } from './components/ErrorBoundary';
import { widgetStyles } from './styles/widget.css';

const OBSERVED_ATTRS = [
  'lat',
  'lng',
  'radius',
  'lang',
  'theme',
  'api-key',
  'api-base-url',
  'show-estrato',
  'compact',
  'use-mock',
] as const;

export class BogotaInsightsElement extends HTMLElement {
  private _root: ShadowRoot;
  private _container: HTMLDivElement;

  static get observedAttributes() {
    return [...OBSERVED_ATTRS];
  }

  constructor() {
    super();
    this._root = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = widgetStyles;
    this._root.appendChild(style);

    this._container = document.createElement('div');
    this._container.style.containerType = 'inline-size';
    this._root.appendChild(this._container);
  }

  connectedCallback() {
    this._render();
  }

  attributeChangedCallback() {
    this._render();
  }

  disconnectedCallback() {
    render(null, this._container);
  }

  private _getProps(): WidgetProps | null {
    const lat = parseFloat(this.getAttribute('lat') ?? '');
    const lng = parseFloat(this.getAttribute('lng') ?? '');

    if (isNaN(lat) || isNaN(lng)) return null;

    return {
      lat,
      lng,
      radius: parseInt(this.getAttribute('radius') ?? '1000', 10),
      lang: (this.getAttribute('lang') as 'es' | 'en') ?? 'es',
      theme: (this.getAttribute('theme') as 'light' | 'dark') ?? 'light',
      apiKey: this.getAttribute('api-key') ?? undefined,
      apiBaseUrl: this.getAttribute('api-base-url') ?? undefined,
      showEstrato: this.getAttribute('show-estrato') !== 'false',
      compact: this.getAttribute('compact') === 'true',
      useMock: this.getAttribute('use-mock') === 'true',
    };
  }

  private _render() {
    const props = this._getProps();
    if (!props) {
      render(
        h('div', { style: { padding: '16px', color: '#D93025', fontSize: '14px' } },
          'Invalid or missing lat/lng attributes.'),
        this._container
      );
      return;
    }

    render(h(ErrorBoundary, null, h(Widget, props)), this._container);
  }
}

export function register(tagName = 'bogota-insights') {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, BogotaInsightsElement);
  }
}
