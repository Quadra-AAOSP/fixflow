import { describe, expect, it } from 'vitest';

import type { UserRole } from '../types';
import {
  homeRouteForRole,
  isTabVisible,
  isTechnicianForbiddenRoute,
  landingRedirectForRoute,
} from '../lib/tabAccess';

/** The four delivery roles from the weekly reports, plus the two platform extras. */
const CORE_ROLES: UserRole[] = ['reporter', 'technician', 'staff', 'admin'];
const ALL_ROLES: UserRole[] = [...CORE_ROLES, 'super_admin', 'shop_manager'];

const DESTINATIONS = [
  '/',
  '/reports',
  '/reports/42',
  '/workspace',
  '/assignments',
  '/more',
  '/profile',
] as const;

describe('role coverage — every delivery role reaches its own tasks', () => {
  it('reporter: home, reports, more, profile', () => {
    expect(homeRouteForRole('reporter')).toBe('/(tabs)');
    expect(DESTINATIONS.map((path) => landingRedirectForRoute('reporter', path))).toEqual([
      null,
      null,
      null,
      '/(tabs)',
      '/(tabs)',
      null,
      null,
    ]);
  });

  it('technician: workspace, assignments, more, profile — never reports', () => {
    expect(homeRouteForRole('technician')).toBe('/(tabs)/workspace');
    expect(landingRedirectForRoute('technician', '/')).toBe('/(tabs)/workspace');
    expect(landingRedirectForRoute('technician', '/reports')).toBe('/(tabs)/workspace');
    // A deep-linked report detail is also bounced back to the workspace.
    expect(landingRedirectForRoute('technician', '/reports/42')).toBe('/(tabs)/workspace');
    expect(landingRedirectForRoute('technician', '/workspace')).toBeNull();
    expect(landingRedirectForRoute('technician', '/assignments')).toBeNull();
    expect(landingRedirectForRoute('technician', '/more')).toBeNull();
    expect(landingRedirectForRoute('technician', '/profile')).toBeNull();
    expect(isTechnicianForbiddenRoute('technician', '/reports/42')).toBe(true);
    expect(isTechnicianForbiddenRoute('reporter', '/reports/42')).toBe(false);
  });

  it('staff: triage home + reports, no workspace', () => {
    expect(homeRouteForRole('staff')).toBe('/(tabs)');
    expect(isTabVisible('staff', 'reports')).toBe(true);
    expect(isTabVisible('staff', 'workspace')).toBe(false);
    expect(landingRedirectForRoute('staff', '/workspace')).toBe('/(tabs)');
  });

  it('administrator: same operations surface as staff', () => {
    expect(homeRouteForRole('admin')).toBe('/(tabs)');
    expect(isTabVisible('admin', 'reports')).toBe(true);
    expect(isTabVisible('admin', 'workspace')).toBe(false);
    expect(landingRedirectForRoute('admin', '/assignments')).toBe('/(tabs)');
  });

  it('platform roles still land on a valid screen', () => {
    for (const role of ALL_ROLES) {
      const home = homeRouteForRole(role);
      expect(['/(tabs)', '/(tabs)/workspace']).toContain(home);
    }
    expect(isTabVisible('super_admin', 'reports')).toBe(true);
    expect(isTabVisible('shop_manager', 'reports')).toBe(false);
  });

  it('every role can always reach More and Profile', () => {
    for (const role of ALL_ROLES) {
      expect(isTabVisible(role, 'more')).toBe(true);
      expect(isTabVisible(role, 'profile')).toBe(true);
    }
  });

  it('unauthenticated users are never redirected by the tab guard', () => {
    for (const path of DESTINATIONS) {
      expect(landingRedirectForRoute(null, path)).toBeNull();
    }
  });
});
