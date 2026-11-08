import { expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({ api }));
import { advanceManagerOrder, confirmDelivery, getManagerOrder, listManagerOrders, listShopNotifications } from '../services/shop';
it('sends fulfillment and receipt requests with the server contract', async () => {
  await listManagerOrders(2);
  await getManagerOrder('order/1');
  await advanceManagerOrder('order/1', 'shipped');
  await confirmDelivery('order/1', 'Taylor');
  await listShopNotifications(1);
  expect(api.get).toHaveBeenCalledWith('/api/admin/shop/orders?page=2');
  expect(api.get).toHaveBeenCalledWith('/api/admin/shop/orders/order%2F1');
  expect(api.post).toHaveBeenCalledWith('/api/admin/shop/orders/order%2F1/fulfillment', { status: 'shipped' });
  expect(api.post).toHaveBeenCalledWith('/api/shop/orders/order%2F1/confirm-delivery', { signedName: 'Taylor', received: true });
  expect(api.get).toHaveBeenCalledWith('/api/shop/notifications?page=1');
});

import { canConfirmReceipt, canShopPurchase } from '../utils/shop';
it('requires a bounded nonblank name and receipt agreement and blocks shop managers', () => {
  expect(canConfirmReceipt('  ', true)).toBe(false);
  expect(canConfirmReceipt('A'.repeat(161), true)).toBe(false);
  expect(canConfirmReceipt('Taylor', false)).toBe(false);
  expect(canConfirmReceipt(' Taylor ', true)).toBe(true);
  expect(canShopPurchase('shop_manager')).toBe(false);
  expect(canShopPurchase('super_admin')).toBe(true);
});
