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

/** Public registration site descriptor (`GET /api/auth/sites`). */
export type JoinableSite = {
  id: number;
  name: string;
  type: import('./site').SiteType;
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
  applicationOnly?: boolean;
};

export type LoginPayload = {
  email: string;
  password: string;
};

/**
 * Reporter and technician self-registration. New site administrators apply
 * through site onboarding. Reporters need a site and technicians start without one.
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
  // Admin self-apply bundle — submits site details together with the
  // application so the site is created immediately and linked to the
  // applicant. Super_admin approval then flips both user role and activates.
  siteName?: string;
  siteType?: 'school' | 'hostel' | 'hotel';
  siteAddress?: string;
  siteDescription?: string;
  // Technician onboarding at registration.
  trades?: string;
  experience?: string;
  qualifications?: string;
  acceptTechnicianTerms?: boolean;
  technicianTermsVersion?: string;
  skills?: { category: string; specialty?: string | null }[];
  contractSiteId?: number;
  contractNote?: string;
};

export type RegisterSkill = NonNullable<RegisterPayload['skills']>[number];

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
