// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { workspaceLinks, workspaceNavigation } from '../src/utils/workspaceAccess';
import ReporterHomeView from '../src/views/app/ReporterHomeView.vue';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import { setLocale } from '../src/i18n';
import { report } from './fixtures';
import type { User, UserRole } from '../src/types';
const account: User = { id: 1, role: 'reporter', siteId: 7, firstName: 'Test', lastName: 'Reporter', email: 'test@example.invalid', phone: null, address: null };
beforeEach(() => { setActivePinia(createPinia()); setLocale('en'); });
describe('role-specific workspace menus', () => {
  it.each([
    ['reporter', ['/reporter', '/building-suggestions', '/sites']],
    ['staff', ['/', '/reports', '/sites', '/assignments', '/shop']],
    ['admin', ['/', '/reports', '/sites', '/assignments', '/contracts', '/marketplace', '/site-rules', '/team-access', '/shop']],
    ['super_admin', ['/', '/reports', '/sites', '/assignments', '/contracts', '/site-rules', '/team-access', '/shop/manage', '/site-applications', '/technician-verifications', '/shop']],
    ['technician', ['/technician', '/reports', '/contracts', '/marketplace', '/shop']],
    ['shop_manager', ['/shop/dashboard', '/shop/orders-management', '/shop/manage', '/profile']],
  ] as [UserRole, string[]][])('shows only relevant links for %s', (role, expected) => {
    const user = { ...account, role };
    expect(workspaceLinks(user, true).map(link => link.to)).toEqual(expected);
    const { primary, more } = workspaceNavigation(user, true);
    expect(primary.length + Number(more.length > 0)).toBeLessThanOrEqual(4);
    const visible = [...primary, ...more].map(link => link.to).sort();
    const expectedVisible = role === 'reporter' ? expected.filter(to => to !== '/shop') : expected;
    expect(visible).toEqual([...expectedVisible].sort());
    if (role === 'reporter') expect(more).toEqual([]);
  });
  it.each([
    ['reporter', ['/reporter', '/building-suggestions', '/sites']],
    ['staff', ['/', '/reports', '/assignments']],
    ['admin', ['/', '/reports', '/team-access']],
    ['super_admin', ['/', '/sites']],
    ['technician', ['/technician', '/marketplace']],
    ['shop_manager', ['/shop/dashboard', '/profile']],
  ] as [UserRole, string[]][])('prioritizes the primary destinations for %s', (role, expected) => {
    expect(workspaceNavigation({ ...account, role }, true).primary.map(link => link.to)).toEqual(expected);
  });
  it('hides site report browsing for independent technicians without an accessible site', () => {
    expect(workspaceLinks({ ...account, role: 'technician', siteId: null }, false).map(link => link.to)).not.toContain('/reports');
  });
});
it('shows created and joined reports but excludes unrelated peer reports from the reporter home', async () => {
  useAuthStore().user = account;
  const data = useMaintenanceStore();
  data.reportsLoaded = true;
  data.reports = [report({ id: 11, description: 'My created issue', createdByUserId: 1 }),
    report({ id: 12, description: 'My joined issue', createdByUserId: 2, policy: { statusGroup: 'open', effectiveUrgency: 'medium', urgent: false, inAssignmentQueue: false, participant: true, canSeeSensitive: false, canAssign: false, canJoin: false } }),
    report({ id: 13, description: 'Unrelated peer issue', createdByUserId: null })];
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  await router.push('/');
  const wrapper = mount(ReporterHomeView, { global: { plugins: [router] } });
  expect(wrapper.text()).toContain('My created issue');
  expect(wrapper.text()).toContain('My joined issue');
  expect(wrapper.text()).not.toContain('Unrelated peer issue');
  expect(wrapper.text()).not.toContain('Maintenance Overview');
  wrapper.unmount();
});
