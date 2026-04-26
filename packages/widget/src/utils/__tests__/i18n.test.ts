import { describe, it, expect } from 'vitest';
import { t, getCategoryLabel, getScoreLabel } from '../i18n.js';

describe('t', () => {
  it('returns Spanish translation by default', () => {
    expect(t('category.transport')).toBe('Transporte');
  });

  it('returns English when requested', () => {
    expect(t('category.transport', 'en')).toBe('Transport');
  });

  it('falls back to Spanish for missing English keys', () => {
    expect(t('category.nearby', 'en')).toBe('nearby');
  });

  it('returns the key itself if no translation exists', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });
});

describe('getCategoryLabel', () => {
  it('returns Spanish category labels', () => {
    expect(getCategoryLabel('health')).toBe('Salud');
    expect(getCategoryLabel('education')).toBe('Educacion');
  });

  it('returns English category labels', () => {
    expect(getCategoryLabel('health', 'en')).toBe('Health');
  });
});

describe('getScoreLabel', () => {
  it('returns correct labels for score ranges', () => {
    expect(getScoreLabel(30)).toBe('Bajo');
    expect(getScoreLabel(50)).toBe('Moderado');
    expect(getScoreLabel(70)).toBe('Bueno');
    expect(getScoreLabel(90)).toBe('Excelente');
  });
});
