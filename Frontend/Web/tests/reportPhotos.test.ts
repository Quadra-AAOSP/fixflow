import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApiFetch } from './csrfFetch';
import { refreshReportPhotoUrl, removeReportPhoto, safePhotoUrl, uploadReportPhoto, validateReportPhoto } from '../src/services/reportPhotos';

afterEach(() => vi.unstubAllGlobals());
describe('authorized report photo contract', () => {
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
