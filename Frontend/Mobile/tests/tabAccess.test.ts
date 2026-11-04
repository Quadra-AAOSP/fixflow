import { describe, expect, it } from 'vitest';

import type { UserRole } from '../types';
import {
  homeRouteForRole,
  isTabVisible,
  isTechnicianForbiddenRoute,
  landingRedirectForRoute,
  type TabName,
} from '../lib/tabAccess';

/**
 * Product roles on mobile (backend still has all 6 values — staff and
 * shop_manager are treated identically to super_admin per product decision).
 */
const PRODUCT_ROLES: UserRole[] = ['reporter', 'technician', 'admin', 'super_admin'];
// Backend values that fold into super_admin on mobile
const SUPER_ADMIN_FOLDED: UserRole[] = ['staff', 'shop_manager'];

const ALL_ROLES: UserRole[] = [...PRODUCT_ROLES, ...SUPER_ADMIN_FOLDED];

const TABS: TabName[] = ['index', 'reports', 'workspace', 'assignments', 'more', 'profile'];

describe('isTabVisible — complete role→tab matrix', () => {
  // ── Reporter ────────────────────────────────────────────────────────
  it('reporter: Home (index), Reports, More, Profile', () => {
    expect(isTabVisible('reporter', 'index')).toBe(true);
    expect(isTabVisible('reporter', 'reports')).toBe(true);
    expect(isTabVisible('reporter', 'workspace')).toBe(false);
    expect(isTabVisible('reporter', 'assignments')).toBe(false);
    expect(isTabVisible('reporter', 'more')).toBe(true);
    expect(isTabVisible('reporter', 'profile')).toBe(true);
  });

  // ── Technician ───────────────────────────────────────────────────────
  it('technician: Workspace, Assignments, More, Profile (NO index, NO reports)', () => {
    expect(isTabVisible('technician', 'index')).toBe(false);
    expect(isTabVisible('technician', 'reports')).toBe(false);
    expect(isTabVisible('technician', 'workspace')).toBe(true);
    expect(isTabVisible('technician', 'assignments')).toBe(true);
    expect(isTabVisible('technician', 'more')).toBe(true);
    expect(isTabVisible('technician', 'profile')).toBe(true);
  });

  // ── Site admin ───────────────────────────────────────────────────────
  it('admin (site): Home (index), Reports, More, Profile', () => {
    expect(isTabVisible('admin', 'index')).toBe(true);
    expect(isTabVisible('admin', 'reports')).toBe(true);
    expect(isTabVisible('admin', 'workspace')).toBe(false);
    expect(isTabVisible('admin', 'assignments')).toBe(false);
    expect(isTabVisible('admin', 'more')).toBe(true);
    expect(isTabVisible('admin', 'profile')).toBe(true);
  });

  // ── Super admin (platform owner, shop manager) ───────────────────────
  it('super_admin: Home (index / Platform Console), Reports, More, Profile', () => {
    expect(isTabVisible('super_admin', 'index')).toBe(true);
    expect(isTabVisible('super_admin', 'reports')).toBe(true);
    expect(isTabVisible('super_admin', 'workspace')).toBe(false);
    expect(isTabVisible('super_admin', 'assignments')).toBe(false);
    expect(isTabVisible('super_admin', 'more')).toBe(true);
    expect(isTabVisible('super_admin', 'profile')).toBe(true);
  });

  // ── Folded backend values (staff, shop_manager) behave like super_admin ──
  it('staff and shop_manager fold into super_admin tab set', () => {
    for (const folded of SUPER_ADMIN_FOLDED) {
      expect(isTabVisible(folded, 'index')).toBe(true);
      expect(isTabVisible(folded, 'reports')).toBe(true);
      expect(isTabVisible(folded, 'workspace')).toBe(false);
      expect(isTabVisible(folded, 'assignments')).toBe(false);
      expect(isTabVisible(folded, 'more')).toBe(true);
      expect(isTabVisible(folded, 'profile')).toBe(true);
    }
  });

  // ── Every combination returns a boolean ───────────────────────────────
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
  it('routes everyone else to Home (index)', () => {
    expect(homeRouteForRole('reporter')).toBe('/(tabs)');
    expect(homeRouteForRole('admin')).toBe('/(tabs)');
    expect(homeRouteForRole('super_admin')).toBe('/(tabs)');
    // folded backend values also land on Home
    expect(homeRouteForRole('staff')).toBe('/(tabs)');
    expect(homeRouteForRole('shop_manager')).toBe('/(tabs)');
  });
});

describe('landingRedirectForRoute', () => {
  // ── Home landing ─────────────────────────────────────────────────────
  it('sends technicians to Workspace when landing on Home', () => {
    expect(landingRedirectForRoute('technician', '/')).toBe('/(tabs)/workspace');
  });

  it('leaves reporter, admin, super_admin (+ staff/shop_manager folded) on Home', () => {
    expect(landingRedirectForRoute('reporter', '/')).toBeNull();
    expect(landingRedirectForRoute('admin', '/')).toBeNull();
    expect(landingRedirectForRoute('super_admin', '/')).toBeNull();
    expect(landingRedirectForRoute('staff', '/')).toBeNull();
    expect(landingRedirectForRoute('shop_manager', '/')).toBeNull();
  });

  // ── Bounce off forbidden tabs ────────────────────────────────────────
  it('bounces reporter, admin, super_admin, staff, shop_manager off Workspace & Assignments', () => {
    for (const role of ['reporter', 'admin', 'super_admin', 'staff', 'shop_manager'] as UserRole[]) {
      expect(landingRedirectForRoute(role, '/workspace')).toBe('/(tabs)');
      expect(landingRedirectForRoute(role, '/assignments')).toBe('/(tabs)');
    }
  });

  it('bounces technicians off Reports to Workspace', () => {
    expect(landingRedirectForRoute('technician', '/reports/5')).toBe('/(tabs)/workspace');
  });

  // ── Allow valid routes ───────────────────────────────────────────────
  it('allows every role on its own tabs', () => {
    expect(landingRedirectForRoute('technician', '/workspace')).toBeNull();
    expect(landingRedirectForRoute('technician', '/assignments')).toBeNull();
    expect(landingRedirectForRoute('technician', '/more')).toBeNull();
    expect(landingRedirectForRoute('reporter', '/reports')).toBeNull();
    expect(landingRedirectForRoute('reporter', '/more')).toBeNull();
    expect(landingRedirectForRoute('reporter', '/profile')).toBeNull();
    expect(landingRedirectForRoute('admin', '/reports')).toBeNull();
    expect(landingRedirectForRoute('super_admin', '/reports')).toBeNull();
    expect(landingRedirectForRoute('staff', '/reports')).toBeNull();
    expect(landingRedirectForRoute('shop_manager', '/more')).toBeNull();
  });

  it('ignores unauthenticated users', () => {
    expect(landingRedirectForRoute(null, '/workspace')).toBeNull();
  });
});
