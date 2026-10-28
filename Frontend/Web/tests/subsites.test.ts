import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSubsite, listSubsites } from '../src/services/maintenance';
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
    await expect(listSubsites(0)).rejects.toThrow('Choose a valid site.');
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
    await expect(createSubsite(7, { label: '', name: 'Blank', description: null })).rejects.toThrow('building label');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
