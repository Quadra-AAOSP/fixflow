import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { ProvisionUserPayload, User } from '@/types';

/**
 * Provisions a staff or admin account. Restricted server-side to callers
 * holding `admin` or `super_admin` (SecurityConfig gates `/api/admin/**`).
 *
 * The backend mints the account and returns the created user; it does not
 * return a session, so the provisioned person signs in separately.
 */
export function provisionUser(payload: ProvisionUserPayload): Promise<User> {
  return api.post<User>(endpoints.admin.users, payload);
}
