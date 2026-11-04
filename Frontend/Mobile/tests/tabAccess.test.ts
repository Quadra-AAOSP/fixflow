import { describe, expect, it } from 'vitest';

import type { UserRole } from '../types';
import {
  homeRouteForRole,
  isTabVisible,
  isTechnicianForbiddenRoute,
  landingRedirectForRoute,
  type TabName,
} from '../lib/tabAccess';

/** All 6 roles defined by the backend UserRole enum. */
const ALL_ROLES: UserRole[] = ['reporter', 'technician', 'staff', 'admin', 'super_admin', 'shop_manager'];

const TABS: TabName[] = ['index', 'reports', 'workspace', 'assignments', 'staff-dashboard', 'more', 'profile'];

describe('isTabVisible — complete 6-role matrix (backend UserRole source of truth)', () => {
  // ── Reporter (basic user) ───────────────────────────────────────────
  it('reporter: Home, Reports, More, Profile', () => {
    expect(isTabVisible('reporter', 'index')).toBe(true);
    expect(isTabVisible('reporter', 'reports')).toBe(true);
    expect(isTabVisible('reporter', 'workspace')).toBe(false);
    expect(isTabVisible('reporter', 'assignments')).toBe(false);
    expect(isTabVisible('reporter', 'staff-dashboard')).toBe(false);
    expect(isTabVisible('reporter', 'more')).toBe(true);
    expect(isTabVisible('reporter', 'profile')).toBe(true);
  });

  // ── Technician ───────────────────────────────────────────────────────
  it('technician: Workspace, Assignments, More, Profile (NO index, NO reports, NO staff-dashboard)', () => {
    expect(isTabVisible('technician', 'index')).toBe(false);
    expect(isTabVisible('technician', 'reports')).toBe(false);
    expect(isTabVisible('technician', 'workspace')).toBe(true);
    expect(isTabVisible('technician', 'assignments')).toBe(true);
    expect(isTabVisible('technician', 'staff-dashboard')).toBe(false);
    expect(isTabVisible('technician', 'more')).toBe(true);
    expect(isTabVisible('technician', 'profile')).toBe(true);
  });

  // ── Staff ───────────────────────────────────────────────────────────
  it('staff: Staff Dashboard, Reports, More, Profile (NO index, NO workspace/assignments)', () => {
    expect(isTabVisible('staff', 'index')).toBe(false);
    expect(isTabVisible('staff', 'reports')).toBe(true);
    expect(isTabVisible('staff', 'workspace')).toBe(false);
    expect(isTabVisible('staff', 'assignments')).toBe(false);
    expect(isTabVisible('staff', 'staff-dashboard')).toBe(true);
    expect(isTabVisible('staff', 'more')).toBe(true);
    expect(isTabVisible('staff', 'profile')).toBe(true);
  });

  // ── Admin (site) ─────────────────────────────────────────────────────
  it('admin: Home, Reports, More, Profile (NO workspace/assignments, NO staff-dashboard)', () => {
    expect(isTabVisible('admin', 'index')).toBe(true);
    expect(isTabVisible('admin', 'reports')).toBe(true);
    expect(isTabVisible('admin', 'workspace')).toBe(false);
    expect(isTabVisible('admin', 'assignments')).toBe(false);
    expect(isTabVisible('admin', 'staff-dashboard')).toBe(false);
    expect(isTabVisible('admin', 'more')).toBe(true);
    expect(isTabVisible('admin', 'profile')).toBe(true);
  });

  // ── Super Admin (platform owner) ────────────────────────────────────
  it('super_admin: Home, Reports, More, Profile (NO workspace/assignments, NO staff-dashboard)', () => {
    expect(isTabVisible('super_admin', 'index')).toBe(true);
    expect(isTabVisible('super_admin', 'reports')).toBe(true);
    expect(isTabVisible('super_admin', 'workspace')).toBe(false);
    expect(isTabVisible('super_admin', 'assignments')).toBe(false);
    expect(isTabVisible('super_admin', 'staff-dashboard')).toBe(false);
    expect(isTabVisible('super_admin', 'more')).toBe(true);
    expect(isTabVisible('super_admin', 'profile')).toBe(true);
  });

  // ── Shop Manager (shop-only) ─────────────────────────────────────────
  it('shop_manager: Home, More, Profile (NO reports, NO workspace/assignments, NO staff-dashboard)', () => {
    expect(isTabVisible('shop_manager', 'index')).toBe(true);
    expect(isTabVisible('shop_manager', 'reports')).toBe(false);
    expect(isTabVisible('shop_manager', 'workspace')).toBe(false);
    expect(isTabVisible('shop_manager', 'assignments')).toBe(false);
    expect(isTabVisible('shop_manager', 'staff-dashboard')).toBe(false);
    expect(isTabVisible('shop_manager', 'more')).toBe(true);
    expect(isTabVisible('shop_manager', 'profile')).toBe(true);
  });

  // ── Every combination returns a boolean (no undefined leaks) ──────────
  it('returns a boolean for every role/tab combination', () => {
    for (const role of ALL_ROLES) {
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
  it('routes technician to Workspace', () => {
    expect(homeRouteForRole('technician')).toBe('/(tabs)/workspace');
  });
  it('routes staff to Staff Dashboard', () => {
    expect(homeRouteForRole('staff')).toBe('/(tabs)/staff-dashboard');
  });
  it('routes reporter, admin, super_admin, shop_manager to Home', () => {
    expect(homeRouteForRole('reporter')).toBe('/(tabs)');
    expect(homeRouteForRole('admin')).toBe('/(tabs)');
    expect(homeRouteForRole('super_admin')).toBe('/(tabs)');
    expect(homeRouteForRole('shop_manager')).toBe('/(tabs)');
  });
});

describe('landingRedirectForRoute', () => {
  // ── Home landing ─────────────────────────────────────────────────────
  it('sends technicians to Workspace when landing on Home', () => {
    expect(landingRedirectForRoute('technician', '/')).toBe('/(tabs)/workspace');
  });
  it('sends staff to Staff Dashboard when landing on Home', () => {
    expect(landingRedirectForRoute('staff', '/')).toBe('/(tabs)/staff-dashboard');
  });
  it('leaves reporter, admin, super_admin, shop_manager on Home', () => {
    expect(landingRedirectForRoute('reporter', '/')).toBeNull();
    expect(landingRedirectForRoute('admin', '/')).toBeNull();
    expect(landingRedirectForRoute('super_admin', '/')).toBeNull();
    expect(landingRedirectForRoute('shop_manager', '/')).toBeNull();
  });

  // ── Bounce off forbidden tabs ────────────────────────────────────────
  it('bounces reporter, admin, super_admin, staff, shop_manager off Workspace & Assignments', () => {
    for (const role of ['reporter', 'admin', 'super_admin', 'staff', 'shop_manager'] as UserRole[]) {
      const expected = role === 'staff' ? '/(tabs)/staff-dashboard' : '/(tabs)';
      expect(landingRedirectForRoute(role, '/workspace')).toBe(expected);
      expect(landingRedirectForRoute(role, '/assignments')).toBe(expected);
    }
  });

  it('bounces technicians off Reports to Workspace', () => {
    expect(landingRedirectForRoute('technician', '/reports/5')).toBe('/(tabs)/workspace');
  });

  it('bounces shop_manager off Reports to Home', () => {
    expect(landingRedirectForRoute('shop_manager', '/reports/5')).toBe('/(tabs)');
  });

  it('bounces everyone except staff off staff-dashboard', () => {
    for (const role of ['reporter', 'technician', 'admin', 'super_admin', 'shop_manager'] as UserRole[]) {
      const expected = role === 'technician' ? '/(tabs)/workspace' : '/(tabs)';
      expect(landingRedirectForRoute(role, '/staff-dashboard')).toBe(expected);
    }
  });

  // ── Allow valid routes ───────────────────────────────────────────────
  it('allows every role on its own tabs', () => {
    expect(landingRedirectForRoute('technician', '/workspace')).toBeNull();
    expect(landingRedirectForRoute('technician', '/assignments')).toBeNull();
    expect(landingRedirectForRoute('technician', '/more')).toBeNull();
    expect(landingRedirectForRoute('staff', '/staff-dashboard')).toBeNull();
    expect(landingRedirectForRoute('staff', '/reports')).toBeNull();
    expect(landingRedirectForRoute('staff', '/more')).toBeNull();
    expect(landingRedirectForRoute('reporter', '/reports')).toBeNull();
    expect(landingRedirectForRoute('reporter', '/more')).toBeNull();
    expect(landingRedirectForRoute('admin', '/reports')).toBeNull();
    expect(landingRedirectForRoute('super_admin', '/reports')).toBeNull();
    expect(landingRedirectForRoute('shop_manager', '/more')).toBeNull();
  });

  it('ignores unauthenticated users', () => {
    expect(landingRedirectForRoute(null, '/workspace')).toBeNull();
  });
});
