import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveSubsite, createSubsite, listPendingSubsiteRequests, listSubsites, requestSubsiteAddition, resolveSubsiteRequest, updateSubsite } from '../src/services/maintenance';
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
  it('edits and archives a building through the site-scoped endpoints', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 12, siteId: 7, label: 'B', name: 'West Annex', description: null, archivedAt: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 12, siteId: 7, label: 'B', name: 'West Annex', description: null, archivedAt: '2026-10-29T00:00:00Z' })));
    stubApiFetch(fetch);
    expect((await updateSubsite(7, 12, { label: ' b ', name: ' West Annex ', description: null })).label).toBe('B');
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/sites/7/subsites/12');
    expect(fetch.mock.calls[0]?.[1].method).toBe('PUT');
    expect(fetch.mock.calls[0]?.[1].body).toBe(JSON.stringify({ label: 'B', name: 'West Annex', description: null }));
    expect((await archiveSubsite(7, 12)).archivedAt).toBeTruthy();
    expect(fetch.mock.calls[1]?.[0]).toBe('/api/sites/7/subsites/12/archive');
    expect(fetch.mock.calls[1]?.[1].method).toBe('POST');
    expect(() => archiveSubsite(7, -1)).toThrow('valid building');
  });
  it('shows only pending requests and resolves the selected request', async () => {
    const pending = [{ id: 9, siteId: 7, requestedByUserId: 41, note: 'West annex', status: 'pending', createdAt: '2026-10-29T00:00:00Z' }];
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(pending)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...pending[0], status: 'resolved' })));
    stubApiFetch(fetch);
    expect(await listPendingSubsiteRequests(7)).toEqual(pending);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/sites/7/subsite-requests');
    expect((await resolveSubsiteRequest(7, 9)).status).toBe('resolved');
    expect(fetch.mock.calls[1]?.[0]).toBe('/api/sites/7/subsite-requests/9/resolve');
    expect(fetch.mock.calls[1]?.[1].method).toBe('POST');
    expect(() => resolveSubsiteRequest(7, 0)).toThrow('valid site and request');
  });
});
