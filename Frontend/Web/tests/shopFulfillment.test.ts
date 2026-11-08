import { expect, it, vi } from 'vitest';
import { request } from '../src/services/api';
import { listManagedOrders, advanceFulfillment } from '../src/services/shopAdmin';
import { confirmDelivery } from '../src/services/shop';
vi.mock('../src/services/api', () => ({ request: vi.fn() }));
it('uses separate manager and buyer fulfillment endpoints', async () => {
 await listManagedOrders(0); expect(request).toHaveBeenLastCalledWith('/api/admin/shop/orders?page=0');
 await advanceFulfillment('a/b', 'shipped'); expect(request).toHaveBeenLastCalledWith('/api/admin/shop/orders/a%2Fb/fulfillment', { method: 'POST', body: JSON.stringify({status:'shipped'}) });
 await confirmDelivery('a/b', 'Buyer'); expect(request).toHaveBeenLastCalledWith('/api/shop/orders/a%2Fb/confirm-delivery', { method:'POST', body:JSON.stringify({signedName:'Buyer', received:true}) });
});
