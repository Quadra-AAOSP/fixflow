import type { UserRole } from '@/types';

export type TabName = 'index' | 'reports' | 'workspace' | 'assignments' | 'more' | 'profile' | 'staff-dashboard';

/** Routes visible in the tab bar for a given role. */
export function isTabVisible(role: UserRole, tab: TabName): boolean {
  const isTechnician = role === 'technician';
  const isStaff = role === 'staff';
  switch (tab) {
    case 'index':
    case 'reports':
      return !isTechnician && !isStaff;
    case 'workspace':
    case 'assignments':
      return isTechnician;
    case 'more':
      // For technicians and super admins this slot is relabeled "Shop" and
      // deep-links into the shop catalog; staff use the Staff Dashboard tab.
      return !isStaff;
    case 'profile':
      return true;
    case 'staff-dashboard':
      return isStaff;
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
  return '/(tabs)'; // reporter, admin, super_admin, shop_manager → Home
}

/**
 * Maps a pathname to its top-level tab so we can bounce a role off a route it
 * has no business on (e.g. staff landing on `/`, a reporter deep-linked into
 * `/workspace`). Returns the role's home route, or null when the current
 * route is valid for them.
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
