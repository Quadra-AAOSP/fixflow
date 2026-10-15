import type { User, UserRole } from '@/types';

// Presentation labels only. Capabilities are supplied by the backend.
export const roleLabels: Record<UserRole, string> = {
  reporter: 'Reporter',
  technician: 'Technician',
  staff: 'Site staff',
  admin: 'Site administrator',
  super_admin: 'Super administrator',
};


export const canProvision = (user: User | null | undefined): boolean => user?.capabilities?.provision ?? false;
export const canDecideContracts = (user: User | null | undefined): boolean => user?.capabilities?.decideContracts ?? false;
export const canCreateSite = (user: User | null | undefined): boolean => user?.capabilities?.createSite ?? false;
export const canEditSite = (user: User | null | undefined): boolean => user?.capabilities?.editSite ?? false;
export const canAssignTechnician = (user: User | null | undefined): boolean => user?.capabilities?.assignTechnician ?? false;
export const canCreateReport = (user: User | null | undefined): boolean => user?.capabilities?.createReport ?? false;
export const provisionableRoles = (user: User | null | undefined): UserRole[] => user?.capabilities?.provisionableRoles ?? [];
