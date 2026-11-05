// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { workspaceLinks } from '../src/utils/workspaceAccess';
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
    ['reporter', ['/reporter', '/reports', '/sites', '/shop']],
    ['staff', ['/', '/reports', '/sites', '/assignments', '/shop']],
    ['admin', ['/', '/reports', '/sites', '/assignments', '/contracts', '/site-rules', '/team-access', '/shop']],
    ['super_admin', ['/', '/reports', '/sites', '/assignments', '/contracts', '/site-rules', '/team-access', '/shop/manage', '/site-applications', '/technician-verifications', '/shop']],
    ['technician', ['/technician', '/reports', '/contracts', '/technician/invitations', '/shop']],
    ['shop_manager', ['/shop', '/shop/manage', '/profile']],
  ] as [UserRole, string[]][])('shows only relevant links for %s', (role, expected) => {
    expect(workspaceLinks({ ...account, role }, true).map(link => link.to)).toEqual(expected);
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
