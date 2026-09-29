import { request } from './api';
import type {
  ShopCartItem,
  ShopCatalog,
  ShopCreateOrderResult,
  ShopOrder,
  ShopProduct,
  ShopQuote,
} from '@/types/shop';

// Opt-in until the backend implements the contract in SHOP_API.md.
export const catalogPath = (import.meta.env.VITE_SHOP_CATALOG_PATH as string | undefined)?.trim() || '';

export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function parseCatalog(value: unknown): ShopCatalog {
  const data = value as Partial<ShopCatalog> | null;
  if (
    !data ||
    typeof data.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(data.currency) ||
    !Number.isInteger(data.minorUnitDigits) ||
    data.minorUnitDigits! < 0 ||
    data.minorUnitDigits! > 3 ||
    !Array.isArray(data.products)
  ) {
    throw new Error('The catalogue response is incomplete. Please try again later.');
  }
  const ids = new Set<string>();
  const products = data.products.map((item: ShopProduct) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      ids.has(item.id) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      typeof item.description !== 'string' ||
      typeof item.category !== 'string' ||
      !item.category.trim() ||
      !Number.isSafeInteger(item.priceMinor) ||
      item.priceMinor < 0 ||
      !Number.isSafeInteger(item.stock) ||
      item.stock < 0
    ) {
      throw new Error('The catalogue contains invalid product details. Please try again later.');
    }
    ids.add(item.id);
    return {
      ...item,
      brand: typeof item.brand === 'string' ? item.brand : null,
      imageUrl: safeImageUrl(item.imageUrl),
    };
  });
  return { currency: data.currency, minorUnitDigits: data.minorUnitDigits!, products };
}

export async function loadCatalog(): Promise<ShopCatalog> {
  if (
    !catalogPath.startsWith('/api/') ||
    catalogPath.includes('..') ||
    catalogPath.includes('?') ||
    catalogPath.includes('#')
  ) {
    throw new Error('The shop catalogue is not connected yet. Products will appear here when the shop opens.');
  }
  return parseCatalog(await request<unknown>(catalogPath));
}

export async function quoteCheckout(items: ShopCartItem[]): Promise<ShopQuote> {
  return request<ShopQuote>('/api/shop/checkout/quote', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function createOrder(payload: {
  items: ShopCartItem[];
  shippingName: string;
  shippingPhone?: string;
  shippingAddress: string;
  idempotencyKey: string;
}): Promise<ShopCreateOrderResult> {
  return request<ShopCreateOrderResult>('/api/shop/orders', {
    method: 'POST',
    headers: { 'Idempotency-Key': payload.idempotencyKey },
    body: JSON.stringify({
      items: payload.items,
      shippingName: payload.shippingName,
      shippingPhone: payload.shippingPhone || null,
      shippingAddress: payload.shippingAddress,
    }),
  });
}

export async function listOrders(): Promise<ShopOrder[]> {
  return request<ShopOrder[]>('/api/shop/orders');
}

export async function getOrder(orderId: string): Promise<ShopOrder> {
  return request<ShopOrder>(`/api/shop/orders/${encodeURIComponent(orderId)}`);
}

export async function cancelOrder(orderId: string): Promise<ShopOrder> {
  return request<ShopOrder>(`/api/shop/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
  });
}

export async function completeDevPayment(orderId: string): Promise<ShopOrder> {
  return request<ShopOrder>(`/api/shop/payments/dev/complete/${encodeURIComponent(orderId)}`, {
    method: 'POST',
  });
}
