import { afterEach, describe, expect, it, vi } from 'vitest';
import { request, setUnauthorizedHandler } from '../src/services/api';
import { assignTechnician, createReport, joinReport, listRules } from '../src/services/maintenance';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); setUnauthorizedHandler(() => {}); });
describe('API transport', () => {
  it('includes session cookies and serializes the backend create contract', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 91 }), { status: 201 })); vi.stubGlobal('fetch', fetch);
    const payload = { siteId: 7, description: 'Leaking pipe', category: 'plumbing', reporterUrgency: 'high' as const };
    expect(await createReport(payload)).toEqual({ id: 91 });
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/reports');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify(payload), credentials: 'include' });
  });
  it('uses live category, join, and assignment endpoints', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); vi.stubGlobal('fetch', fetch);
    await listRules('hotel'); await joinReport(42); await assignTechnician(42, 19);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/site-rules?siteType=hotel','/api/reports/42/join','/api/reports/42/assign']);
    expect(fetch.mock.calls[2]?.[1].body).toBe(JSON.stringify({ technicianId: 19 }));
  });
  it('invalidates expired sessions without turning bad login into a redirect loop', async () => {
    const invalidated = vi.fn(); setUnauthorizedHandler(invalidated);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('', { status: 401 }))));
    await expect(request('/api/reports')).rejects.toMatchObject({ status: 401 });
    expect(invalidated).toHaveBeenCalledOnce();
    await expect(request('/api/auth/login')).rejects.toMatchObject({ status: 401 });
    expect(invalidated).toHaveBeenCalledOnce();
  });
  it('preserves useful backend validation errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Category is not in the taxonomy' }), { status: 400 })));
    await expect(request('/api/reports')).rejects.toThrow('Category is not in the taxonomy');
  });
  it('supports empty logout responses and rejects connection failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(request('/api/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network error')));
    await expect(request('/api/sites')).rejects.toThrow('Unable to reach the server');
  });
});
