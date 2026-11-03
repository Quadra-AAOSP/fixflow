import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { request, setUnauthorizedHandler } from '../src/services/api';
import { useAuthStore } from '../src/stores/auth';
import * as authApi from '../src/services/auth';
import type { User } from '../src/types';
vi.mock('../src/services/auth', () => ({ login: vi.fn(), logout: vi.fn(), getMe: vi.fn(), register: vi.fn() }));
const user: User = { id: 1, role: 'reporter', firstName: 'Test', lastName: 'Account', email: 'test@example.invalid', siteId: 7, phone: null, address: null };
beforeEach(() => { setActivePinia(createPinia()); vi.resetAllMocks(); useAuthStore().user = user; });
afterEach(() => { vi.unstubAllGlobals(); setUnauthorizedHandler(() => {}); });
async function signInNewAccount() {
  vi.mocked(authApi.login).mockResolvedValue({ ...user, id: 2, role: 'admin' });
  await useAuthStore().login({ email: 'other@example.invalid', password: 'test passphrase' });
}
it('does not clear a newly signed-in account when an old request returns 401', async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve; })));
  const expired = vi.fn(() => useAuthStore().clearSession()); setUnauthorizedHandler(expired);
  const pending = request('/api/reports').catch(error => error);
  await signInNewAccount(); finish(new Response('', { status: 401 })); const result = await pending;
  expect(useAuthStore().user?.id).toBe(2); expect(expired).not.toHaveBeenCalled();
  expect(result).toMatchObject({ name: 'AbortError' });
});
it('does not dispatch an old write after a delayed CSRF bootstrap crosses sign-in', async () => {
  let finish!: (value: Response) => void;
  const fetch = vi.fn().mockImplementation((url: string) => url.endsWith('/csrf')
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(new Response('{}')));
  vi.stubGlobal('fetch', fetch);
  const pending = request('/api/reports', { method: 'POST', body: JSON.stringify({ siteId: 7, description: 'Old account draft' }) }).catch(error => error);
  await signInNewAccount(); finish(new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'old-token' })));
  expect(await pending).toMatchObject({ name: 'AbortError' });
  expect(fetch.mock.calls.some(call => String(call[0]).endsWith('/api/reports'))).toBe(false);
});
it('still expires the current account on a current protected-request 401', async () => {
  const expired = vi.fn(() => useAuthStore().clearSession()); setUnauthorizedHandler(expired);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
  await expect(request('/api/reports')).rejects.toMatchObject({ status: 401 });
  expect(expired).toHaveBeenCalledOnce(); expect(useAuthStore().user).toBeNull();
});
it('rejects a late successful body from the previous session', async () => {
  let finish!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve; })));
  const pending = request('/api/reports/1').catch(error => error);
  await signInNewAccount(); finish(new Response(JSON.stringify({ description: 'Old private report' })));
  expect(await pending).toMatchObject({ name: 'AbortError' });
});
it('lets another write finish when one caller cancels their shared CSRF wait', async () => {
  let finish!: (value: Response) => void;
  const fetch = vi.fn().mockImplementation((url: string) => url.endsWith('/csrf')
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(new Response('{}')));
  vi.stubGlobal('fetch', fetch);
  const controller = new AbortController();
  const first = request('/api/reports/1/join', { method: 'POST', signal: controller.signal }).catch(error => error);
  const second = request('/api/reports/2/join', { method: 'POST' });
  controller.abort(); expect(await first).toMatchObject({ name: 'AbortError' });
  finish(new Response(JSON.stringify({ headerName: 'X-CSRF-TOKEN', token: 'shared-current-token' })));
  await second;
  expect(fetch.mock.calls.filter(call => String(call[0]).endsWith('/csrf'))).toHaveLength(1);
  expect(fetch.mock.calls.some(call => String(call[0]).endsWith('/reports/1/join'))).toBe(false);
  expect(fetch.mock.calls.some(call => String(call[0]).endsWith('/reports/2/join'))).toBe(true);
});
it('invalidates old requests and overlapping account reads after a role change', async () => {
  let finishRequest!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(resolve => { finishRequest = resolve; })));
  const pending = request('/api/reports/1').catch(error => error);
  let first!: (value: User) => void; let second!: (value: User) => void;
  vi.mocked(authApi.getMe).mockReturnValueOnce(new Promise(resolve => { first = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { second = resolve; }));
  const store = useAuthStore(); const current = store.refreshUser(); const old = store.refreshUser();
  first({ ...user, role: 'admin' }); await current;
  second(user); await old;
  finishRequest(new Response(JSON.stringify({ description: 'Old scope content' })));
  expect(await pending).toMatchObject({ name: 'AbortError' });
  expect(store.user?.role).toBe('admin');
});
