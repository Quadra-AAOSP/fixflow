import type { UserRole } from '@/types';

export type TabName = 'index' | 'reports' | 'workspace' | 'assignments' | 'more' | 'profile';

/** Routes visible in the tab bar for a given role. */
export function isTabVisible(role: UserRole, tab: TabName): boolean {
  const isTechnician = role === 'technician';
  switch (tab) {
    case 'index':
    case 'reports':
      return !isTechnician;
    case 'workspace':
    case 'assignments':
      return isTechnician;
    case 'more':
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
