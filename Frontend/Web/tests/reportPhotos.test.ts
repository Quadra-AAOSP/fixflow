import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApiFetch } from './csrfFetch';
import { refreshReportPhotoUrl, removeReportPhoto, safePhotoUrl, uploadReportPhoto, validateReportPhoto } from '../src/services/reportPhotos';
import { createReportWithPhotos } from '../src/services/maintenance';

afterEach(() => vi.unstubAllGlobals());
describe('authorized report photo contract', () => {
  it('creates a report with its location and photos in the backend multipart field format', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); stubApiFetch(fetch);
    const photo = new File(['photo'], 'issue.png', { type: 'image/png' });
    await createReportWithPhotos({ siteId: 7, subsiteId: 42, description: 'A leak', category: 'plumbing', reporterUrgency: 'high' }, [photo]);
    const body = fetch.mock.calls[0]?.[1].body as FormData;
    expect(body.get('siteId')).toBe('7');
    expect(body.get('subsiteId')).toBe('42');
    expect(body.get('reporterUrgency')).toBe('high');
    expect(body.getAll('photos')).toEqual([photo]);
    expect(body.has('address')).toBe(false);
  });
  it('sends a file as multipart with credentials and lets the browser set its boundary', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); stubApiFetch(fetch);
    const file = new File(['photo'], 'issue.png', { type: 'image/png' });
    await uploadReportPhoto(91, file);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('/api/reports/91/photos');
    expect(init.body.get('file')).toBe(file);
    expect(init.headers.has('Content-Type')).toBe(false);
    expect(init.headers.get('X-CSRF-TOKEN')).toBe('test-token');
    expect(init.credentials).toBe('include');
  });
  it('rejects empty, oversized, and unsupported uploads before a request', () => {
    expect(() => validateReportPhoto(new File([], 'empty.png', { type: 'image/png' }))).toThrow('non-empty');
    expect(() => validateReportPhoto(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))).toThrow('5 MiB');
    expect(() => validateReportPhoto(new File(['text'], 'file.svg', { type: 'image/svg+xml' }))).toThrow('JPEG');
  });
  it('refreshes temporary URLs and deletes using the authorized report and photo IDs', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await refreshReportPhotoUrl(91, 32);
    await removeReportPhoto(91, 32);
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/reports/91/photos/32', '/api/reports/91/photos/32']);
    expect(fetch.mock.calls[1]?.[1].method).toBe('DELETE');
    expect(safePhotoUrl('javascript:alert(1)')).toBeUndefined();
    expect(safePhotoUrl('https://example.invalid/signed-photo')).toBe('https://example.invalid/signed-photo');
  });
});
