import { afterEach, describe, expect, it, vi } from 'vitest';
import { enqueueReportVision, getReportVisionJob } from '../src/services/reportVision';
import { stubApiFetch } from './csrfFetch';
afterEach(() => vi.unstubAllGlobals());
describe('report image analysis contract', () => {
  it('uses the image and consent multipart fields and the returned job identity', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    const file = new File(['image'], 'issue.png', { type: 'image/png' });
    await enqueueReportVision(91, file, true); await getReportVisionJob(91, 'job-id');
    const body = fetch.mock.calls[0]?.[1].body as FormData;
    expect(body.get('image')).toBe(file); expect(body.get('consent')).toBe('true');
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/reports/91/vision', '/api/reports/91/vision/job-id']);
  });
  it('does not submit an image without consent or an unsupported file', () => {
    const file = new File(['image'], 'issue.png', { type: 'image/png' });
    expect(() => enqueueReportVision(91, file, false)).toThrow('consent');
    expect(() => enqueueReportVision(91, new File(['image'], 'issue.svg', { type: 'image/svg+xml' }), true)).toThrow('JPEG, PNG, or WebP');
    expect(() => enqueueReportVision(91, new File(['image'], 'issue.webp', { type: 'image/webp' }), true)).not.toThrow();
  });
});
