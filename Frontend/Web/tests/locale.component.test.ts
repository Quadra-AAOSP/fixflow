// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import LanguageSelector from '../src/components/ui/LanguageSelector.vue';
import TextField from '../src/components/ui/TextField.vue';
import { i18n, LOCALE_STORAGE_KEY, savedLocale, setLocale, translate } from '../src/i18n';
import { formatDate } from '../src/utils/maintenance';
import chinese from '../src/i18n/zh-CN.json';

afterEach(() => { vi.restoreAllMocks(); setLocale('en'); localStorage.removeItem(LOCALE_STORAGE_KEY); });
describe('English and Chinese web locale', () => {
  it('formats named values and dates using the selected language', () => {
    setLocale('zh-CN');
    expect(translate('{count} reports', { count: 3 })).toBe('3 条报修记录');
    expect(formatDate('2026-09-21T12:00:00Z')).toContain('2026年');
    setLocale('en'); expect(translate('{count} reports', { count: 3 })).toBe('3 reports');
  });
  it('keeps interpolation values intact in every registered Chinese message', () => {
    for (const [source, translated] of Object.entries(chinese)) {
      const values = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
      expect(values(translated), source).toEqual(values(source));
    }
  });
  it('switches interface labels, document language, and the saved selection together', async () => {
    const wrapper = mount(LanguageSelector);
    await wrapper.get('select').setValue('zh-CN');
    expect(wrapper.text()).toContain('语言');
    expect(translate('Reports')).toBe('报修记录');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('zh-CN');
    expect(savedLocale()).toBe('zh-CN');
    wrapper.unmount();
  });
  it('falls back safely for unsupported saved preferences without translating user content', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'unsupported');
    expect(savedLocale()).toBe('en');
    setLocale('zh-CN');
    expect(translate('A user report @ the east gate')).toBe('A user report @ the east gate');
    setLocale('unsupported'); expect(i18n.global.locale.value).toBe('zh-CN');
  });
  it('keeps the chosen language usable when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    expect(() => setLocale('zh-CN')).not.toThrow();
    expect(translate('Sign out')).toBe('退出登录');
  });
  it('translates shared field labels and links accessible errors to their input', () => {
    setLocale('zh-CN');
    const wrapper = mount(TextField, { props: { label: 'Email', modelValue: '', error: 'Not available' } });
    expect(wrapper.text()).toContain('电子邮箱');
    const input = wrapper.get('input');
    expect(input.attributes('aria-invalid')).toBe('true');
    expect(input.attributes('aria-describedby')).toBe(wrapper.get('[role="alert"]').attributes('id'));
    wrapper.unmount();
  });
});
