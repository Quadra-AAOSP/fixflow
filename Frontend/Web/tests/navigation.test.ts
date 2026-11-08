import { describe, expect, it } from 'vitest';
import { accountHome } from '../src/utils/navigation';
import type { User } from '../src/types';

const user: User = {
  id: 1, firstName: 'Test', lastName: 'Account', email: 'test@example.invalid',
  phone: null, address: null, siteId: 71, role: 'admin',
};

describe('account landing screens', () => {
  it('takes a site manager to the server-provided site setup', () => {
    expect(accountHome({ ...user, siteOnboarding: {
      siteId: 71, reportingReady: false, setupRequired: true,
      canManageSubsites: true, setupEndpoint: '/api/sites/71/subsites',
    } })).toBe('/sites/71/subsites');
  });
  it('does not send a reporter to an administration screen', () => {
    expect(accountHome({ ...user, role: 'reporter', siteOnboarding: {
      siteId: 71, reportingReady: false, setupRequired: false,
      canManageSubsites: false, setupEndpoint: '/api/sites/71/subsites',
    } })).toBe('/reporter');
  });
  it('shows pending applicants their status and keeps approved users in their workspace', () => {
    expect(accountHome({ ...user, role: 'reporter', applicationOnly: true, adminApplication: { id: 4, status: 'pending' } })).toBe('/application-access');
    expect(accountHome({ ...user, adminApplication: { id: 4, status: 'approved' } })).toBe('/');
  });
  it('routes independent technicians and shop managers to their own area', () => {
    expect(accountHome({ ...user, siteId: null, role: 'technician' })).toBe('/technician');
    expect(accountHome({ ...user, siteId: null, role: 'shop_manager' })).toBe('/shop');
  });
});
