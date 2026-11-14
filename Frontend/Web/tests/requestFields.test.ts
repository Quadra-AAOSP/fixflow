import { beforeEach, expect, it, vi } from 'vitest';
import { sitePayload, shippingPayload, cartPayload, optionalContractText } from '../src/utils/requestFields';
import { createSite } from '../src/services/maintenance';
import { createOrder } from '../src/services/shop';
import { requestTechnicianContract, decideContractApplication } from '../src/services/access';
import { request } from '../src/services/api';
vi.mock('../src/services/api', () => ({ request: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const site = { name: 'Campus', type: 'school' as const, contractStatus: 'contracted' as const, address: null, description: null, imageUrl: null, contractFlatFeeMinor: 50000, contractFeeCurrency: 'USD' };
it('accepts the site DTO maximums without inventing a description cap', () => {
  expect(sitePayload({ ...site, name: 'n'.repeat(255), address: 'a'.repeat(512), imageUrl: 'https://example.invalid/' + 'x'.repeat(1000), description: 'd'.repeat(12000) }).description).toHaveLength(12000);
  expect(sitePayload({ ...site, address: ' ', description: '' })).toMatchObject({ address: null, description: null });
});
it.each([{ name: 'n'.repeat(256) }, { address: 'a'.repeat(513) }, { imageUrl: 'https://example.invalid/' + 'x'.repeat(1024) }, { imageUrl: 'javascript:alert(1)' }])('rejects invalid site fields before POST', patch => {
  expect(() => createSite({ ...site, ...patch })).toThrow(); expect(request).not.toHaveBeenCalled();
});
it('accepts exact shipping limits and converts blank optional phone to null', () => {
  expect(shippingPayload({ shippingName: 'n'.repeat(255), shippingPhone: 'p'.repeat(64), shippingAddress: 'a'.repeat(512) }).shippingName).toHaveLength(255);
  expect(shippingPayload({ shippingName: ' Buyer ', shippingPhone: ' ', shippingAddress: ' Address ' })).toEqual({ shippingName: 'Buyer', shippingPhone: null, shippingAddress: 'Address' });
});
it.each([{ shippingName: 'n'.repeat(256) }, { shippingPhone: 'p'.repeat(65) }, { shippingAddress: 'a'.repeat(513) }, { shippingName: ' ' }])('rejects invalid shipping fields before order creation', async patch => {
  await expect(createOrder({ items: [{ productId: 'tool', quantity: 1 }], shippingName: 'Buyer', shippingAddress: 'Address', idempotencyKey: 'fixture-key', ...patch })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
it.each([0, -1, 1.5, 2147483648])('rejects cart quantity %s outside the Java DTO range', quantity => {
  expect(() => cartPayload([{ productId: 'tool', quantity }])).toThrow();
});
it('preserves opaque product IDs and rejects an empty basket', () => {
  expect(cartPayload([{ productId: 'part/001', quantity: 2147483647 }])[0]!.productId).toBe('part/001');
  expect(() => cartPayload([])).toThrow();
});
it('bounds contract note/reason text and retains optional nullability', () => {
  expect(optionalContractText('n'.repeat(1000))).toHaveLength(1000); expect(optionalContractText(' ')).toBeNull();
  expect(() => requestTechnicianContract(7, 'n'.repeat(1001))).toThrow();
  expect(() => decideContractApplication(9, 'reject', 'r'.repeat(1001))).toThrow();
  expect(request).not.toHaveBeenCalled();
});
