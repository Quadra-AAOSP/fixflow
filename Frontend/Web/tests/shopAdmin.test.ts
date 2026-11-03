import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../src/services/api';
import { productPayload, saveManagedProduct, getManagedProduct, deactivateManagedProduct, type ProductDraft } from '../src/services/shopAdmin';
vi.mock('../src/services/api', () => ({ request: vi.fn() }));
const draft: ProductDraft = { id: 'drill', name: 'Drill', description: 'A cordless drill', category: 'Tools', brand: null, imageUrl: null, priceMinor: 12500, stock: 9, active: true };
beforeEach(() => vi.resetAllMocks());
it('uses separate create and update DTOs without read-only metadata', async () => {
  await saveManagedProduct({ ...draft, createdAt: 'ignored' } as ProductDraft, false);
  expect(request).toHaveBeenLastCalledWith('/api/admin/shop/products', expect.objectContaining({ method: 'POST' }));
  expect(JSON.parse(vi.mocked(request).mock.calls.at(-1)![1]!.body as string)).toEqual(draft);
  await saveManagedProduct(draft, true);
  const { id, ...update } = draft;
  expect(request).toHaveBeenLastCalledWith(`/api/admin/shop/products/${id}`, expect.objectContaining({ method: 'PUT' }));
  expect(JSON.parse(vi.mocked(request).mock.calls.at(-1)![1]!.body as string)).toEqual(update);
});
it.each([{ priceMinor: -1 }, { stock: 2.5 }, { stock: 2147483648 }, { imageUrl: 'http://example.invalid/photo.png' }, { name: '' }])
('rejects invalid product values before sending: %j', change => {
  expect(() => productPayload({ ...draft, ...change })).toThrow(); expect(request).not.toHaveBeenCalled();
});
it('encodes IDs for detail and deactivation', async () => {
  await getManagedProduct('tools/drill'); expect(request).toHaveBeenLastCalledWith('/api/admin/shop/products/tools%2Fdrill');
  await deactivateManagedProduct('tools/drill'); expect(request).toHaveBeenLastCalledWith('/api/admin/shop/products/tools%2Fdrill', { method: 'DELETE' });
});
