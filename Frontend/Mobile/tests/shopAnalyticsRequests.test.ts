import { expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({ api }));
import { loadShopAnalytics } from '../services/shop';
it('requests the bounded analytics endpoint and returns the server result', async () => {
  const response = { totalOrders: 0, revenue: [], daily: [] };
  api.get.mockResolvedValue(response);
  await expect(loadShopAnalytics()).resolves.toBe(response);
  expect(api.get).toHaveBeenCalledWith('/api/admin/shop/analytics');
});
