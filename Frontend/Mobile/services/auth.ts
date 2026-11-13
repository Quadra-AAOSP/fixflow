import { api, ApiError } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  JoinableSite,
  LoginPayload,
  RegisterPayload,
  SiteAdminApplication,
  User,
} from '@/types';

export { ApiError };

/** Sites a new reporter can join, fetched before sign-in. */
export function listJoinableSites(): Promise<JoinableSite[]> {
  return api.get<JoinableSite[]>(endpoints.auth.sites);
}

export type CurrentTechnicianTerms = {
  currentVersion: string | null;
  documentUrl: string | null;
};

/** Public current technician terms (needed before sign-in). */
export function getCurrentTechnicianTerms(): Promise<CurrentTechnicianTerms> {
  return api.get<CurrentTechnicianTerms>(endpoints.technicianTerms.current);
}

export function login(payload: LoginPayload): Promise<User> {
  return api.post<User>(endpoints.auth.login, payload);
}

export function register(payload: RegisterPayload): Promise<User> {
  return api.post<User>(endpoints.auth.register, payload);
}

export function logout(): Promise<void> {
  return api.post<void>(endpoints.auth.logout);
}

export function getMe(): Promise<User> {
  return api.get<User>(endpoints.auth.me);
}

/** The caller's own site-admin application, or null when none was filed. */
export function getMySiteAdminApplication(): Promise<SiteAdminApplication | null> {
  return api.get<SiteAdminApplication | null>(endpoints.auth.siteAdminApplication);
}