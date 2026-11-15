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
});
