import { afterEach, expect, it, vi } from 'vitest';
import i18n from '@/constants/i18n';
import { formatDate, formatMoney, relativeTime, weekdayLabel } from '../utils/format';

afterEach(() => {
  i18n.language = 'en';
  vi.useRealTimers();
});

it('follows the app language for dates, amounts, relative time and weekday labels', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T12:00:00Z'));
  const stamp = '2026-11-06T11:55:00Z';
  i18n.language = 'zh';
  expect(formatDate(stamp)).toContain('2026');
  expect(formatDate(null)).toBe('不可用');
  expect(relativeTime(stamp)).toBe('5分钟前');
  expect(weekdayLabel(new Date(2026, 10, 6))).toBe('周五');
  expect(formatMoney(1234, 2, 'CNY')).toBe(new Intl.NumberFormat('zh', { style: 'currency', currency: 'CNY' }).format(12.34));
  expect(relativeTime(stamp, 'en')).toBe('5m ago');
});
