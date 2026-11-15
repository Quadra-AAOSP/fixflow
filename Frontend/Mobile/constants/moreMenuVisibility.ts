import type { UserRole } from '@/types';

/**
 * Every More-menu item key. Visibility is decided here so role checks stay
 * out of the screen render path.
 */
export type MoreMenuItemKey =
  | 'openJobs'
  | 'jobOffers'
  | 'myVerification'
  | 'siteApplications'
  | 'verificationReviews'
  | 'marketplace'
  | 'myAdminApplication'
  | 'allReports'
  | 'siteSetup'
  | 'siteRules'
  | 'sites'
  | 'teamAccess'
  | 'technicians'
  | 'adminApplications'
  | 'contractsTechnician'
  | 'contractsAdmin'
  | 'shopManagement'
  | 'shopCustomer'
  | 'shopOrders';

/**
 * Which roles may see which More-menu items. Matches backend capability /
 * security rules documented on the More screen.
 */
export const MORE_MENU_ROLE_VISIBILITY: Record<MoreMenuItemKey, UserRole[]> = {
  openJobs: ['technician'],
  jobOffers: ['technician'],
  myVerification: ['technician'],
  marketplace: ['admin', 'super_admin', 'technician'],
  siteApplications: ['super_admin'],
  verificationReviews: ['super_admin'],
  // Cross-site report oversight + "notify the site admin" nudge.
  allReports: ['super_admin'],
  myAdminApplication: ['reporter'],
  // Site setup = manage buildings (subsites) for the current site — site-bound admins only.
  siteSetup: ['admin'],
  sites: ['admin', 'super_admin'],
  siteRules: ['admin', 'super_admin'],
  teamAccess: ['admin', 'super_admin'],
  technicians: ['staff', 'admin', 'super_admin'],
  adminApplications: ['super_admin'],
  contractsTechnician: ['technician'],
  contractsAdmin: ['staff', 'admin', 'super_admin'],
  shopManagement: ['super_admin', 'shop_manager'],
  shopOrders: ['super_admin', 'shop_manager'],
  shopCustomer: ['technician', 'staff', 'admin', 'super_admin'],
};

export function isMoreMenuItemVisible(
  key: MoreMenuItemKey,
  role: UserRole,
  guard?: () => boolean,
): boolean {
  if (!MORE_MENU_ROLE_VISIBILITY[key].includes(role)) return false;
  if (guard === undefined) return true;
  return guard();
}
