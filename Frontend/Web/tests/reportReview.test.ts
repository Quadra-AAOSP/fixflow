import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyReport, confirmReport, reopenReport } from '../src/services/maintenance';
import { stubApiFetch } from './csrfFetch';
afterEach(() => vi.unstubAllGlobals());
describe('report review API contract', () => {
  it('posts manual classification to the selected report', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); stubApiFetch(fetch);
    await classifyReport(91);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/reports/91/classify');
    expect(fetch.mock.calls[0]?.[1].method).toBe('POST');
  });
  it('uses the confirmation and dedicated reopen endpoints', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
    await confirmReport(91); await reopenReport(91, ' The repair did not hold ');
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/reports/91/confirm', '/api/reports/91/reopen']);
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ reason: 'The repair did not hold' });
  });
  it('enforces the backend reopen reason requirement and limit', () => {
    expect(() => reopenReport(91, ' ')).toThrow('reopen reason');
    expect(() => reopenReport(91, 'x'.repeat(501))).toThrow('500');
  });
});
