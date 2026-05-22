import { describe, expect, it } from 'vitest';
import { daysBetween } from '../../../shared/utils/dateHelpers';

describe('transport row count from order dates', () => {
  const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();

  it('one calendar day => one transport trip', () => {
    const from = iso(2026, 5, 15);
    const to = iso(2026, 5, 15);
    expect(daysBetween(from, to)).toBe(1);
  });

  it('two calendar days => two transport trips', () => {
    const from = iso(2026, 5, 15);
    const to = iso(2026, 5, 16);
    expect(daysBetween(from, to)).toBe(2);
  });
});
