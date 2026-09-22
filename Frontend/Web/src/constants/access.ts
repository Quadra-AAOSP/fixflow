import type { UserRole } from '@/types';

// UI policy and API enum labels, not account data or proof of server authorization.
export const PASSWORD_MIN_LENGTH = 15; // Password-only authentication: OWASP/NIST recommendation.
export const PASSWORD_MAX_LENGTH = 100; // Current backend DTO limit.
export const roleLabels: Record<UserRole, string> = {
  reporter: 'Reporter', technician: 'Technician', staff: 'Site staff', admin: 'Site administrator', super_admin: 'Super administrator',
};
export const canProvision = (role: UserRole | undefined) => role === 'admin' || role === 'super_admin';
export function canProvisionRole(actor: UserRole | undefined, target: UserRole) {
  return target === 'staff' ? canProvision(actor) : target === 'admin' && actor === 'super_admin';
}
export const superAdminCriteria = [
  { title: 'Verified organizational identity', detail: 'A named person whose identity and organizational authority are verified through a trusted process. An email domain alone is not proof.' },
  { title: 'Explicit, independent approval', detail: 'Documented approval from the platform owner or an authorized existing super administrator, with a business reason for platform-wide access.' },
  { title: 'MFA and fresh authentication', detail: 'Enroll in multi-factor authentication, preferably a phishing-resistant method, and re-authenticate before privileged access is granted.' },
  { title: 'Minimum necessary access', detail: 'Use a site-admin role whenever site-level access is sufficient. Do not use shared super-admin accounts or self-approve an elevation.' },
  { title: 'Auditability and ongoing review', detail: 'Record who approved access and when, review continued need, and revoke privileged access promptly when it is no longer required.' },
];
