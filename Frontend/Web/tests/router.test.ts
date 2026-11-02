// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '../src/router';
import { useAuthStore } from '../src/stores/auth';
import * as api from '../src/services/auth';
import type { User, UserRole } from '../src/types';

vi.mock('../src/services/auth', () => ({ getMe: vi.fn(), login: vi.fn(), logout: vi.fn() }));
const account: User = {
  id: 1, firstName: 'Test', lastName: 'Account', email: 'test@example.invalid',
  phone: null, address: null, siteId: 71, role: 'reporter',
};

beforeEach(() => {
  setActivePinia(createPinia());
  vi.resetAllMocks();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.mocked(api.getMe).mockRejectedValue(new Error('No session'));
});

async function signIn(role: UserRole) {
  vi.mocked(api.login).mockResolvedValue({ ...account, role });
  await useAuthStore().login({ email: account.email, password: 'test passphrase' });
}

describe('actual application route guards', () => {
  it.each(['/', '/reports', '/reports/new', '/reports/91', '/sites', '/sites/71/subsites',
    '/assignments', '/technician', '/technician/invitations', '/team-access', '/contracts', '/profile', '/admin-application'])
  ('sends a signed-out visit to %s to login with its return path', async path => {
    const router = createAppRouter(createMemoryHistory());
    await router.push(path);
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe(path);
  });
  it.each(['reporter', 'staff', 'technician', 'shop_manager'] as UserRole[])
  ('denies team administration to %s', async role => {
    await signIn(role);
    const router = createAppRouter(createMemoryHistory());
    await router.push('/team-access');
    expect(router.currentRoute.value.name).not.toBe('team-access');
  });
  it.each(['admin', 'super_admin'] as UserRole[])('allows %s to reach team administration', async role => {
    await signIn(role);
    const router = createAppRouter(createMemoryHistory());
    await router.push('/team-access');
    expect(router.currentRoute.value.name).toBe('team-access');
  });
  it('restores a technician cookie session before redirecting the dashboard', async () => {
    vi.mocked(api.getMe).mockResolvedValue({ ...account, role: 'technician', siteId: null });
    const router = createAppRouter(createMemoryHistory());
    await router.push('/');
    expect(api.getMe).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.name).toBe('technician');
  });
  it('routes shop managers away from maintenance while preserving profile access', async () => {
    await signIn('shop_manager');
    const router = createAppRouter(createMemoryHistory());
    await router.push('/reports');
    expect(router.currentRoute.value.name).toBe('shop');
    await router.push('/profile');
    expect(router.currentRoute.value.name).toBe('profile');
  });
  it('takes a signed-in manager from the guest login page to required site setup', async () => {
    vi.mocked(api.getMe).mockResolvedValue({ ...account, role: 'admin', siteOnboarding: {
      siteId: 71, setupRequired: true, reportingReady: false,
      canManageSubsites: true, setupEndpoint: '/api/sites/71/subsites',
    } });
    const router = createAppRouter(createMemoryHistory());
    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('subsites');
    expect(router.currentRoute.value.params.siteId).toBe('71');
  });
});

it.each([true, false])('uses reduced-motion preference %s for anchor navigation', reduced => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: reduced })));
  try {
    const router = createAppRouter(createMemoryHistory());
    const result = router.options.scrollBehavior!(router.resolve('/reports#main-content'), router.resolve('/reports'), null);
    expect(result).toEqual({ el: '#main-content', behavior: reduced ? 'auto' : 'smooth' });
  } finally { vi.unstubAllGlobals(); }
});
