import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApiFetch } from './csrfFetch';
import { decideContractApplication, listContractApplications, listSiteContracts, requestTechnicianContract } from '../src/services/access';

afterEach(() => vi.unstubAllGlobals());

describe('technician contract applications', () => {
  it('requests a contract for the signed-in technician without supplying an actor ID', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); stubApiFetch(fetch);
    await requestTechnicianContract(71, ' Available for plumbing work ');
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/technician-contract-requests');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ siteId: 71, note: 'Available for plumbing work' });
    expect(fetch.mock.calls[0]?.[1].method).toBe('POST');
  });
  it('loads own requests without a site filter and admin requests for the actual site', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response('[]'))); stubApiFetch(fetch);
    await listContractApplications();
    await listContractApplications(71);
    expect(fetch.mock.calls.map(call => call[0])).toEqual([
      '/api/technician-contract-requests', '/api/technician-contract-requests?siteId=71',
    ]);
  });
  it.each(['approve', 'reject'] as const)('sends an explicit %s decision and reason', async decision => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}')); stubApiFetch(fetch);
    await decideContractApplication(93, decision, ' Reviewed by site administrator ');
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/technician-contract-requests/93/decision');
    expect(JSON.parse(fetch.mock.calls[0]?.[1].body)).toEqual({ decision, reason: 'Reviewed by site administrator' });
  });
});

it('loads recorded contracts for an explicit accessible site through the current endpoint', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('[]')); stubApiFetch(fetch);
  await listSiteContracts(71);
  expect(fetch.mock.calls[0]?.[0]).toBe('/api/technician-contracts?siteId=71');
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  expect(() => listSiteContracts(0)).toThrow('valid site');
  expect(fetch).toHaveBeenCalledOnce();
});
