export type UserRole =
  | 'reporter'
  | 'technician'
  | 'staff'
  | 'admin'
  | 'shop_manager'
  | 'super_admin';

export type UserCapabilities = {
  provision: boolean;
  decideContracts: boolean;
  createSite: boolean;
  editSite: boolean;
  assignTechnician: boolean;
  createReport: boolean;
  provisionableRoles: UserRole[];
  manageShop: boolean;
};

export type SiteOnboarding = {
  siteId: number;
  reportingReady: boolean;
  setupRequired: boolean;
  canManageSubsites: boolean;
  setupEndpoint: string;
};

export type AdminApplication = {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
};

export type SiteAdminApplication = AdminApplication & {
  userId: number;
  siteId: number;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: number | null;
};

export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  address: string | null;
  role: UserRole;
  siteId: number | null;
  adminApplication?: AdminApplication | null;
  applicationOnly?: boolean;
  capabilities?: UserCapabilities;
  siteOnboarding?: SiteOnboarding | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type AccountDetails = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
};

export type RegisterSkill = {
  category: string;
  specialty?: string | null;
  proficiency: number;
};

export type RegisterPayload = AccountDetails & (
  | { role: 'reporter'; siteId: number }
  | {
      role: 'technician';
      siteId: null;
      trades: string;
      experience: string;
      qualifications: string;
      acceptTechnicianTerms: true;
      technicianTermsVersion: string;
      skills: RegisterSkill[];
      contractSiteId?: number;
      contractNote?: string;
    }
  | { role: 'admin'; siteId: number }
);

export type ProvisionUserPayload = AccountDetails & (
  | { role: 'admin' | 'staff'; siteId: number }
  | { role: 'shop_manager'; siteId: null }
);

export type ApiErrorBody = {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  path?: string;
};
