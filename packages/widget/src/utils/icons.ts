import { h } from 'preact';

export function transportIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 20, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('rect', { x: 3, y: 6, width: 18, height: 12, rx: 2 }),
    h('path', { d: 'M6 18v2M18 18v2M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M9 10h6' }),
  ]);
}

export function commerceIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 20, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('path', { d: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z' }),
    h('line', { x1: 3, y1: 6, x2: 21, y2: 6 }),
    h('path', { d: 'M16 10a4 4 0 0 1-8 0' }),
  ]);
}

export function educationIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 20, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }),
    h('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' }),
  ]);
}

export function healthIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 20, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' }),
  ]);
}

export function recreationIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 20, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('circle', { cx: 12, cy: 12, r: 10 }),
    h('path', { d: 'M8 14s1.5 2 4 2 4-2 4-2' }),
    h('line', { x1: 9, y1: 9, x2: 9.01, y2: 9 }),
    h('line', { x1: 15, y1: 9, x2: 15.01, y2: 9 }),
  ]);
}

export function locationPinIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 16, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: color,
  }, [
    h('path', { d: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' }),
  ]);
}

export function investmentIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 20, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('polyline', { points: '23 6 13.5 15.5 8.5 10.5 1 18' }),
    h('polyline', { points: '17 6 23 6 23 12' }),
  ]);
}

export function trendUpIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 14, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('polyline', { points: '23 6 13.5 15.5 8.5 10.5 1 18' }),
  ]);
}

export function trendDownIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 14, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('polyline', { points: '23 18 13.5 8.5 8.5 13.5 1 6' }),
  ]);
}

export function trendStableIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 14, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('line', { x1: 5, y1: 12, x2: 19, y2: 12 }),
  ]);
}

export function chevronRightIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 16, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('polyline', { points: '9 18 15 12 9 6' }),
  ]);
}

export function chevronDownIcon(props: { size?: number; color?: string } = {}): any {
  const { size = 16, color = 'currentColor' } = props;
  return h('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, [
    h('polyline', { points: '6 9 12 15 18 9' }),
  ]);
}
