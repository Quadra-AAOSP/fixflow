import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createIdempotencyKey,
  formatDate,
  formatMoney,
  relativeTime,
  truncate,
  weekdayLabel,
} from '../utils/format';

afterEach(() => {
  vi.useRealTimers();
});

describe('truncate', () => {
  it('returns the value unchanged when it is under or at the limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates over-limit values and appends an ellipsis', () => {
    expect(truncate('hello world', 6)).toBe('hello…');
    expect(truncate('hello world', 6)).toHaveLength(6);
  });

  it('does not leave trailing whitespace before the ellipsis', () => {
    expect(truncate('abc  def', 5)).toBe('abc…');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-01-15T12:00:00.000Z');

  function minutesAgo(minutes: number): string {
    return new Date(now.getTime() - minutes * 60_000).toISOString();
  }

  it('returns "Not available" for missing or unparseable values', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    expect(relativeTime(null)).toBe('Not available');
    expect(relativeTime(undefined)).toBe('Not available');
    expect(relativeTime('not-a-date')).toBe('Not available');
  });

  it('labels sub-minute, minutes, hours, and days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(relativeTime(new Date(now.getTime() - 30_000).toISOString())).toBe('Just now');
    expect(relativeTime(minutesAgo(5))).toBe('5m ago');
    expect(relativeTime(minutesAgo(180))).toBe('3h ago');
    expect(relativeTime(minutesAgo(2 * 24 * 60))).toBe('2d ago');
  });

  it('falls back to an absolute date after a week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const old = minutesAgo(8 * 24 * 60);
    expect(relativeTime(old)).toBe(formatDate(old));
  });
});

describe('createIdempotencyKey', () => {
  it('produces non-empty, distinct keys', () => {
    const first = createIdempotencyKey();
    const second = createIdempotencyKey();

    expect(typeof first).toBe('string');
    expect(first.length).toBeGreaterThan(0);
    expect(first).not.toBe(second);
  });
});

describe('weekdayLabel', () => {
  it('indexes labels by Date#getDay', () => {
    expect(weekdayLabel(new Date(2026, 0, 4))).toBe('Sun');
    expect(weekdayLabel(new Date(2026, 0, 5))).toBe('Mon');
    expect(weekdayLabel(new Date(2026, 0, 10))).toBe('Sat');
  });
});

describe('formatMoney', () => {
  it('formats minor units with the requested currency precision', () => {
    const usd = formatMoney(1234, 2, 'USD');
    expect(usd).toContain('12.34');

    const jpy = formatMoney(100, 0, 'JPY');
    expect(jpy).toContain('100');
  });
});

describe('formatDate', () => {
  it('returns "Not available" for missing or unparseable values', () => {
    expect(formatDate(null)).toBe('Not available');
    expect(formatDate(undefined)).toBe('Not available');
    expect(formatDate('not-a-date')).toBe('Not available');
  });

  it('formats a fixed ISO timestamp, optionally including the time', () => {
    const iso = '2026-01-15T08:30:00.000Z';
    const dateOnly = formatDate(iso);
    const withTime = formatDate(iso, true);

    expect(dateOnly).toContain('2026');
    expect(dateOnly).not.toBe('Not available');
    expect(withTime).toContain('2026');
    expect(withTime.length).toBeGreaterThan(dateOnly.length);
  });
});
