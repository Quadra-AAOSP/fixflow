import { beforeEach, expect, it, vi } from 'vitest';
import { createOrder, parseOrderResult } from '../src/services/shop';
import { request } from '../src/services/api';
vi.mock('../src/services/api', () => ({ request: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const result = { orderId: 'order-fixture', totalMinor: 1000, checkoutUrl: 'https://checkout.example.invalid/session', paymentProvider: 'provider' };
it('keeps valid HTTPS provider links and explicit local development links', () => {
  expect(parseOrderResult(result)).toEqual(result);
  expect(parseOrderResult({ ...result, checkoutUrl: 'http://127.0.0.1:8081/shop?orderId=fixture', paymentProvider: 'dev' }).checkoutUrl).toBe('http://127.0.0.1:8081/shop?orderId=fixture');
  expect(parseOrderResult({ ...result, checkoutUrl: null, paymentProvider: null }).checkoutUrl).toBeNull();
});
it.each(['javascript:alert(1)', 'data:text/html,fixture', 'http://checkout.example.invalid/session', '/relative-payment', 'https://user:password@checkout.example.invalid/session'])('rejects an unsafe or ambiguous external checkout destination: %s', checkoutUrl => {
  expect(() => parseOrderResult({ ...result, checkoutUrl })).toThrow('payment link is invalid');
});
it('does not let a development-provider flag permit executable URLs', () => {
  expect(() => parseOrderResult({ ...result, paymentProvider: 'dev', checkoutUrl: 'javascript:alert(1)' })).toThrow('payment link is invalid');
});
it.each([{ orderId: '' }, { totalMinor: -1 }, { totalMinor: 1.5 }, { checkoutUrl: 42 }, { paymentProvider: undefined }])('rejects incomplete order metadata: %j', patch => {
  expect(() => parseOrderResult({ ...result, ...patch })).toThrow('response is incomplete');
});
it('validates the actual create-order response before any caller can use its link', async () => {
  vi.mocked(request).mockResolvedValue({ ...result, checkoutUrl: 'javascript:alert(1)' });
  await expect(createOrder({ items: [{ productId: 'tool', quantity: 1 }], shippingName: 'Fixture', shippingAddress: 'Fixture address', idempotencyKey: 'fixture-key' })).rejects.toThrow('Open Orders');
  expect(request).toHaveBeenCalledWith('/api/shop/orders', expect.objectContaining({ method: 'POST' }));
});
