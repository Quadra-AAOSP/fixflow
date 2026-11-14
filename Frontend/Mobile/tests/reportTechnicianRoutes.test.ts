import { describe, expect, it } from 'vitest';
import { reportTechnicianRoutes } from '../utils/reportTechnicianRoutes';
import type { User } from '../types';

const report = {
  status: 'open' as const,
  siteId: 12,
  assignedTechnicianId: null,
  policy: { canAssign: true },
};

function account(role: User['role'], siteId: number | null = 12) {
  return { role, siteId };
}

describe('report technician route menu', () => {
  it('puts contracted assignment first and includes marketplace for the site admin', () => {
    expect(reportTechnicianRoutes(report, account('admin'))).toEqual(['contracted', 'marketplace']);
  });

  it('preserves staff assignment and lets super-admin publish to the marketplace', () => {
    expect(reportTechnicianRoutes(report, account('staff'))).toEqual(['contracted']);
    expect(reportTechnicianRoutes(report, account('super_admin', null))).toEqual([
      'contracted',
      'marketplace',
    ]);
  });

  it('omits marketplace publication once a technician has been assigned', () => {
    expect(reportTechnicianRoutes({ ...report, status: 'assigned', assignedTechnicianId: 34 }, account('admin')))
      .toEqual(['contracted']);
  });

  it('omits routes for closed reports and users without routing access', () => {
    expect(reportTechnicianRoutes({ ...report, status: 'resolved_pending_confirmation' }, account('admin'))).toEqual([]);
    const readOnly = { ...report, policy: { canAssign: false } };
    expect(reportTechnicianRoutes(readOnly, account('reporter'))).toEqual([]);
    expect(reportTechnicianRoutes(readOnly, account('admin', 99))).toEqual([]);
  });
});
