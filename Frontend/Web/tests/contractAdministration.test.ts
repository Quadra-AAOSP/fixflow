import { afterEach, expect, it, vi } from 'vitest';
import { stubApiFetch } from './csrfFetch';
import { getTechnicianTermsFor } from '../src/services/technician';
import { deleteTechnicianContract } from '../src/services/access';
afterEach(() => vi.unstubAllGlobals());
it('uses the technician-specific read and contract removal mappings', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ technicianId: 54 })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  stubApiFetch(fetch);
  await getTechnicianTermsFor(54); await deleteTechnicianContract(99);
  expect(fetch.mock.calls[0]![0]).toBe('/api/technician-terms/54');
  expect(fetch.mock.calls[1]![0]).toBe('/api/technician-contracts/99');
  expect(fetch.mock.calls[1]![1].method).toBe('DELETE');
});
it('rejects invalid identifiers without making a request', () => {
  const fetch = vi.fn(); stubApiFetch(fetch);
  expect(() => getTechnicianTermsFor(0)).toThrow();
  expect(() => deleteTechnicianContract(-1)).toThrow(); expect(fetch).not.toHaveBeenCalled();
});
