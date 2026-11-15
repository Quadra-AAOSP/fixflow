import { describe, expect, it } from 'vitest';

import {
  formatMarketplaceTimingDisplay,
  isMarketplaceDateTimeTiming,
  parseMarketplaceTimingValue,
  toMarketplaceTimingValue,
} from '../utils/marketplace';

describe('marketplace timing date+time helpers', () => {
  it('round-trips local datetime values', () => {
    const source = new Date(2026, 10, 20, 14, 30, 45, 123);
    const value = toMarketplaceTimingValue(source);
    expect(value).toBe('2026-11-20T14:30');
    expect(isMarketplaceDateTimeTiming(value)).toBe(true);
    const parsed = parseMarketplaceTimingValue(value);
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(10);
    expect(parsed?.getDate()).toBe(20);
    expect(parsed?.getHours()).toBe(14);
    expect(parsed?.getMinutes()).toBe(30);
  });

  it('rejects legacy free-text timings', () => {
    expect(isMarketplaceDateTimeTiming('This week')).toBe(false);
    expect(parseMarketplaceTimingValue('Within 3 business days')).toBeNull();
    expect(formatMarketplaceTimingDisplay('This week')).toBe('This week');
  });
});
