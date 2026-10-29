import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSubsite, listSubsites, requestSubsiteAddition } from '../src/services/maintenance';
import { stubApiFetch } from './csrfFetch';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('subsite web endpoints', () => {
  it('loads only the selected site\'s labelled buildings with the session cookie', async () => {
    const rows = [{ id: 12, siteId: 7, label: 'A', name: 'Main Building', description: null, archivedAt: null }];
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(rows)));
    stubApiFetch(fetch);
    expect(await listSubsites(7)).toEqual(rows);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/sites/7/subsites');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
    expect(() => listSubsites(0)).toThrow('Choose a valid site.');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('creates a trimmed labelled building at that site with a CSRF token', async () => {
    const row = { id: 12, siteId: 7, label: 'A', name: 'Main Building', description: null, archivedAt: null };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(row), { status: 201 }));
    stubApiFetch(fetch);
    expect(await createSubsite(7, { label: ' a ', name: ' Main Building ', description: ' ' })).toEqual(row);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/sites/7/subsites');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ label: 'A', name: 'Main Building', description: null }), credentials: 'include' });
    expect(fetch.mock.calls[0]?.[1].headers.get('X-CSRF-TOKEN')).toBe('test-token');
    expect(() => createSubsite(7, { label: '', name: 'Blank', description: null })).toThrow('building label');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('submits a missing-building request without inventing a building', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 19, siteId: 7, status: 'pending' }), { status: 201 }));
    stubApiFetch(fetch);
    expect(await requestSubsiteAddition(7, '  The west annex is missing  ')).toMatchObject({ status: 'pending' });
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/sites/7/subsite-requests');
    expect(fetch.mock.calls[0]?.[1].body).toBe(JSON.stringify({ note: 'The west annex is missing' }));
    expect(() => requestSubsiteAddition(7, ' ')).toThrow('Describe the missing building');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
