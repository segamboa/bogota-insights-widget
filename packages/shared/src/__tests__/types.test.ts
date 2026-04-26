import { describe, it, expect } from 'vitest';
import { BOGOTA_BOUNDS, ERROR_CODES } from '../types.js';

describe('BOGOTA_BOUNDS', () => {
  it('defines valid bounding box for Bogotá', () => {
    expect(BOGOTA_BOUNDS.north).toBeGreaterThan(BOGOTA_BOUNDS.south);
    expect(BOGOTA_BOUNDS.east).toBeGreaterThan(BOGOTA_BOUNDS.west);
  });
});

describe('ERROR_CODES', () => {
  it('contains expected error codes', () => {
    expect(ERROR_CODES.INVALID_COORDINATES).toBe('INVALID_COORDINATES');
    expect(ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
    expect(ERROR_CODES.INVALID_API_KEY).toBe('INVALID_API_KEY');
  });
});
