import type { UserRole } from '@/types';

export type TabName = 'index' | 'reports' | 'workspace' | 'assignments' | 'staff-dashboard' | 'more' | 'profile';

/**
 * The six roles defined by the backend (source of truth):
 *   reporter, technician, staff, admin, super_admin, shop_manager
 *
 * Backend SecurityConfig permission model — this dictates EVERYTHING below:
 *   /api/admin/**        → ADMIN, SUPER_ADMIN only (site + platform admin)
 *   /api/admin/shop/**   → SUPER_ADMIN, SHOP_MANAGER only (shop management)
 *   /api/**              → authenticated (everyone)
 *
 * Tab bar (fixed 4-slot order — first visible tab = home):
 *
 *   reporter      → Home (index), Reports,            More,       Profile
 *   technician    → Workspace,    Assignments,       More(Shop), Profile
 *   staff         → Staff Dashboard, Reports,         More,       Profile
 *   admin (site)  → Home (index), Reports,            More,       Profile
 *   super_admin   → Home (index), Reports,            More(Shop+mgmt), Profile
 *   shop_manager  → Home (index), More(Shop),        Profile      (only 3)
 */
export function isTabVisible(role: UserRole, tab: TabName): boolean {
  switch (tab) {
    // ── Home tabs (one per role family) ──────────────────────────────────
    case 'index':
      // Everyone EXCEPT technician (they have workspace) and staff (they have staff-dashboard).
      return role !== 'technician' && role !== 'staff';

    case 'workspace':
    case 'assignments':
      return role === 'technician';

    case 'staff-dashboard':
      return role === 'staff';

    // ── Reports tab ──────────────────────────────────────────────────────
    // Everyone who creates or reviews reports. Technician uses Assignments
    // instead. Shop manager is shop-only, never reports.
    case 'reports':
      return role === 'reporter' || role === 'staff' || role === 'admin' || role === 'super_admin';

    // ── More tab — everyone gets it (contents differ by role) ─────────────
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
  if (role === 'staff') return '/(tabs)/staff-dashboard';
  // reporter, admin, super_admin, shop_manager → Home at /(tabs)
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
  ['/staff-dashboard', 'staff-dashboard'],
  ['/reports', 'reports'],
  ['/more', 'more'],
  ['/profile', 'profile'],
];
