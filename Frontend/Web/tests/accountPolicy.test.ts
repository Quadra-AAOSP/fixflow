import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { getAccountPolicy, parseAccountPolicy } from '../src/services/accountPolicy';
import { useAccountPolicyStore } from '../src/stores/accountPolicy';
import { buildProvisionPayload, buildRegistrationPayload } from '../src/utils/registration';
const policy = { passwordMinLength: 20, selfRegistrationRoles: ['reporter', 'technician', 'admin'], siteAdminApprovalRequired: true };
const form = { firstName: 'Test', lastName: 'Account', email: 'test@example.invalid', password: 'a'.repeat(18), phone: '', role: 'reporter' as const, siteId: '7' };
beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());
describe('public account policy contract', () => {
  it('loads the current published policy with session credentials and preserves the minimum', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(policy))); vi.stubGlobal('fetch', fetch);
    expect(await getAccountPolicy()).toEqual(policy);
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/auth/policy');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });
  it.each([null, {}, { ...policy, passwordMinLength: 0 }, { ...policy, passwordMinLength: '20' },
    { ...policy, passwordMinLength: 101 }, { ...policy, selfRegistrationRoles: [null] },
    { ...policy, siteAdminApprovalRequired: undefined }])('rejects unusable metadata without inventing policy defaults: %j', value => {
    expect(() => parseAccountPolicy(value)).toThrow('Registration policy is unavailable');
  });
  it('shares a pending read across forms and retries a failed read without a static fallback', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Policy temporarily unavailable' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(policy))); vi.stubGlobal('fetch', fetch);
    const store = useAccountPolicyStore();
    const first = store.load(); const second = store.load(); await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.policy).toBeNull(); expect(store.error).toBe('Policy temporarily unavailable');
    await store.load(); expect(store.policy?.passwordMinLength).toBe(20); expect(store.error).toBe('');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('uses the supplied backend minimum for both public signup and team provisioning', () => {
    expect(() => buildRegistrationPayload(form, 20)).toThrow('displayed length requirements');
    expect(buildRegistrationPayload(form, 18).password).toHaveLength(18);
    expect(() => buildProvisionPayload({ ...form, role: 'staff' }, 'admin', [7], 20)).toThrow('displayed length requirements');
    expect(buildProvisionPayload({ ...form, role: 'staff' }, 'admin', [7], 18).role).toBe('staff');
    expect(() => buildRegistrationPayload(form, Number.NaN)).toThrow('policy is unavailable');
  });
});
