import type { User, UserRole } from '@/types';

// Presentation labels only. Capabilities are supplied by the backend.
// Values are i18n keys resolved with `t` at render time.
export const roleLabels: Record<UserRole, string> = {
  reporter: 'labels.role.reporter',
  technician: 'labels.role.technician',
  staff: 'labels.role.staff',
  admin: 'labels.role.admin',
  super_admin: 'labels.role.super_admin',
  shop_manager: 'labels.role.shop_manager',
};


export const canProvision = (user: User | null | undefined): boolean => user?.capabilities?.provision ?? false;
export const canDecideContracts = (user: User | null | undefined): boolean => user?.capabilities?.decideContracts ?? false;
export const canCreateSite = (user: User | null | undefined): boolean => user?.capabilities?.createSite ?? false;
export const canEditSite = (user: User | null | undefined): boolean => user?.capabilities?.editSite ?? false;
export const canAssignTechnician = (user: User | null | undefined): boolean => user?.capabilities?.assignTechnician ?? false;
export const canCreateReport = (user: User | null | undefined): boolean => user?.capabilities?.createReport ?? false;
export const provisionableRoles = (user: User | null | undefined): UserRole[] => user?.capabilities?.provisionableRoles ?? [];
export const canManageShop = (user: User | null | undefined): boolean => {
  // Shop managers can manage the shop
  if (user?.role === 'shop_manager') {
    return true;
  }
  // Site admins cannot manage the shop
  if (user?.role === 'admin') {
    return false;
  }
  // Fall back to the backend capability
  return user?.capabilities?.manageShop ?? false;
};

/** True for the admin of a site (site-bound accounts only). */
export const canManageSubsites = (user: User | null | undefined): boolean => user?.siteOnboarding?.canManageSubsites ?? false;

/** True for users who can access the shop */
export const canAccessShop = (user: User | null | undefined): boolean => {
  // Technicians and super admins can access the shop
  if (user?.role === 'technician' || user?.role === 'super_admin') {
    return true;
  }
  // Shop managers can access the shop
  if (user?.role === 'shop_manager') {
    return true;
  }
  // Fall back to the backend capability
  return user?.capabilities?.manageShop ?? false;
};
