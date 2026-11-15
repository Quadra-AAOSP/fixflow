import { describe, expect, it } from 'vitest';

import { buildPlatformDashboardData } from '../utils/platformDashboard';

const site = {
  id: 8,
  name: 'North campus',
  type: 'school' as const,
  contractStatus: 'contracted' as const,
  address: null,
  description: null,
  imageUrl: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

describe('buildPlatformDashboardData', () => {
  it('counts only pending reviews and preserves the platform-wide queue summary', () => {
    const result = buildPlatformDashboardData(
      [site],
      [
        { id: 1, userId: 31, siteId: 8, status: 'pending', createdAt: '', decidedAt: null, decidedBy: null },
        { id: 2, userId: 32, siteId: 8, status: 'approved', createdAt: '', decidedAt: '', decidedBy: 1 },
      ],
      [
        { technicianId: 41, status: 'pending', email: '', phone: '', trades: '', experience: '', qualifications: '', identityChecked: false, emailChecked: false, phoneChecked: false, tradeChecked: false, version: 0 },
        { technicianId: 42, status: 'verified', email: '', phone: '', trades: '', experience: '', qualifications: '', identityChecked: true, emailChecked: true, phoneChecked: true, tradeChecked: true, version: 1 },
      ],
      [],
      true,
    );

    expect(result).toEqual({
      sites: [site],
      pendingAdmins: 1,
      pendingTechnicians: 1,
      unattended: [],
      moreUnattended: true,
    });
  });
});
