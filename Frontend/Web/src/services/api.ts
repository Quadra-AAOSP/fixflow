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

type CsrfToken = { headerName: string; token: string };
let csrfFlight: Promise<CsrfToken> | undefined;
function csrfToken(signal?: AbortSignal | null): Promise<CsrfToken> {
  // Share concurrent bootstrap requests, but never cache across login/logout.
  csrfFlight ??= request<CsrfToken>('/api/auth/csrf', { signal }).then(value => {
    if (value.headerName !== 'X-CSRF-TOKEN' || !value.token) throw new Error('Invalid CSRF response');
    return value;
  }).finally(() => { csrfFlight = undefined; });
  return csrfFlight;
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) {
      const csrf = await csrfToken(init.signal ?? controller.signal);
      headers.set(csrf.headerName, csrf.token);
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init, headers, credentials: 'include', redirect: 'error', signal: init.signal ?? controller.signal,
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
