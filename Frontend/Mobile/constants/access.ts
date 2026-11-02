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

/** Backend capability checks — these map 1:1 to `User.capabilities`. */
export const canProvision = (user: User | null | undefined): boolean => user?.capabilities?.provision ?? false;
export const canDecideContracts = (user: User | null | undefined): boolean => user?.capabilities?.decideContracts ?? false;
export const canCreateSite = (user: User | null | undefined): boolean => user?.capabilities?.createSite ?? false;
export const canEditSite = (user: User | null | undefined): boolean => user?.capabilities?.editSite ?? false;
export const canAssignTechnician = (user: User | null | undefined): boolean => user?.capabilities?.assignTechnician ?? false;
export const canCreateReport = (user: User | null | undefined): boolean => user?.capabilities?.createReport ?? false;
export const provisionableRoles = (user: User | null | undefined): UserRole[] => user?.capabilities?.provisionableRoles ?? [];

/**
 * Confirm / reopen are gated by the report's `policy` (canConfirmReport etc.)
 * server-side. The role-based check below is only a coarse pre-filter so
 * unauthorized roles never see the affordance; the backend is the source of
 * truth for whether a specific report can be confirmed or reopened.
 */
export const canConfirmReport = (user: User | null | undefined): boolean =>
  user?.role === 'staff' || user?.role === 'admin' || user?.role === 'super_admin';

export const canReopenReport = (user: User | null | undefined): boolean =>
  user?.role === 'staff' || user?.role === 'admin' || user?.role === 'super_admin';

/** Full AI assessment is visible to staff, admins, and super admins. */
export const canViewFullAIAssessment = (user: User | null | undefined): boolean =>
  user?.role === 'staff' || user?.role === 'admin' || user?.role === 'super_admin';

/** Manual AI classification is restricted to site admins and super admins. */
export const canTriggerManualAIClassification = (user: User | null | undefined): boolean =>
  user?.role === 'admin' || user?.role === 'super_admin';

/**
 * Shop management. Shop managers can always manage the shop; site admins
 * must NOT be granted shop management locally — the backend's `manageShop`
 * capability is the sole decider for everyone else.
 */
export const canManageShop = (user: User | null | undefined): boolean => {
  if (user?.role === 'shop_manager') return true;
  if (user?.role === 'admin') return false;
  return user?.capabilities?.manageShop ?? false;
};

/** True for the admin of a site (site-bound accounts only). */
export const canManageSubsites = (user: User | null | undefined): boolean =>
  user?.siteOnboarding?.canManageSubsites ?? false;

/** Technicians, super admins, and shop managers can access the shop. */
export const canAccessShop = (user: User | null | undefined): boolean => {
  if (user?.role === 'technician' || user?.role === 'super_admin' || user?.role === 'shop_manager') {
    return true;
  }
  return user?.capabilities?.manageShop ?? false;
};
