import { request } from './api';
import type { LoginPayload, RegisterPayload, SiteAdminApplication, User } from '@/types';
export { ApiError } from './api';

export type JoinableSite = { id: number; name: string; type: string };
export type CurrentTechnicianTerms = { currentVersion: string | null; documentUrl: string | null };

export function login(payload: LoginPayload): Promise<User> {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}
export function register(payload: RegisterPayload): Promise<User> {
  return request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}
export function listJoinableSites(): Promise<JoinableSite[]> {
  return request('/api/auth/sites');
}
export function getCurrentTechnicianTerms(): Promise<CurrentTechnicianTerms> {
  return request('/api/technician-terms/current');
}
export function logout(): Promise<void> {
  return request('/api/auth/logout', { method: 'POST' });
}
export function getMe(): Promise<User> { return request('/api/auth/me'); }
export async function getSiteAdminApplication(): Promise<SiteAdminApplication | null> {
  return (await request<SiteAdminApplication | null | undefined>('/api/auth/site-admin-application', { allowEmptyResponse: true })) ?? null;
}
export function getPendingSiteAdminApplications(): Promise<SiteAdminApplication[]> {
  return request('/api/admin/site-admin-applications');
}
export function decideSiteAdminApplication(id: number, decision: 'approve' | 'reject'): Promise<SiteAdminApplication> {
  return request(`/api/admin/site-admin-applications/${id}/${decision}`, { method: 'POST' });
}
