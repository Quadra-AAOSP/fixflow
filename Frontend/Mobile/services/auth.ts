import { API_BASE_URL } from '@/constants/config';
import type {
  ApiErrorBody,
  LoginPayload,
  RegisterPayload,
  User,
} from '@/types';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let message = response.statusText || 'Request failed';
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.message) {
      message = body.message;
    }
  } catch {
    // non-JSON body
  }
  return new ApiError(response.status, message);
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function login(payload: LoginPayload): Promise<User> {
  return request<User>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function register(payload: RegisterPayload): Promise<User> {
  return request<User>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

export function getMe(): Promise<User> {
  return request<User>('/api/auth/me');
}
