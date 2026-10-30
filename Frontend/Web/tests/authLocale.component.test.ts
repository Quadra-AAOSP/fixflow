// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import RegisterView from '../src/views/auth/RegisterView.vue';
import AccessPolicyView from '../src/views/auth/AccessPolicyView.vue';
import { setLocale } from '../src/i18n';
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn() }), RouterLink: { template: '<a><slot /></a>' } }));
vi.mock('../src/composables/useAuth', () => ({ useAuth: () => ({ login: vi.fn() }) }));
afterEach(() => setLocale('en'));
it('switches registration guidance without clearing the chosen role or entered name', async () => {
  const wrapper = mount(RegisterView);
  await wrapper.findAll('button').find(button => button.text().includes('I’m a technician'))!.trigger('click');
  await wrapper.get('input[autocomplete="given-name"]').setValue('Mei');
  setLocale('zh-CN'); await nextTick();
  expect(wrapper.text()).toContain('注册时不关联任何签约场地');
  expect(wrapper.text()).toContain('请至少使用 15 个字符');
  expect(wrapper.get('input[autocomplete="given-name"]').element.value).toBe('Mei');
  expect(wrapper.text()).toContain('创建账户并添加工种');
  setLocale('en'); await nextTick();
  expect(wrapper.text()).toContain('Start with no contracted sites.');
  wrapper.unmount();
});
it('translates every privileged access criterion and preserves the external guidance links', () => {
  setLocale('zh-CN');
  const wrapper = mount(AccessPolicyView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } });
  expect(wrapper.get('h1').text()).toContain('可信权限');
  expect(wrapper.findAll('ol li')).toHaveLength(5);
  expect(wrapper.text()).toContain('明确且独立的审批');
  expect(wrapper.get('a[href*="Authorization_Cheat_Sheet"]').attributes('rel')).toBe('noopener noreferrer');
  wrapper.unmount();
});
