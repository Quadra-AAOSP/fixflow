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
let sessionRevision = 0;
const pendingControllers = new Set<AbortController>();
export function advanceRequestSession() {
  sessionRevision++;
  csrfFlight = undefined;
  for (const controller of [...pendingControllers]) controller.abort();
}
function csrfToken(signal: AbortSignal): Promise<CsrfToken> {
  // One bootstrap per current session; a caller's cancellation must not cancel its peers.
  if (!csrfFlight) {
    const flight = request<CsrfToken>('/api/auth/csrf').then(value => {
      if (value.headerName !== 'X-CSRF-TOKEN' || !value.token) throw new Error('Invalid CSRF response');
      return value;
    }).finally(() => { if (csrfFlight === flight) csrfFlight = undefined; });
    csrfFlight = flight;
  }
  const flight = csrfFlight;
  if (signal.aborted) return Promise.reject(new DOMException('Request cancelled.', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => { reject(new DOMException('Request cancelled.', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    flight.then(value => { signal.removeEventListener('abort', abort); resolve(value); },
      error => { signal.removeEventListener('abort', abort); reject(error); });
  });
}

// OpenRouter may use three 30-second attempts and backoff before returning.
export const AI_REQUEST_TIMEOUT_MS = 120_000;

export async function request<T>(path: string, options: RequestInit & { timeoutMs?: number; allowEmptyResponse?: boolean } = {}): Promise<T> {
  const { timeoutMs = 20_000, allowEmptyResponse = false, ...init } = options;
  const requestRevision = sessionRevision;
  const controller = new AbortController();
  pendingControllers.add(controller);
  const assertCurrent = () => {
    if (requestRevision !== sessionRevision || controller.signal.aborted) throw new DOMException('Request cancelled.', 'AbortError');
  };
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const cancel = () => controller.abort();
  if (init.signal?.aborted) cancel();
  else init.signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (init.signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError');
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? 'GET').toUpperCase())) {
      const csrf = await csrfToken(controller.signal);
      headers.set(csrf.headerName, csrf.token);
    }
    assertCurrent();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init, headers, credentials: 'include', redirect: 'error', signal: controller.signal,
    });
    assertCurrent();
    if (!response.ok) {
      let message = response.status === 401 ? 'Your session has expired. Please sign in again.' : response.statusText || 'Request failed';
      try {
        const body = await response.json() as ApiErrorBody;
        message = body.message || message;
      } catch { /* Spring security and proxies may return non-JSON errors. */ }
      assertCurrent();
      if (response.status === 401 && !path.startsWith('/api/auth/')) onUnauthorized?.();
      throw new ApiError(response.status, message);
    }
    if (response.status === 204) return undefined as T;
    // Only endpoints whose contract permits an absent record opt into empty 200 responses.
    const value = allowEmptyResponse
      ? await response.text().then(body => body.length === 0 ? null as T : JSON.parse(body) as T)
      : await response.json() as T;
    assertCurrent();
    return value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (requestRevision !== sessionRevision) throw new DOMException('Request cancelled.', 'AbortError');
    if (timedOut) throw new Error('The server took too long to respond. Please try again.');
    if (init.signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError');
    throw new Error('Unable to reach the server. Check your connection and try again.');
  } finally {
    pendingControllers.delete(controller);
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', cancel);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
