// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { markNoticesSeen, readSeen } from '../src/utils/notificationSeen';

beforeEach(() => localStorage.clear());

describe('notification seen watermarks', () => {
  it('advances monotonically and keeps report and shop feeds separate', async () => {
    await markNoticesSeen(74101, 'reports', [{ id: 9 }, { id: 4 }]);
    await markNoticesSeen(74101, 'reports', [{ id: 6 }]);
    await markNoticesSeen(74101, 'shop', [{ id: 3 }]);
    expect(await readSeen(74101)).toEqual({ reports: 9, shop: 3 });
  });

  it('isolates watermarks by account', async () => {
    await markNoticesSeen(74102, 'shop', [{ id: 14 }]);
    await markNoticesSeen(74103, 'shop', [{ id: 2 }]);
    expect(await readSeen(74102)).toEqual({ reports: 0, shop: 14 });
    expect(await readSeen(74103)).toEqual({ reports: 0, shop: 2 });
  });
});
