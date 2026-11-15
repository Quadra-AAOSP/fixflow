import { describe, expect, it } from 'vitest';

import {
  isMoreMenuItemVisible,
  MORE_MENU_ROLE_VISIBILITY,
} from '../constants/moreMenuVisibility';

describe('More menu role visibility', () => {
  it('exposes marketplace to admin, super_admin, and technician', () => {
    expect(MORE_MENU_ROLE_VISIBILITY.marketplace).toEqual([
      'admin',
      'super_admin',
      'technician',
    ]);
    expect(isMoreMenuItemVisible('marketplace', 'super_admin')).toBe(true);
    expect(isMoreMenuItemVisible('marketplace', 'staff')).toBe(false);
  });

  it('limits contracted job offers to technicians', () => {
    expect(isMoreMenuItemVisible('jobOffers', 'technician')).toBe(true);
    expect(isMoreMenuItemVisible('jobOffers', 'admin')).toBe(false);
  });

  it('exposes all-reports oversight to super_admin only', () => {
    expect(isMoreMenuItemVisible('allReports', 'super_admin')).toBe(true);
    expect(isMoreMenuItemVisible('allReports', 'admin')).toBe(true);
    expect(isMoreMenuItemVisible('allReports', 'staff')).toBe(false);
  });

  it('keeps sites and technicians hubs for admins; contracts flat for staff', () => {
    expect(isMoreMenuItemVisible('sites', 'super_admin')).toBe(true);
    expect(isMoreMenuItemVisible('technicians', 'super_admin')).toBe(true);
    expect(isMoreMenuItemVisible('contractsAdmin', 'staff')).toBe(true);
    expect(isMoreMenuItemVisible('verificationReviews', 'super_admin')).toBe(true);
  });

  it('does not expose a separate admin-applications menu key', () => {
    expect(
      Object.prototype.hasOwnProperty.call(MORE_MENU_ROLE_VISIBILITY, 'adminApplications'),
    ).toBe(false);
  });
});
