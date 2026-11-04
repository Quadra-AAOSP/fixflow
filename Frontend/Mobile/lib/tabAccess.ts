import type { UserRole } from '@/types';

export type TabName = 'index' | 'reports' | 'workspace' | 'assignments' | 'more' | 'profile';

/**
 * The actual roles defined by the backend. On mobile we treat staff and
 * shop_manager the same as super_admin per the product decision: the super
 * admin IS the platform owner and IS the shop manager, staff work is
 * absorbed by super admin. These constants make that single decision easy
 * to change later.
 */
const SUPER_ADMIN_LIKE: readonly UserRole[] = ['super_admin', 'staff', 'shop_manager'];

/**
 * Which tab bar entries a role sees.
 *
 * Four product roles on mobile (backend still carries all 6 values — we fold):
 *
 *   reporter            → Home, Reports, More, Profile
 *                         (basic user — files issues, tracks them)
 *   technician          → Workspace, Assignments, More (Shop), Profile
 *                         (does the hands-on work, no admin tabs)
 *   admin (site admin)  → Home, Reports, More (site mgmt), Profile
 *                         (manages ONE site, not platform-wide)
 *   super_admin         → Home (Platform Console), Reports, More (Shop +
 *                         full mgmt), Profile
 *                         (platform owner — staff work + shop manager absorbed
 *                          into this role; backend still surfaces staff /
 *                          shop_manager but we treat them identically)
 */
export function isTabVisible(role: UserRole, tab: TabName): boolean {
  const isSuperAdminLike = SUPER_ADMIN_LIKE.includes(role);
  switch (tab) {
    // ── Home (index) ────────────────────────────────────────────────────
    // reporter, admin, super_admin (incl staff/shop_manager folded in)
    // technician has its own workspace; everyone else lands on /(tabs)
    case 'index':
      return role !== 'technician';

    // ── Reports ──────────────────────────────────────────────────────────
    // Everyone who creates or reviews reports. Technician uses Assignments.
    case 'reports':
      return role === 'reporter' || role === 'admin' || isSuperAdminLike;

    // ── Technician-only home/second tabs ──────────────────────────────────
    case 'workspace':
    case 'assignments':
      return role === 'technician';

    // ── More — everyone gets it, contents differ by role ───────────────────
    case 'more':
      return true;

    // ── Profile — everyone ───────────────────────────────────────────────
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
  // reporter, admin, super_admin (+ staff / shop_manager folded) → Home
  return '/(tabs)';
}

/**
 * Maps a pathname to its top-level tab so we can bounce a role off a route
 * it has no business on (e.g. technician deep-linked into `/reports`, a
 * reporter deep-linked into `/workspace`). Returns the role's home route, or
 * null when the current route is valid for them.
 */
export function landingRedirectForRoute(role: UserRole | null, pathname: string): string | null {
  if (!role) return null;
  const path = pathname.replace(/^\/\(tabs\)/, '') || '/';
  const home = homeRouteForRole(role);
  const homePath = home.replace(/^\/\(tabs\)/, '') || '/';

  if (path === '/') {
    return homePath === '/' ? null : home;
  }

  const match = PATH_TO_TAB.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  const tab = match ? match[1] : 'index';
  if (!isTabVisible(role, tab)) {
    return home;
  }
  return null;
}

const PATH_TO_TAB: ReadonlyArray<readonly [string, TabName]> = [
  ['/workspace', 'workspace'],
  ['/assignments', 'assignments'],
  ['/reports', 'reports'],
  ['/more', 'more'],
  ['/profile', 'profile'],
];
