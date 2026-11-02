import { request } from './api';
import { PASSWORD_MAX_LENGTH } from '@/constants/access';

export interface AccountPolicy {
  passwordMinLength: number;
  selfRegistrationRoles: string[];
  siteAdminApprovalRequired: boolean;
}
export function parseAccountPolicy(value: unknown): AccountPolicy {
  const policy = value as Partial<AccountPolicy> | null;
  if (!policy || !Number.isInteger(policy.passwordMinLength) || policy.passwordMinLength! < 1 ||
      policy.passwordMinLength! > PASSWORD_MAX_LENGTH || !Array.isArray(policy.selfRegistrationRoles) ||
      !policy.selfRegistrationRoles.every(role => typeof role === 'string' && role.length > 0) ||
      typeof policy.siteAdminApprovalRequired !== 'boolean') {
    throw new Error('Registration policy is unavailable. Reload and try again.');
  }
  return { passwordMinLength: policy.passwordMinLength!, selfRegistrationRoles: [...new Set(policy.selfRegistrationRoles)],
    siteAdminApprovalRequired: policy.siteAdminApprovalRequired };
}
export async function getAccountPolicy() {
  return parseAccountPolicy(await request<unknown>('/api/auth/policy'));
}
