import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  ProvisionUserPayload,
  SiteAdminApplication,
  User,
} from '@/types';

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

/** Pending site-admin applications. Super_admin only (403 otherwise). */
export function listSiteAdminApplications(): Promise<SiteAdminApplication[]> {
  return api.get<SiteAdminApplication[]>(endpoints.admin.siteAdminApplications);
}

/**
 * Approves or rejects a pending application. The backend returns 409 when the
 * application was already decided — treat that as "refresh the list".
 */
export function decideSiteAdminApplication(
  id: number,
  approve: boolean,
): Promise<SiteAdminApplication> {
  return api.post<SiteAdminApplication>(
    endpoints.admin.siteAdminApplicationDecision(id, approve ? 'approve' : 'reject'),
  );
}
