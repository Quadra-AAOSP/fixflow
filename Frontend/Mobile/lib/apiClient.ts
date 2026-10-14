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
 * Base URL currently believed to be reachable. Updated in place when a
 * fallback candidate answers, so the probe cost is paid at most once per
 * session — or once per network change, since a network-level failure
 * restarts the search.
 */
let activeBaseUrl = API_BASE_URL;

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
  const bases = [
    activeBaseUrl,
    ...API_BASE_URL_CANDIDATES.filter((base) => base !== activeBaseUrl),
  ];

  for (let i = 0; i < bases.length; i += 1) {
    const base = bases[i];
    const { signal, cancel } = withTimeout(
      init?.signal,
      i === 0 ? DEFAULT_TIMEOUT_MS : FALLBACK_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        credentials: 'include',
        headers: buildHeaders(init),
        signal,
      });

      if (base !== activeBaseUrl) {
        activeBaseUrl = base;
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log(`[api] using fallback base URL: ${base}`);
        }
      }

      if (!response.ok) {
        throw await parseError(response);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      // An ApiError means the server was reached and answered — never retry
      // those against another host. Only network/timeout failures fall through.
      if (error instanceof ApiError || i === bases.length - 1) {
        throw error;
      }
    } finally {
      cancel();
    }
  }

  // Unreachable: the loop always returns or throws.
  throw new ApiError(0, 'Request failed');
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