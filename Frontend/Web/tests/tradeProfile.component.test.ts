// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import TradeProfile from '../src/components/technician/TradeProfile.vue';
import { useAuthStore } from '../src/stores/auth';
import { addTechnicianSkill, listMyTechnicianSkills } from '../src/services/technician';
import { setLocale } from '../src/i18n';
vi.mock('../src/services/technician', () => ({ addTechnicianSkill: vi.fn(), listMyTechnicianSkills: vi.fn() }));
afterEach(() => { setLocale('en'); vi.resetAllMocks(); });
it('allows an optional specialty and explicit proficiency through the Chinese technician form', async () => {
  setActivePinia(createPinia()); setLocale('zh-CN');
  useAuthStore().user = { id: 54, role: 'technician', siteId: null, firstName: 'Test', lastName: 'Tech', email: 'tech@example.invalid', phone: null, address: null };
  vi.mocked(listMyTechnicianSkills).mockResolvedValue([]);
  vi.mocked(addTechnicianSkill).mockResolvedValue({ id: 9, category: 'general', specialty: null, proficiency: 3 });
  const wrapper = mount(TradeProfile);
  await flushPromises();
  expect(wrapper.find('form').exists()).toBe(false);
  await wrapper.get('button.text-action').trigger('click');
  await wrapper.get('form button.text-action').trigger('click');
  expect(wrapper.find('form').exists()).toBe(false);
  await wrapper.get('button.text-action').trigger('click');
  const inputs = wrapper.findAll('input');
  expect(inputs[1]!.attributes('required')).toBeUndefined();
  await inputs[0]!.setValue('general'); await wrapper.get('select').setValue('3');
  await wrapper.get('form').trigger('submit'); await flushPromises();
  expect(addTechnicianSkill).toHaveBeenCalledWith(54, 'general', '', '3');
  expect(wrapper.get('[role="status"]').text()).toContain('已保存：general · 未指定 · 熟练程度 3/5');
  expect(wrapper.find('form').exists()).toBe(false);
  expect(addTechnicianSkill).toHaveBeenCalledTimes(1);
  wrapper.unmount();
});

it('shows trades saved in an earlier session and opens a blank form only when requested', async () => {
  setActivePinia(createPinia());
  useAuthStore().user = { id: 54, role: 'technician', siteId: null, firstName: 'Test', lastName: 'Tech', email: 'tech@example.invalid', phone: null, address: null };
  vi.mocked(listMyTechnicianSkills).mockResolvedValue([
    { id: 9, category: 'plumbing', specialty: 'fixtures', proficiency: 4 },
  ]);
  const wrapper = mount(TradeProfile);
  expect(wrapper.find('form').exists()).toBe(false);
  await flushPromises();
  expect(wrapper.get('li').text()).toContain('plumbing · fixtures · proficiency 4/5');
  expect(wrapper.find('form').exists()).toBe(false);
  await wrapper.get('button.text-action').trigger('click');
  expect(wrapper.get<HTMLInputElement>('form input').element.value).toBe('');
  await wrapper.get('form button.text-action').trigger('click');
  expect(wrapper.find('form').exists()).toBe(false);
  expect(addTechnicianSkill).not.toHaveBeenCalled();
  wrapper.unmount();
});
