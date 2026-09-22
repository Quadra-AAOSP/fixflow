import { request } from './api';
import type { LoginPayload, RegisterPayload, User } from '@/types';
export { ApiError } from './api';

export function login(payload: LoginPayload): Promise<User> {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}
export function register(payload: RegisterPayload): Promise<User> {
  return request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}
export function logout(): Promise<void> {
  return request('/api/auth/logout', { method: 'POST' });
}
export function getMe(): Promise<User> { return request('/api/auth/me'); }
