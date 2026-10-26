import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  ShopAdminProduct,
  ShopAdminProductPayload,
  ShopAdminProductUpdatePayload,
  ShopCartItemPayload,
  ShopCatalog,
  ShopCreateOrderPayload,
  ShopCreateOrderResult,
  ShopOrder,
  ShopQuote,
} from '@/types';
import { createIdempotencyKey } from '@/utils/format';

/** Public catalogue — reachable without a session. */
export function loadCatalog(): Promise<ShopCatalog> {
  return api.get<ShopCatalog>(endpoints.shop.catalog);
}

/** Server-side price/stock quote for the current basket. */
export function quoteCheckout(items: ShopCartItemPayload[]): Promise<ShopQuote> {
  return api.post<ShopQuote>(endpoints.shop.quote, { items });
}

/**
 * Places an order. The `Idempotency-Key` header lets a retry (flaky network,
 * double tap) safely return the original order instead of charging twice.
 */
export function createOrder(
  payload: ShopCreateOrderPayload,
): Promise<ShopCreateOrderResult> {
  return api.post<ShopCreateOrderResult>(endpoints.shop.orders, payload, {
    headers: { 'Idempotency-Key': createIdempotencyKey() },
  });
}

export function listOrders(): Promise<ShopOrder[]> {
  return api.get<ShopOrder[]>(endpoints.shop.orders);
}

export function getOrder(publicId: string): Promise<ShopOrder> {
  return api.get<ShopOrder>(endpoints.shop.order(publicId));
}

export function cancelOrder(publicId: string): Promise<ShopOrder> {
  return api.post<ShopOrder>(endpoints.shop.cancel(publicId));
}

/**
 * Dev-only payment settlement. The provider webhook is the production path;
 * this endpoint exists so the checkout flow can be completed end-to-end in
 * development without a real payment provider.
 */
export function completeDevPayment(publicId: string): Promise<ShopOrder> {
  return api.post<ShopOrder>(endpoints.shop.devCompletePayment(publicId));
}

/** Shop-manager product list (includes inactive products). */
export function adminListProducts(): Promise<ShopAdminProduct[]> {
  return api.get<ShopAdminProduct[]>(endpoints.shopAdmin.products);
}

export function adminCreateProduct(
  payload: ShopAdminProductPayload,
): Promise<ShopAdminProduct> {
  return api.post<ShopAdminProduct>(endpoints.shopAdmin.products, payload);
}

export function adminUpdateProduct(
  id: string,
  payload: ShopAdminProductUpdatePayload,
): Promise<ShopAdminProduct> {
  return api.put<ShopAdminProduct>(endpoints.shopAdmin.product(id), payload);
}

export function adminDeleteProduct(id: string): Promise<void> {
  return api.del<void>(endpoints.shopAdmin.product(id));
}
