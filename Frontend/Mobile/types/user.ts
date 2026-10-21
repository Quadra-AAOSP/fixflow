import type { UserRole } from './common';

/** Mirrors backend `UserResponse.SiteOnboarding`. Null for site-less accounts. */
export type SiteOnboarding = {
  siteId: number;
  reportingReady: boolean;
  setupRequired: boolean;
  canManageSubsites: boolean;
  setupEndpoint: string;
};

export type AdminApplicationStatus = 'pending' | 'approved' | 'rejected';

/** Mirrors backend `UserResponse.AdminApplication` — the embedded summary. */
export type AdminApplicationRef = {
  id: number;
  status: AdminApplicationStatus;
};

/** Mirrors backend `SiteAdminApplicationService.Response` — the full record. */
export type SiteAdminApplication = {
  id: number;
  userId: number;
  siteId: number;
  status: AdminApplicationStatus;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: number | null;
};

export type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  role: UserRole;
  siteId: number | null;
  capabilities: {
    provision: boolean; decideContracts: boolean; createSite: boolean; editSite: boolean;
    assignTechnician: boolean; createReport: boolean; provisionableRoles: UserRole[];
    manageShop: boolean;
  };
  siteOnboarding: SiteOnboarding | null;
  adminApplication: AdminApplicationRef | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};

/**
 * Self-registration payload. The backend permits `reporter`, `technician` and
 * `admin` here (`AuthService.register`). An `admin` registration is demoted to
 * `reporter` server-side and files a pending site-admin application instead.
 * `siteId` is required for reporter/admin and must be null for technicians.
 *
 * Backed by backend `RegisterRequest` (DTO). Mirrors the locked contract.
 */
export type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  role: Extract<UserRole, 'reporter' | 'technician' | 'admin'>;
  siteId?: number | null;
};

/**
 * Mirrors backend `ProvisionUserRequest`. Staff accounts are created by an
 * `admin` or `super_admin` (POST /api/admin/users). `siteId` is null for the
 * site-less roles (`shop_manager`, `super_admin`).
 *
 * Backed by backend `AdminUserController`.
 */
export type ProvisionUserPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  role: Extract<UserRole, 'admin' | 'staff' | 'shop_manager' | 'super_admin'>;
  siteId: number | null;
};
