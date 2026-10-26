import { API_BASE_URL, API_BASE_URL_CANDIDATES } from '@/constants/config';
import type { ApiErrorBody } from '@/types';

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Timeout used when retrying a request against a fallback base URL. A host
 * that is actually reachable answers in milliseconds, so this just caps how
 * long a dead candidate (blocked by a firewall, stale IP, …) can stall the
 * user before the next one is tried.
 */
const FALLBACK_TIMEOUT_MS = 5_000;

/**
 * Development discovery is cached for this app session. A failed application
 * request never changes servers; restart after changing development networks.
 */
let selectedBase: Promise<string> | undefined;
let csrfFlight: Promise<{ headerName: string; token: string }> | undefined;

function csrfToken(signal: AbortSignal): Promise<{ headerName: string; token: string }> {
  csrfFlight ??= request<{ headerName: string; token: string }>('/api/auth/csrf',
    { method: 'GET', signal }).then(value => {
      if (value.headerName !== 'X-CSRF-TOKEN' || !value.token) throw new ApiError(0, 'Invalid CSRF response');
      return value;
    }).finally(() => { csrfFlight = undefined; });
  return csrfFlight;
}

// Discover only with a public, credential-free request. Never replay an actual
// login, registration or write: a timeout may mean the first write committed.
function selectBase(): Promise<string> {
  if (API_BASE_URL_CANDIDATES.length === 1) return Promise.resolve(API_BASE_URL);
  selectedBase ??= (async () => {
    for (const base of API_BASE_URL_CANDIDATES) {
      const { signal, cancel } = withTimeout(undefined, FALLBACK_TIMEOUT_MS);
      try {
        const response = await fetch(`${base}/api/auth/policy`, {
          method: 'GET', credentials: 'omit', redirect: 'error', signal,
          headers: { Accept: 'application/json' },
        });
        if (response.ok) return base;
      } catch {
        // Only this public probe may try another development host.
      } finally {
        cancel();
      }
    }
    throw new ApiError(0, 'Cannot connect to server');
  })().catch((error) => {
    selectedBase = undefined;
    throw error;
  });
  return selectedBase;
}

/**
 * Thrown for every non-2xx response. The original body is preserved on
 * `body` so callers can inspect fields like `path` or `timestamp` from
 * backend `GlobalExceptionHandler` responses when they need them.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type ErrorMessageOptions = {
  /** Message returned for network/timeout failures or unspecified errors. */
  fallback: string;
  /** Statuses that should be hidden behind the fallback message. */
  genericStatuses?: number[];
};

/**
 * Normalize any thrown value into a user-facing string. Use in screens so
 * 401/403/etc. are either shown directly or replaced with a generic message
 * per UX requirements.
 */
export function toErrorMessage(
  error: unknown,
  options: ErrorMessageOptions,
): string {
  if (error instanceof ApiError) {
    if (options.genericStatuses?.includes(error.status)) {
      return options.fallback;
    }
    return error.message;
  }
  return options.fallback;
}

async function parseError(response: Response): Promise<ApiError> {
  // Spring Security rejects an unauthenticated request with an empty body, and
  // Spring Boot's default error page omits `message` — in both cases the old
  // code fell back to statusText, which is empty over HTTP/2, surfacing a
  // useless "Request failed". Fall back to `error` and always carry the status
  // so the caller can name the real cause (e.g. "Forbidden (403)").
  let message = response.statusText || `Request failed (${response.status})`;
  let body: unknown;
  try {
    body = await response.json();
    const parsed = body as ApiErrorBody | undefined;
    if (parsed?.message) {
      message = parsed.message;
    } else if (parsed?.error) {
      message = `${parsed.error} (${response.status})`;
    }
  } catch {
    // non-JSON body — keep the status text (or the status-code fallback)
  }
  return new ApiError(response.status, message, body);
}

function withTimeout(
  external: AbortSignal | null | undefined,
  ms: number,
): { signal: AbortSignal; cancel: () => void } {
  if (external) {
    return { signal: external, cancel: () => {} };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

function buildHeaders(init?: RequestInit): Record<string, string> {
  const provided = (init?.headers as Record<string, string> | undefined) ?? {};
  const isFormBody =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;
  return {
    Accept: 'application/json',
    ...(init?.body && !isFormBody ? { 'Content-Type': 'application/json' } : {}),
    ...provided,
  };
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = await selectBase();
  const { signal, cancel } = withTimeout(init?.signal, DEFAULT_TIMEOUT_MS);
  try {
    const headers = buildHeaders(init);
    if (!['GET', 'HEAD', 'OPTIONS'].includes((init?.method ?? 'GET').toUpperCase())) {
      const csrf = await csrfToken(signal);
      headers[csrf.headerName] = csrf.token;
    }
    const response = await fetch(`${base}${path}`, {
      ...init,
      redirect: 'error',
      credentials: 'include',
      headers,
      signal,
    });
    if (!response.ok) {
      throw await parseError(response);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  } finally {
    cancel();
  }
}

export const api = {
  get: <T>(path: string, init?: RequestInit): Promise<T> =>
    request<T>(path, { ...init, method: 'GET' }),

  post: <T>(path: string, body?: unknown, init?: RequestInit): Promise<T> => {
    const initWithBody: RequestInit | undefined =
      body === undefined ? init : { ...init, body: JSON.stringify(body) };
    return request<T>(path, { ...initWithBody, method: 'POST' });
  },

  put: <T>(path: string, body?: unknown, init?: RequestInit): Promise<T> => {
    const initWithBody: RequestInit | undefined =
      body === undefined ? init : { ...init, body: JSON.stringify(body) };
    return request<T>(path, { ...initWithBody, method: 'PUT' });
  },

  patch: <T>(path: string, body?: unknown, init?: RequestInit): Promise<T> => {
    const initWithBody: RequestInit | undefined =
      body === undefined ? init : { ...init, body: JSON.stringify(body) };
    return request<T>(path, { ...initWithBody, method: 'PATCH' });
  },

  del: <T>(path: string, init?: RequestInit): Promise<T> =>
    request<T>(path, { ...init, method: 'DELETE' }),
};
