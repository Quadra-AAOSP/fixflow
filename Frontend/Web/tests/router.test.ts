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
    '/assignments', '/technician', '/technician/invitations', '/team-access', '/contracts', '/marketplace', '/profile', '/admin-application'])('sends a signed-out visit to %s to login with its return path', async path => {
    const router = createAppRouter(createMemoryHistory());
    await router.push(path);
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe(path);
  });
  it.each(['reporter', 'staff', 'technician', 'shop_manager'] as UserRole[])('denies team administration to %s', async role => {
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
  it.each(['admin', 'technician'] as const)('allows %s to open the job marketplace', async role => {
    await signIn(role);
    const router = createAppRouter(createMemoryHistory());
    await router.push('/marketplace');
    expect(router.currentRoute.value.name).toBe('marketplace');
  });
  it('restores a technician cookie session before redirecting the dashboard', async () => {
    vi.mocked(api.getMe).mockResolvedValue({ ...account, role: 'technician', siteId: null });
    const router = createAppRouter(createMemoryHistory());
    await router.push('/');
    expect(api.getMe).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.name).toBe('technician');
  });
  it.each(['pending', 'rejected'] as const)('limits a %s applicant to the standalone status screen', async status => {
    vi.mocked(api.getMe).mockResolvedValue({ ...account, applicationOnly: true, adminApplication: { id: 3, status } });
    const router = createAppRouter(createMemoryHistory());
    for (const path of ['/reports/91', '/shop', '/profile', '/request-site', '/login']) {
      await router.push(path);
      expect(router.currentRoute.value.name).toBe('application-access');
      expect(router.currentRoute.value.matched).toHaveLength(1);
    }
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

it.each(['/', '/assignments', '/team-access', '/contracts', '/technician', '/marketplace'])('keeps reporters out of management and technician pages: %s', async path => {
  await signIn('reporter');
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  expect(router.currentRoute.value.name).toBe('reporter-home');
});
it.each(['staff', 'admin', 'super_admin'] as UserRole[])('keeps %s on the operational dashboard and assignments', async role => {
  await signIn(role);
  const router = createAppRouter(createMemoryHistory());
  await router.push('/'); expect(router.currentRoute.value.name).toBe('home');
  await router.push('/assignments'); expect(router.currentRoute.value.name).toBe('assignments');
  await router.push('/reporter'); expect(router.currentRoute.value.name).toBe('home');
});
it('keeps technicians out of report creation and site administration', async () => {
  await signIn('technician');
  const router = createAppRouter(createMemoryHistory());
  for (const path of ['/reports/new', '/sites', '/assignments']) {
    await router.push(path); expect(router.currentRoute.value.name).toBe('technician');
  }
  await router.push('/reports/91'); expect(router.currentRoute.value.name).toBe('report-detail');
});
it.each(['reporter', 'staff', 'admin', 'technician'] as UserRole[])('denies product management to %s', async role => {
  await signIn(role); const router = createAppRouter(createMemoryHistory());
  await router.push('/shop/manage'); expect(router.currentRoute.value.name).not.toBe('shop-management');
});
it.each(['super_admin', 'shop_manager'] as UserRole[])('allows product management for %s', async role => {
  await signIn(role); const router = createAppRouter(createMemoryHistory());
  await router.push('/shop/manage'); expect(router.currentRoute.value.name).toBe('shop-management');
});
it('requires sign-in for product management while keeping browsing public', async () => {
  const router = createAppRouter(createMemoryHistory());
  await router.push('/shop/manage'); expect(router.currentRoute.value.name).toBe('login');
  expect(router.currentRoute.value.query.redirect).toBe('/shop/manage');
  await router.push('/shop'); expect(router.currentRoute.value.name).toBe('shop');
});
it.each(['reporter', 'staff', 'technician', 'shop_manager'] as UserRole[])('denies rule management to %s', async role => {
  await signIn(role); const router = createAppRouter(createMemoryHistory());
  await router.push('/site-rules'); expect(router.currentRoute.value.name).not.toBe('site-rules');
});
it.each(['admin', 'super_admin'] as UserRole[])('allows rule management for %s', async role => {
  await signIn(role); const router = createAppRouter(createMemoryHistory());
  await router.push('/site-rules'); expect(router.currentRoute.value.name).toBe('site-rules');
});
it('protects direct site detail URLs for signed-out users', async () => {
  const router = createAppRouter(createMemoryHistory()); await router.push('/sites/7');
  expect(router.currentRoute.value.name).toBe('login'); expect(router.currentRoute.value.query.redirect).toBe('/sites/7');
});
it.each(['technician', 'shop_manager'] as UserRole[])('keeps site detail out of the %s workspace', async role => {
  await signIn(role); const router = createAppRouter(createMemoryHistory()); await router.push('/sites/7');
  expect(router.currentRoute.value.name).not.toBe('site-detail');
});
it('requires sign-in to open a direct order detail URL', async () => {
  const router = createAppRouter(createMemoryHistory()); await router.push('/shop/orders/order-a');
  expect(router.currentRoute.value.name).toBe('login'); expect(router.currentRoute.value.query.redirect).toBe('/shop/orders/order-a');
});
it('allows a shop manager to open their order detail page', async () => {
  await signIn('shop_manager'); const router = createAppRouter(createMemoryHistory()); await router.push('/shop/orders/order-a');
  expect(router.currentRoute.value.name).toBe('shop-order');
});
