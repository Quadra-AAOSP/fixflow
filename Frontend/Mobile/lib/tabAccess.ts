import type { UserRole } from '@/types';

export type TabName = 'index' | 'reports' | 'workspace' | 'assignments' | 'more' | 'profile' | 'staff-dashboard';

/** Routes visible in the tab bar for a given role. */
export function isTabVisible(role: UserRole, tab: TabName): boolean {
  const isTechnician = role === 'technician';
  const isSuperAdmin = role === 'super_admin';
  const isStaff = role === 'staff';
  switch (tab) {
    case 'index':
    case 'reports':
      return !isTechnician && !isStaff;
    case 'workspace':
    case 'assignments':
      return isTechnician;
    case 'more':
      return !isTechnician && !isSuperAdmin && !isStaff;
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
