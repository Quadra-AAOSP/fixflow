import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
  },
}));

import { markNoticesSeen, readSeen } from '../lib/notificationSeen';

beforeEach(() => store.clear());

describe('notification seen watermarks', () => {
  it('advances monotonically and isolates report and shop feeds', async () => {
    await markNoticesSeen(84101, 'reports', [{ id: 12 }, { id: 7 }]);
    await markNoticesSeen(84101, 'reports', [{ id: 9 }]);
    await markNoticesSeen(84101, 'shop', [{ id: 4 }]);
    expect(await readSeen(84101)).toEqual({ reports: 12, shop: 4 });
  });

  it('isolates watermarks by account', async () => {
    await markNoticesSeen(84102, 'shop', [{ id: 16 }]);
    await markNoticesSeen(84103, 'shop', [{ id: 2 }]);
    expect(await readSeen(84102)).toEqual({ reports: 0, shop: 16 });
    expect(await readSeen(84103)).toEqual({ reports: 0, shop: 2 });
  });
});
