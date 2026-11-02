import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApiFetch } from './csrfFetch';
import { acceptTechnicianTerms, getTechnicianTerms } from '../src/services/technician';
import { ApiError } from '../src/services/api';

afterEach(() => vi.unstubAllGlobals());

describe('technician terms contract', () => {
  it('loads the authenticated technician status and accepts the reviewed server version', async () => {
    const status = {
      technicianId: 54, currentVersion: 'approved-v3', documentUrl: 'https://example.invalid/terms',
      enforcementRequired: true, acceptedCurrentVersion: false, acceptances: [],
    };
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(status))));
    stubApiFetch(fetch);
    expect(await getTechnicianTerms()).toEqual(status);
    await acceptTechnicianTerms(status.currentVersion);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/technician-terms/me');
    expect(fetch.mock.calls[1]?.[0]).toBe('/api/technician-terms/accept');
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ version: 'approved-v3' });
  });
  it('preserves a version conflict so the UI can reload the current terms', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Terms version changed' }), { status: 409 }));
    stubApiFetch(fetch);
    await expect(acceptTechnicianTerms('old-version')).rejects.toMatchObject({ status: 409, message: 'Terms version changed' } satisfies Partial<ApiError>);
  });
});
