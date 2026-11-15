import { describe, expect, it } from 'vitest';
import { buildMarketplaceBroadLocation } from '../src/utils/marketplace';

describe('buildMarketplaceBroadLocation', () => {
  it('joins site name and report address', () => {
    expect(buildMarketplaceBroadLocation('CNU School', 'Floor 1')).toBe('CNU School, Floor 1');
  });

  it('uses whichever part is present', () => {
    expect(buildMarketplaceBroadLocation('CNU School', null)).toBe('CNU School');
    expect(buildMarketplaceBroadLocation(null, 'Floor 1')).toBe('Floor 1');
    expect(buildMarketplaceBroadLocation('  ', '  ')).toBe('');
  });

  it('caps length at 160 characters', () => {
    const site = 'A'.repeat(100);
    const address = 'B'.repeat(100);
    expect(buildMarketplaceBroadLocation(site, address)).toHaveLength(160);
  });
});
