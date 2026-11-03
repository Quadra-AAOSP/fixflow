import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../src/services/api';
import { getSite, getSiteTaxonomy, getReportingSetup, getSiteTechnicians, deleteSite } from '../src/services/siteDetails';
vi.mock('../src/services/api', () => ({ request: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('uses all dedicated site detail mappings', async () => {
  await getSite(7); expect(request).toHaveBeenLastCalledWith('/api/sites/7');
  await getSiteTaxonomy(7); expect(request).toHaveBeenLastCalledWith('/api/sites/7/taxonomy');
  await getReportingSetup(7); expect(request).toHaveBeenLastCalledWith('/api/sites/7/reporting-setup');
  await getSiteTechnicians(7); expect(request).toHaveBeenLastCalledWith('/api/sites/7/technician-pool');
  await deleteSite(7); expect(request).toHaveBeenLastCalledWith('/api/sites/7', { method: 'DELETE' });
});
it.each([0, -1, NaN, 1.5])('rejects invalid site ID %s before a request', id => {
  expect(() => getSite(id)).toThrow(); expect(() => deleteSite(id)).toThrow(); expect(request).not.toHaveBeenCalled();
});
