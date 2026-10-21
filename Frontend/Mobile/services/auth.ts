import { api, ApiError } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  LoginPayload,
  RegisterPayload,
  SiteAdminApplication,
  User,
} from '@/types';

export { ApiError };

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