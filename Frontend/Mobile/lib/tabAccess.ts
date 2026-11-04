import type { UserRole } from '@/types';

export type TabName = 'index' | 'reports' | 'workspace' | 'assignments' | 'more' | 'profile' | 'staff-dashboard';

/**
 * Which tab bar entries a role sees.
 *
 * Mapping (every role gets 3 or 4 tabs, no role sees more than 4):
 *
 *   reporter    → index,    reports,       more, profile
 *   technician  → workspace, assignments,  more, profile
 *   staff       → staff-dashboard,         more, profile
 *   admin       → index,    reports,       more, profile
 *   super_admin → index,    reports,       more, profile
 *   shop_manager→ index,                   more, profile
 *
 * Site: staff, technician, reporter, admin, super_admin
 * Shop-only: shop_manager (no reports tab)
 * Platform-wide: super_admin
 */
export function isTabVisible(role: UserRole, tab: TabName): boolean {
  switch (tab) {
    // ── Home tabs (one per role family) ──────────────────────────────────
    case 'index':
      // Reporter / admin / super_admin / shop_manager → the role-specific
      // dashboard at /(tabs). Technician has workspace, staff has staff-
      // dashboard — neither sees index.
      return role !== 'technician' && role !== 'staff';
    case 'workspace':
    case 'assignments':
      return role === 'technician';
    case 'staff-dashboard':
      return role === 'staff';

    // ── Second tabs (reports vs assignments) ──────────────────────────────
    case 'reports':
      // Everyone who creates or reviews reports. Technicians use assignments
      // instead. Staff also don't use this — staff manage sites, not reports
      // directly (admins do). Shop managers are shop-only.
      return role === 'reporter' || role === 'admin' || role === 'super_admin';

    // ── Third tab — everyone gets More (Shop for technician/super_admin) ──
    case 'more':
      return true;

    // ── Fourth tab — Profile (everyone) ───────────────────────────────────
    case 'profile':
      return true;

    default:
      return false;
  }
}

/** Technician must be bounced off Home / Reports routes when deep-linked. */
export function isTechnicianForbiddenRoute(role: UserRole | null, pathname: string): boolean {
  return role === 'technician' && (pathname === '/' || pathname.startsWith('/reports'));
}

/** The home tab route each role lands on after sign-in. */
export function homeRouteForRole(role: UserRole): string {
  if (role === 'technician') return '/(tabs)/workspace';
  if (role === 'staff') return '/(tabs)/staff-dashboard';
  // reporter, admin, super_admin, shop_manager → role-specific Home at /(tabs)
  return '/(tabs)';
}

/**
 * Maps a pathname to its top-level tab so we can bounce a role off a route
 * it has no business on (e.g. staff landing on `/`, a reporter deep-linked
 * into `/workspace`). Returns the role's home route, or null when the
 * current route is valid for them.
 */
export function landingRedirectForRoute(role: UserRole | null, pathname: string): string | null {
  if (!role) return null;
  // Strip the route-group segment if present — usePathname() omits it.
  const path = pathname.replace(/^\/\(tabs\)/, '') || '/';
  const home = homeRouteForRole(role);
  const homePath = home.replace(/^\/\(tabs\)/, '') || '/';

  // On the root: only roles whose home is NOT the index tab need a redirect.
  if (path === '/') {
    return homePath === '/' ? null : home;
  }

  const match = PATH_TO_TAB.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  const tab: TabName = match ? match[1] : 'index';
  if (!isTabVisible(role, tab)) {
    return home;
  }
  return null;
}

const PATH_TO_TAB: ReadonlyArray<readonly [string, TabName]> = [
  ['/workspace', 'workspace'],
  ['/assignments', 'assignments'],
  ['/staff-dashboard', 'staff-dashboard'],
  ['/reports', 'reports'],
  ['/more', 'more'],
  ['/profile', 'profile'],
];
