import { API_BASE_URL } from '@/constants/config';
import type { ApiErrorBody } from '@/types';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

let onUnauthorized: (() => void) | undefined;
export function setUnauthorizedHandler(handler: () => void) { onUnauthorized = handler; }

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init, headers, credentials: 'include', signal: init.signal ?? controller.signal,
    });
    if (!response.ok) {
      let message = response.status === 401 ? 'Your session has expired. Please sign in again.' : response.statusText || 'Request failed';
      try {
        const body = await response.json() as ApiErrorBody;
        message = body.message || message;
      } catch { /* Spring security and proxies may return non-JSON errors. */ }
      if (response.status === 401 && !path.startsWith('/api/auth/')) onUnauthorized?.();
      throw new ApiError(response.status, message);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new Error('The server took too long to respond. Please try again.');
    throw new Error('Unable to reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
