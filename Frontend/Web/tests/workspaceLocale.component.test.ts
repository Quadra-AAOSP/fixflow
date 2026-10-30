// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import ReportsView from '../src/views/app/ReportsView.vue';
import HomeView from '../src/views/app/HomeView.vue';
import { useMaintenanceStore } from '../src/stores/maintenance';
import { setLocale } from '../src/i18n';
import { report } from './fixtures';
const routing = vi.hoisted(() => ({ replace: vi.fn(), query: {} as Record<string, string> }));
vi.mock('vue-router', () => ({ useRoute: () => ({ query: reactive(routing.query) }), useRouter: () => ({ replace: routing.replace }) }));
const stubs = { RouterLink: { template: '<a><slot /></a>' } };
beforeEach(() => {
  setActivePinia(createPinia()); routing.query = {}; routing.replace.mockReset(); setLocale('en');
  const data = useMaintenanceStore();
  data.sites = [{ id: 1, name: 'Original Campus', type: 'school' }];
  data.selectedSiteId = 1; data.reportsLoaded = true;
  data.reports = [report({ id: 21, siteId: 1, description: 'Original description', category: 'plumbing', status: 'assigned', assignedTechnicianId: 4 })];
});
afterEach(() => setLocale('en'));
it('searches translated report labels while retaining original report content and English search', async () => {
  routing.query.q = '已分配'; setLocale('zh-CN');
  const wrapper = mount(ReportsView, { global: { stubs } });
  expect(wrapper.text()).toContain('1 条符合条件的报修记录');
  expect(wrapper.text()).toContain('Original description');
  expect(wrapper.text()).toContain('Original Campus');
  expect(wrapper.text()).toContain('管道维修');
  expect(wrapper.get('a[aria-label]').attributes('aria-label')).toBe('查看报修 21');
  await wrapper.get('select').setValue('progress');
  expect(routing.replace).toHaveBeenCalledWith({ query: { q: '已分配', status: 'progress' } });
  wrapper.unmount();
  routing.query.q = 'assigned';
  const englishSearch = mount(ReportsView, { global: { stubs } });
  expect(englishSearch.text()).toContain('Original description'); englishSearch.unmount();
});
it('keeps Chinese category searches scoped to the active status filter', () => {
  setLocale('zh-CN'); routing.query = { q: '管道维修', status: 'open' };
  const wrapper = mount(ReportsView, { global: { stubs } });
  expect(wrapper.text()).toContain('0 条符合条件的报修记录');
  expect(wrapper.text()).toContain('没有符合条件的报修记录'); wrapper.unmount();
});
it('switches chart descriptions and report labels without replacing backend content', async () => {
  const wrapper = mount(HomeView, { global: { stubs } });
  expect(wrapper.get('[role="img"]').attributes('aria-label')).toContain('open');
  setLocale('zh-CN'); await nextTick();
  expect(wrapper.text()).toContain('维护概览');
  expect(wrapper.get('[role="img"]').attributes('aria-label')).toContain('条待处理');
  expect(wrapper.text()).toContain('Original description');
  expect(wrapper.get('select').attributes('aria-label')).toBe('图表时间范围');
  await wrapper.get('select').setValue('-1');
  expect(wrapper.text()).toContain('上周创建的报修，按当前状态分组');
  wrapper.unmount();
});
