import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/auth';
import type { User } from '../src/types';
vi.mock('../src/services/auth', () => ({ getMe: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() }));
const user: User = { id: 42, email: 'test@example.invalid', firstName: 'Test', lastName: 'User', role: 'reporter', siteId: 9, phone: null, address: null };
beforeEach(() => { setActivePinia(createPinia()); vi.resetAllMocks(); });
describe('session lifecycle', () => {
  it('shares one restoration request between navigation guards', async () => {
    let resolve!: (value: User) => void;
    vi.mocked(api.getMe).mockImplementation(() => new Promise(done => { resolve = done; }));
    const store = useAuthStore(); const first = store.hydrate(); const second = store.hydrate();
    resolve(user); await Promise.all([first, second]);
    expect(api.getMe).toHaveBeenCalledOnce(); expect(store.isAuthenticated).toBe(true);
    expect(store.user?.siteId).toBe(9); expect(store.isLoading).toBe(false);
  });
  it('finishes loading on an unavailable backend without inventing a user', async () => {
    vi.mocked(api.getMe).mockRejectedValue(new Error('Offline'));
    const store = useAuthStore(); await store.hydrate();
    expect(store.isLoading).toBe(false); expect(store.user).toBeNull();
  });
  it('retains the session if server-side logout failed', async () => {
    const store = useAuthStore(); store.user = user;
    vi.mocked(api.logout).mockRejectedValue(new Error('Offline'));
    await expect(store.logout()).rejects.toThrow('Offline'); expect(store.isAuthenticated).toBe(true);
  });
  it('clears the user only after successful server logout', async () => {
    const store = useAuthStore(); store.user = user; vi.mocked(api.logout).mockResolvedValue();
    await store.logout(); expect(store.user).toBeNull(); expect(store.isAuthenticated).toBe(false);
  });
});
