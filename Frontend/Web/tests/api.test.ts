import { afterEach, describe, expect, it, vi } from 'vitest';
import { request, setUnauthorizedHandler } from '../src/services/api';
import { assignTechnician, createReport, joinReport, listRules } from '../src/services/maintenance';
import { stubApiFetch } from './csrfFetch';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setUnauthorizedHandler(() => {}); });
describe('API transport', () => {
  it('includes session cookies and serializes the backend create contract', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 91 }), { status: 201 })); stubApiFetch(fetch);
    const payload = { siteId: 7, description: 'Leaking pipe', category: 'plumbing', reporterUrgency: 'high' as const };
    expect(await createReport(payload)).toEqual({ id: 91 });
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/reports');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify(payload), credentials: 'include' });
  });
  it('uses live category, join, and assignment endpoints', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await listRules('hotel'); await joinReport(42); await assignTechnician(42, 19);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/site-rules?siteType=hotel','/api/reports/42/join','/api/reports/42/assign']);
    expect(fetch.mock.calls[2]?.[1].body).toBe(JSON.stringify({ technicianId: 19 }));
  });
  it('invalidates expired sessions without turning bad login into a redirect loop', async () => {
    const invalidated = vi.fn(); setUnauthorizedHandler(invalidated);
    stubApiFetch(vi.fn().mockImplementation(() => Promise.resolve(new Response('', { status: 401 }))));
    await expect(request('/api/reports')).rejects.toMatchObject({ status: 401 });
    expect(invalidated).toHaveBeenCalledOnce();
    await expect(request('/api/auth/login')).rejects.toMatchObject({ status: 401 });
    expect(invalidated).toHaveBeenCalledOnce();
  });
  it('preserves useful backend validation errors', async () => {
    stubApiFetch(vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Category is not in the taxonomy' }), { status: 400 })));
    await expect(request('/api/reports')).rejects.toThrow('Category is not in the taxonomy');
  });
  it('supports empty logout responses and rejects connection failures', async () => {
    stubApiFetch(vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(request('/api/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')));
    await expect(request('/api/sites')).rejects.toThrow('Unable to reach the server');
  });
});

describe('CSRF transport', () => {
  it('fetches a fresh token with cookies before every write and does not replay a 403', async () => {
    let version = 0;
    const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(
      url.endsWith('/api/auth/csrf')
        ? new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: `token-${++version}` }))
        : new Response('{}', { status: 403 })));
    vi.stubGlobal('fetch', fetch);
    const invalidated = vi.fn(); setUnauthorizedHandler(invalidated);
    await expect(request('/api/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 403 });
    await expect(request('/api/auth/logout', { method: 'POST' })).rejects.toMatchObject({ status: 403 });
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      '/api/auth/csrf', '/api/auth/login', '/api/auth/csrf', '/api/auth/logout',
    ]);
    expect(fetch.mock.calls[0]?.[1].credentials).toBe('include');
    expect(fetch.mock.calls[1]?.[1].headers.get('X-CSRF-TOKEN')).toBe('token-1');
    expect(fetch.mock.calls[3]?.[1].headers.get('X-CSRF-TOKEN')).toBe('token-2');
    expect(invalidated).not.toHaveBeenCalled();
  });

  it('never sends the write body if token acquisition fails', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('offline')); vi.stubGlobal('fetch', fetch);
    await expect(request('/api/auth/login', { method: 'POST', body: 'secret' })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/auth/csrf');
    expect(fetch.mock.calls[0]?.[1].body).toBeUndefined();
  });

  it('shares simultaneous bootstrap and preserves multipart boundaries', async () => {
    const fetch = vi.fn().mockImplementation((url: string) => Promise.resolve(
      new Response(JSON.stringify(url.endsWith('/csrf')
        ? { headerName: 'X-CSRF-TOKEN', token: 'shared-token' } : { id: 1 }))));
    vi.stubGlobal('fetch', fetch);
    const form = new FormData(); form.append('file', new Blob(['image']), 'photo.png');
    await Promise.all([
      request('/api/reports/1/photos', { method: 'POST', body: form }),
      request('/api/reports/1/join', { method: 'POST' }),
    ]);
    expect(fetch.mock.calls.filter(call => String(call[0]).endsWith('/csrf'))).toHaveLength(1);
    const upload = fetch.mock.calls.find(call => String(call[0]).endsWith('/photos'))!;
    expect(upload[1].body).toBe(form);
    expect(upload[1].headers.has('Content-Type')).toBe(false);
    expect(upload[1].headers.get('X-CSRF-TOKEN')).toBe('shared-token');
  });
});
