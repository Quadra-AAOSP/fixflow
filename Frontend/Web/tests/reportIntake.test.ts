import { afterEach, expect, it, vi } from 'vitest';
import { reportIntakePayload } from '../src/utils/reportIntake';
import { createReport, createReportWithPhotos } from '../src/services/maintenance';
import { stubApiFetch } from './csrfFetch';
import type { CreateReportPayload } from '../src/types/maintenance';
const input: CreateReportPayload = { siteId: 7, subsiteId: 42, description: 'A leak', category: 'plumbing', reporterUrgency: 'high' };
afterEach(() => vi.unstubAllGlobals());
it('accepts the DTO boundaries and normalizes optional blank fields', () => {
  const value = reportIntakePayload({ ...input, description: 'x'.repeat(10000), address: 'a'.repeat(512), category: 'c'.repeat(128), specialty: 's'.repeat(128), reporterReason: 'r'.repeat(2000), visibility: 'private' });
  expect(value.description).toHaveLength(10000); expect(value.specialty).toHaveLength(128);
  expect(reportIntakePayload({ ...input, address: ' ', specialty: ' ', reporterReason: ' ' })).toMatchObject({ address: undefined, specialty: undefined, reporterReason: undefined });
});
it.each([['description',10001], ['address',513], ['category',129], ['specialty',129], ['reporterReason',2001]] as const)
('rejects an oversized %s before either submission transport', (field, length) => {
  const value = { ...input, [field]: 'x'.repeat(length) };
  const fetch = vi.fn(); stubApiFetch(fetch);
  expect(() => createReport(value)).toThrow('field lengths'); expect(() => createReportWithPhotos(value, [])).toThrow('field lengths');
  expect(fetch).not.toHaveBeenCalled();
});
it('uses lowercase JSON and Java enum casing for multipart visibility', async () => {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}'))); stubApiFetch(fetch);
  await createReport({ ...input, visibility: 'private', specialty: ' pipework ' });
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toMatchObject({ visibility: 'private', specialty: 'pipework' });
  await createReportWithPhotos({ ...input, visibility: 'private' }, []);
  expect((fetch.mock.calls[1]![1].body as FormData).get('visibility')).toBe('PRIVATE');
});
it.each([{ siteId: 0 }, { subsiteId: -1 }, { reporterUrgency: 'invalid' }, { visibility: 'invalid' }])('rejects invalid context %j', value => {
  expect(() => reportIntakePayload({ ...input, ...value } as CreateReportPayload)).toThrow('valid site');
});
