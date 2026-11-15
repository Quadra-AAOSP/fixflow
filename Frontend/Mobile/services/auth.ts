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

export type ProfileUpdate = Pick<User, 'firstName' | 'lastName'> & {
  phone: string | null;
  address: string | null;
};

export function updateMyProfile(payload: ProfileUpdate): Promise<User> {
  return api.put<User>(endpoints.auth.me, payload);
}

export function uploadMyProfilePhoto(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<User> {
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? 'profile-photo.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);
  return api.post<User>(endpoints.auth.mePhoto, undefined, { body: form });
}

export function deleteMyProfilePhoto(): Promise<void> {
  return api.del<void>(endpoints.auth.mePhoto);
}

export async function readMyProfilePhoto(): Promise<string> {
  const blob = await api.getBlob(endpoints.auth.mePhoto);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not load profile photo'));
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Could not load profile photo'));
    reader.readAsDataURL(blob);
  });
}

/** The caller's own site-admin application, or null when none was filed. */
export function getMySiteAdminApplication(): Promise<SiteAdminApplication | null> {
  return api.get<SiteAdminApplication | null>(endpoints.auth.siteAdminApplication);
}