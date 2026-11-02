import { createI18n } from 'vue-i18n';
import chinese from './zh-CN.json';

export type WebLocale = 'en' | 'zh-CN';
export const LOCALE_STORAGE_KEY = 'fixflow.web.locale';
export function savedLocale(): WebLocale {
  try { return localStorage.getItem(LOCALE_STORAGE_KEY) === 'zh-CN' ? 'zh-CN' : 'en'; }
  catch { return 'en'; }
}
// English source messages remain readable in templates; exact resolution handles punctuation.
const english = Object.fromEntries(Object.keys(chinese).map(key => [key, key]));
export const i18n = createI18n({
  legacy: false,
  locale: savedLocale(),
  fallbackLocale: 'en',
  messages: { en: english, 'zh-CN': chinese },
  missingWarn: false,
  fallbackWarn: false,
  messageResolver: (messages, key) => {
    if (!messages || typeof messages !== 'object') return null;
    const value = (messages as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
  },
});
export function translate(source: string, values: Record<string, string | number> = {}) {
  if (Object.prototype.hasOwnProperty.call(chinese, source)) return i18n.global.t(source, values);
  // Preserve backend/user text as returned; only registered interface messages are translated.
  return Object.keys(values).length ? i18n.global.rt(source, values) : source;
}
export const localeTag = () => i18n.global.locale.value === 'zh-CN' ? 'zh-CN' : 'en-SG';
export function setLocale(value: string) {
  if (value !== 'en' && value !== 'zh-CN') return;
  i18n.global.locale.value = value;
  if (typeof document !== 'undefined') document.documentElement.lang = value;
  try { localStorage.setItem(LOCALE_STORAGE_KEY, value); } catch { /* Keep the selection for this session if storage is unavailable. */ }
}
if (typeof document !== 'undefined') document.documentElement.lang = i18n.global.locale.value;
export function useLocale() { return { locale: i18n.global.locale, t: translate, setLocale }; }
