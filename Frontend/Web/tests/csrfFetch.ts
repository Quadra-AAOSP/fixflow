import { vi } from 'vitest';

/** Existing contract tests supply a token as a normal API client would. */
export function stubApiFetch(handler: typeof fetch) {
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => url.endsWith('/api/auth/csrf')
    ? Promise.resolve(new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'test-token' })))
    : handler(url, init));
}
