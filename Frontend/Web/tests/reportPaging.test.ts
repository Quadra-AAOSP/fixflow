import { afterEach, describe, expect, it, vi } from 'vitest';
import { listReports } from '../src/services/maintenance';
import { report } from './fixtures';
import { stubApiFetch } from './csrfFetch';
afterEach(() => vi.unstubAllGlobals());
describe('complete authorized report paging', () => {
  it('follows server pages even when a privacy-filtered page is empty and deduplicates changing boundaries', async () => {
    const pages = [
      { content: [report()], page: 0, size: 100, totalElements: 205, totalPages: 3 },
      { content: [], page: 1, size: 100, totalElements: 205, totalPages: 3 },
      { content: [report({ id: 2 }), report({ description: 'Updated server version' })], page: 2, size: 100, totalElements: 205, totalPages: 3 },
    ];
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(pages.shift())))); stubApiFetch(fetch);
    const rows = await listReports(7);
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      '/api/reports?siteId=7&page=0&size=100', '/api/reports?siteId=7&page=1&size=100', '/api/reports?siteId=7&page=2&size=100',
    ]);
    expect(rows.map(row => row.id)).toEqual([1, 2]);
    expect(rows[0]?.description).toBe('Updated server version');
  });
  it('does not expose a successful partial result if a later page fails', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ content: [report()], page: 0, totalPages: 2 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Access changed' }), { status: 403 }));
    stubApiFetch(fetch);
    await expect(listReports(7)).rejects.toMatchObject({ status: 403, message: 'Access changed' });
  });
  it('rejects incomplete pagination rather than silently truncating the collection', async () => {
    stubApiFetch(vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [report()] }))));
    await expect(listReports(7)).rejects.toThrow('paging response is incomplete');
  });
});
