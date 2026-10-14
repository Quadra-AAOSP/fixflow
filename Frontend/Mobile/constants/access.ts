import type { UserRole } from '@/types';

/**
 * UI policy and enum labels — not account data, and not proof of server
 * authorization. The backend re-checks every privileged action; these
 * helpers only decide what the interface offers.
 */

/** Password-only authentication: OWASP/NIST recommendation. */
export const PASSWORD_MIN_LENGTH = 15;

/** Current backend DTO limit. */
export const PASSWORD_MAX_LENGTH = 100;

/** bcrypt silently ignores bytes past 72, so longer inputs are rejected. */
export const PASSWORD_MAX_BYTES = 72;

export const MAX_NAME_LENGTH = 128;
export const MAX_PHONE_LENGTH = 64;
export const MAX_ADDRESS_LENGTH = 512;

export const roleLabels: Record<UserRole, string> = {
  reporter: 'Reporter',
  technician: 'Technician',
  staff: 'Site staff',
  admin: 'Site administrator',
  super_admin: 'Super administrator',
};

/** Roles that may create other accounts at all. */
export const canProvision = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'super_admin';

/**
 * An `admin` may mint `staff`; only a `super_admin` may mint another `admin`.
 * Mirrors the backend's `/api/admin/**` guard.
 */
export function canProvisionRole(
  actor: UserRole | undefined,
  target: UserRole,
): boolean {
  if (target === 'staff') return canProvision(actor);
  if (target === 'admin') return actor === 'super_admin';
  return false;
}

/** Roles an actor is allowed to hand out, in display order. */
export function provisionableRoles(actor: UserRole | undefined): UserRole[] {
  return (['staff', 'admin'] as const).filter((role) =>
    canProvisionRole(actor, role),
  );
}

/** Who may approve technician contract applications for a site. */
export const canDecideContracts = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'super_admin';

/** Who may create or edit sites. Creation is super_admin only. */
export const canCreateSite = (role: UserRole | undefined): boolean =>
  role === 'super_admin';

export const canEditSite = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'super_admin';

/** Who may assign a technician to a report. */
export const canAssignTechnician = (role: UserRole | undefined): boolean =>
  role === 'staff' || role === 'admin' || role === 'super_admin';

/** Who may file a report. Technicians resolve work rather than raise it. */
export const canCreateReport = (role: UserRole | undefined): boolean =>
  role !== undefined && role !== 'technician';

/**
 * Accounts are created by an administrator; these roles never self-register.
 * Mirrors `AuthService.register`, which accepts reporter/technician only.
 */
export const selfRegisterRoles = ['reporter', 'technician'] as const;

/**
 * Route segment → roles allowed to open it. Enforced by the root navigator;
 * the backend remains the real authority. Keyed by the second path segment,
 * e.g. `/(tabs)/team` → `team`.
 */
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  technician: ['technician'],
  team: ['admin', 'super_admin'],
  contracts: ['technician', 'admin', 'super_admin'],
};

/** Copy shown on the access-policy screen, mirroring the backend's rules. */
export const superAdminCriteria = [
  {
    title: 'Verified organizational identity',
    detail:
      'A named person whose identity and organizational authority are verified through a trusted process. An email domain alone is not proof.',
  },
  {
    title: 'Explicit, independent approval',
    detail:
      'Documented approval from the platform owner or an authorized existing super administrator, with a business reason for platform-wide access.',
  },
  {
    title: 'MFA and fresh authentication',
    detail:
      'Enroll in multi-factor authentication, preferably a phishing-resistant method, and re-authenticate before privileged access is granted.',
  },
  {
    title: 'Minimum necessary access',
    detail:
      'Use a site-admin role whenever site-level access is sufficient. Do not use shared super-admin accounts or self-approve an elevation.',
  },
  {
    title: 'Auditability and ongoing review',
    detail:
      'Record who approved access and when, review continued need, and revoke privileged access promptly when it is no longer required.',
  },
] as const;
