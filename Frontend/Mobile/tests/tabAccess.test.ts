import { describe, expect, it } from 'vitest';

import type { UserRole } from '../types';
import {
  isTabVisible,
  isTechnicianForbiddenRoute,
  type TabName,
} from '../lib/tabAccess';

const NON_TECHNICIAN_ROLES: UserRole[] = [
  'reporter',
  'staff',
  'admin',
  'super_admin',
  'shop_manager',
];

const TABS: TabName[] = ['index', 'reports', 'workspace', 'assignments', 'more', 'profile'];

describe('isTabVisible', () => {
  it('shows technicians Workspace/Assignments and hides Home/Reports', () => {
    expect(isTabVisible('technician', 'index')).toBe(false);
    expect(isTabVisible('technician', 'reports')).toBe(false);
    expect(isTabVisible('technician', 'workspace')).toBe(true);
    expect(isTabVisible('technician', 'assignments')).toBe(true);
    expect(isTabVisible('technician', 'more')).toBe(true);
    expect(isTabVisible('technician', 'profile')).toBe(true);
  });

  it('shows every non-technician role Home/Reports and hides Workspace/Assignments', () => {
    for (const role of NON_TECHNICIAN_ROLES) {
      expect(isTabVisible(role, 'index'), role).toBe(true);
      expect(isTabVisible(role, 'reports'), role).toBe(true);
      expect(isTabVisible(role, 'workspace'), role).toBe(false);
      expect(isTabVisible(role, 'assignments'), role).toBe(false);
      expect(isTabVisible(role, 'more'), role).toBe(true);
      expect(isTabVisible(role, 'profile'), role).toBe(true);
    }
  });

  it('returns a boolean for every role/tab combination', () => {
    for (const role of ['technician', ...NON_TECHNICIAN_ROLES] as UserRole[]) {
      for (const tab of TABS) {
        expect(typeof isTabVisible(role, tab)).toBe('boolean');
      }
    }
  });
});

describe('isTechnicianForbiddenRoute', () => {
  it('bounces technicians off Home and Reports routes', () => {
    expect(isTechnicianForbiddenRoute('technician', '/')).toBe(true);
    expect(isTechnicianForbiddenRoute('technician', '/reports/12')).toBe(true);
  });

  it('allows technicians on their own routes', () => {
    expect(isTechnicianForbiddenRoute('technician', '/assignments')).toBe(false);
    expect(isTechnicianForbiddenRoute('technician', '/workspace')).toBe(false);
    expect(isTechnicianForbiddenRoute('technician', '/more')).toBe(false);
  });

  it('never bounces unauthenticated or non-technician users', () => {
    expect(isTechnicianForbiddenRoute(null, '/')).toBe(false);
    expect(isTechnicianForbiddenRoute('admin', '/reports/1')).toBe(false);
  });
});
