import { describe, expect, it } from 'vitest';

import type { UserRole } from '../types';
import {
  homeRouteForRole,
  isTabVisible,
  isTechnicianForbiddenRoute,
  landingRedirectForRoute,
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

  it('shows staff only the Staff Dashboard and Profile', () => {
    expect(isTabVisible('staff', 'index')).toBe(false);
    expect(isTabVisible('staff', 'reports')).toBe(false);
    expect(isTabVisible('staff', 'workspace')).toBe(false);
    expect(isTabVisible('staff', 'assignments')).toBe(false);
    expect(isTabVisible('staff', 'more')).toBe(false);
    expect(isTabVisible('staff', 'profile')).toBe(true);
    expect(isTabVisible('staff', 'staff-dashboard')).toBe(true);
  });

  it('shows every non-technician, non-staff role Home/Reports and hides Workspace/Assignments', () => {
    for (const role of NON_TECHNICIAN_ROLES.filter((candidate) => candidate !== 'staff')) {
      expect(isTabVisible(role, 'index'), role).toBe(true);
      expect(isTabVisible(role, 'reports'), role).toBe(true);
      expect(isTabVisible(role, 'workspace'), role).toBe(false);
      expect(isTabVisible(role, 'assignments'), role).toBe(false);
      expect(isTabVisible(role, 'more'), role).toBe(true);
      expect(isTabVisible(role, 'profile'), role).toBe(true);
      expect(isTabVisible(role, 'staff-dashboard'), role).toBe(false);
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

describe('homeRouteForRole', () => {
  it('routes each role to its own dashboard', () => {
    expect(homeRouteForRole('technician')).toBe('/(tabs)/workspace');
    expect(homeRouteForRole('staff')).toBe('/(tabs)/staff-dashboard');
    expect(homeRouteForRole('reporter')).toBe('/(tabs)');
    expect(homeRouteForRole('admin')).toBe('/(tabs)');
    expect(homeRouteForRole('super_admin')).toBe('/(tabs)');
  });
});

describe('landingRedirectForRoute', () => {
  it('sends staff to the staff dashboard when landing on Home', () => {
    expect(landingRedirectForRoute('staff', '/')).toBe('/(tabs)/staff-dashboard');
  });

  it('sends technicians to Workspace when landing on Home', () => {
    expect(landingRedirectForRoute('technician', '/')).toBe('/(tabs)/workspace');
  });

  it('leaves reporters and admins on Home', () => {
    expect(landingRedirectForRoute('reporter', '/')).toBeNull();
    expect(landingRedirectForRoute('admin', '/')).toBeNull();
  });

  it('bounces a role off a tab route it cannot see', () => {
    expect(landingRedirectForRoute('reporter', '/workspace')).toBe('/(tabs)');
    expect(landingRedirectForRoute('staff', '/reports/5')).toBe('/(tabs)/staff-dashboard');
    expect(landingRedirectForRoute('staff', '/more')).toBe('/(tabs)/staff-dashboard');
  });

  it('allows a role on its own routes', () => {
    expect(landingRedirectForRoute('technician', '/workspace')).toBeNull();
    expect(landingRedirectForRoute('staff', '/staff-dashboard')).toBeNull();
    expect(landingRedirectForRoute('reporter', '/reports')).toBeNull();
    expect(landingRedirectForRoute('reporter', '/profile')).toBeNull();
  });

  it('ignores unauthenticated users', () => {
    expect(landingRedirectForRoute(null, '/workspace')).toBeNull();
  });
});
