import { describe, expect, it } from 'vitest';

import type { UserRole } from '../types';
import {
  homeRouteForRole,
  isTabVisible,
  isTechnicianForbiddenRoute,
  landingRedirectForRoute,
  type TabName,
} from '../lib/tabAccess';

const ALL_ROLES: UserRole[] = [
  'reporter', 'technician', 'staff', 'admin', 'super_admin', 'shop_manager',
];

const TABS: TabName[] = ['index', 'reports', 'workspace', 'assignments', 'more', 'profile', 'staff-dashboard'];

describe('isTabVisible — complete role→tab matrix', () => {
  // ── Technician ────────────────────────────────────────────────────────
  it('technician: workspace, assignments, more, profile', () => {
    expect(isTabVisible('technician', 'index')).toBe(false);
    expect(isTabVisible('technician', 'reports')).toBe(false);
    expect(isTabVisible('technician', 'workspace')).toBe(true);
    expect(isTabVisible('technician', 'assignments')).toBe(true);
    expect(isTabVisible('technician', 'staff-dashboard')).toBe(false);
    expect(isTabVisible('technician', 'more')).toBe(true);
    expect(isTabVisible('technician', 'profile')).toBe(true);
  });

  // ── Staff ─────────────────────────────────────────────────────────────
  it('staff: staff-dashboard, more, profile (no index, no reports, no workspace/assignments)', () => {
    expect(isTabVisible('staff', 'index')).toBe(false);
    expect(isTabVisible('staff', 'reports')).toBe(false);
    expect(isTabVisible('staff', 'workspace')).toBe(false);
    expect(isTabVisible('staff', 'assignments')).toBe(false);
    expect(isTabVisible('staff', 'staff-dashboard')).toBe(true);
    expect(isTabVisible('staff', 'more')).toBe(true);
    expect(isTabVisible('staff', 'profile')).toBe(true);
  });

  // ── Reporter ─────────────────────────────────────────────────────────
  it('reporter: index (Home), reports, more, profile — NO staff/technician tabs', () => {
    expect(isTabVisible('reporter', 'index')).toBe(true);
    expect(isTabVisible('reporter', 'reports')).toBe(true);
    expect(isTabVisible('reporter', 'workspace')).toBe(false);
    expect(isTabVisible('reporter', 'assignments')).toBe(false);
    expect(isTabVisible('reporter', 'staff-dashboard')).toBe(false);
    expect(isTabVisible('reporter', 'more')).toBe(true);
    expect(isTabVisible('reporter', 'profile')).toBe(true);
  });

  // ── Admin ────────────────────────────────────────────────────────────
  it('admin: index, reports, more, profile — NO staff/technician tabs', () => {
    expect(isTabVisible('admin', 'index')).toBe(true);
    expect(isTabVisible('admin', 'reports')).toBe(true);
    expect(isTabVisible('admin', 'workspace')).toBe(false);
    expect(isTabVisible('admin', 'assignments')).toBe(false);
    expect(isTabVisible('admin', 'staff-dashboard')).toBe(false);
    expect(isTabVisible('admin', 'more')).toBe(true);
    expect(isTabVisible('admin', 'profile')).toBe(true);
  });

  // ── Super admin ──────────────────────────────────────────────────────
  it('super_admin: index (Platform Console), reports, more, profile — NO staff/technician tabs', () => {
    expect(isTabVisible('super_admin', 'index')).toBe(true);
    expect(isTabVisible('super_admin', 'reports')).toBe(true);
    expect(isTabVisible('super_admin', 'workspace')).toBe(false);
    expect(isTabVisible('super_admin', 'assignments')).toBe(false);
    expect(isTabVisible('super_admin', 'staff-dashboard')).toBe(false);
    expect(isTabVisible('super_admin', 'more')).toBe(true);
    expect(isTabVisible('super_admin', 'profile')).toBe(true);
  });

  // ── Shop manager ─────────────────────────────────────────────────────
  it('shop_manager: index, more, profile — NO reports (shop-only role)', () => {
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
  it('routes each role to its own dashboard', () => {
    expect(homeRouteForRole('technician')).toBe('/(tabs)/workspace');
    expect(homeRouteForRole('staff')).toBe('/(tabs)/staff-dashboard');
    expect(homeRouteForRole('reporter')).toBe('/(tabs)');
    expect(homeRouteForRole('admin')).toBe('/(tabs)');
    expect(homeRouteForRole('super_admin')).toBe('/(tabs)');
    expect(homeRouteForRole('shop_manager')).toBe('/(tabs)');
  });
});

describe('landingRedirectForRoute', () => {
  // ── Home landing ─────────────────────────────────────────────────────
  it('sends staff to the staff dashboard when landing on Home', () => {
    expect(landingRedirectForRoute('staff', '/')).toBe('/(tabs)/staff-dashboard');
  });

  it('sends technicians to Workspace when landing on Home', () => {
    expect(landingRedirectForRoute('technician', '/')).toBe('/(tabs)/workspace');
  });

  it('leaves reporters, admins, super_admins, shop_managers on Home', () => {
    expect(landingRedirectForRoute('reporter', '/')).toBeNull();
    expect(landingRedirectForRoute('admin', '/')).toBeNull();
    expect(landingRedirectForRoute('super_admin', '/')).toBeNull();
    expect(landingRedirectForRoute('shop_manager', '/')).toBeNull();
  });

  // ── Bounce off forbidden tabs ────────────────────────────────────────
  it('bounces staff off Reports, Workspace, Assignments to Staff Dashboard', () => {
    expect(landingRedirectForRoute('staff', '/reports/5')).toBe('/(tabs)/staff-dashboard');
    expect(landingRedirectForRoute('staff', '/workspace')).toBe('/(tabs)/staff-dashboard');
    expect(landingRedirectForRoute('staff', '/assignments')).toBe('/(tabs)/staff-dashboard');
  });

  it('bounces reporter off Workspace, Assignments, Staff Dashboard to Home', () => {
    expect(landingRedirectForRoute('reporter', '/workspace')).toBe('/(tabs)');
    expect(landingRedirectForRoute('reporter', '/assignments')).toBe('/(tabs)');
    expect(landingRedirectForRoute('reporter', '/staff-dashboard')).toBe('/(tabs)');
  });

  it('bounces shop_manager off Reports to Home', () => {
    expect(landingRedirectForRoute('shop_manager', '/reports/5')).toBe('/(tabs)');
  });

  // ── Allow valid routes ───────────────────────────────────────────────
  it('allows every role on its own tabs', () => {
    expect(landingRedirectForRoute('technician', '/workspace')).toBeNull();
    expect(landingRedirectForRoute('technician', '/assignments')).toBeNull();
    expect(landingRedirectForRoute('staff', '/staff-dashboard')).toBeNull();
    expect(landingRedirectForRoute('staff', '/more')).toBeNull();
    expect(landingRedirectForRoute('staff', '/profile')).toBeNull();
    expect(landingRedirectForRoute('reporter', '/reports')).toBeNull();
    expect(landingRedirectForRoute('reporter', '/profile')).toBeNull();
    expect(landingRedirectForRoute('admin', '/reports')).toBeNull();
    expect(landingRedirectForRoute('admin', '/more')).toBeNull();
    expect(landingRedirectForRoute('super_admin', '/reports')).toBeNull();
    expect(landingRedirectForRoute('super_admin', '/more')).toBeNull();
    expect(landingRedirectForRoute('shop_manager', '/more')).toBeNull();
    expect(landingRedirectForRoute('shop_manager', '/profile')).toBeNull();
  });

  it('ignores unauthenticated users', () => {
    expect(landingRedirectForRoute(null, '/workspace')).toBeNull();
  });
});
