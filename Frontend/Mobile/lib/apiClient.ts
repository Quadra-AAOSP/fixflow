import { API_BASE_URL } from '@/constants/config';
import type { ApiErrorBody } from '@/types';

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 15_000;

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
  let message = response.statusText || 'Request failed';
  let body: unknown;
  try {
    body = await response.json();
    const m = (body as ApiErrorBody | undefined)?.message;
    if (m) message = m;
  } catch {
    // non-JSON body — keep statusText
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
  const { signal, cancel } = withTimeout(init?.signal, DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: buildHeaders(init),
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