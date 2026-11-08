import type { User } from '@/types';

/** Select the first useful screen from the authenticated server response. */
export function accountHome(user: User | null): string {
  if (user?.applicationOnly) return '/application-access';
  if (user?.role === 'technician') return '/technician';
  if (user?.role === 'shop_manager') return '/shop/dashboard';
  const setup = user?.siteOnboarding;
  if ((user?.role === 'admin' || user?.role === 'super_admin') && setup?.setupRequired && setup.canManageSubsites) return `/sites/${setup.siteId}/subsites`;
  if (user?.role === 'reporter') return '/reporter';
  return '/';
}
