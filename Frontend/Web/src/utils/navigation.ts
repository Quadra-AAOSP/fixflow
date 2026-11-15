import type { User } from '@/types';

/** Select the first useful screen from the authenticated server response. */
export function accountHome(user: User | null): string {
  if (user?.applicationOnly) return '/application-access';
  if (user?.role === 'technician') return '/technician';
  if (user?.role === 'shop_manager') return '/shop/dashboard';
  const setup = user?.siteOnboarding;
  if ((user?.role === 'admin' || user?.role === 'super_admin') && setup?.setupRequired && setup.canManageSubsites) {
    return '/site-setup';
  }
  if (user?.role === 'reporter') return '/reporter';
  return '/';
}

/** Routes an admin may use while buildings + site profile + terms/contract files are incomplete. */
export function setupAllowedPath(path: string, siteId: number | null | undefined): boolean {
  if (path === '/site-setup') return true;
  if (siteId != null && path === `/sites/${siteId}/subsites`) return true;
  if (path === '/profile' || path.startsWith('/profile/')) return true;
  if (path === '/settings' || path.startsWith('/settings/')) return true;
  return false;
}

/** True when site managers must finish the three setup steps before normal work. */
export function requiresSiteSetup(user: User | null): boolean {
  return !!user
    && (user.role === 'admin' || user.role === 'super_admin')
    && user.siteOnboarding?.setupRequired === true
    && user.siteOnboarding?.canManageSubsites === true;
}
