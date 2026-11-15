import { describe, expect, it } from 'vitest';

import { parseOfferAmountMinor } from '../utils/jobOfferAmount';

describe('parseOfferAmountMinor', () => {
  it('converts major units to minor units for send-offer gating', () => {
    expect(parseOfferAmountMinor('125.00')).toBe(12500);
    expect(parseOfferAmountMinor('0.01')).toBe(1);
  });

  it('rejects empty, zero, and non-numeric amounts', () => {
    expect(parseOfferAmountMinor('')).toBeNull();
    expect(parseOfferAmountMinor('0')).toBeNull();
    expect(parseOfferAmountMinor('abc')).toBeNull();
    expect(parseOfferAmountMinor('-5')).toBeNull();
  });
});
