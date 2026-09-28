import { request } from './api';
import type { ShopCatalog, ShopProduct } from '@/types/shop';

// Opt-in until the backend implements the contract in SHOP_API.md.
export const catalogPath = (import.meta.env.VITE_SHOP_CATALOG_PATH as string | undefined)?.trim() || '';
export function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}
export function parseCatalog(value: unknown): ShopCatalog {
  const data = value as Partial<ShopCatalog> | null;
  if (!data || typeof data.currency !== 'string' || !/^[A-Z]{3}$/.test(data.currency)
    || !Number.isInteger(data.minorUnitDigits) || data.minorUnitDigits! < 0 || data.minorUnitDigits! > 3 || !Array.isArray(data.products)) {
    throw new Error('The catalogue response is incomplete. Please try again later.');
  }
  const ids = new Set<string>();
  const products = data.products.map((item: ShopProduct) => {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)
      || typeof item.name !== 'string' || !item.name.trim() || typeof item.description !== 'string'
      || typeof item.category !== 'string' || !item.category.trim()
      || !Number.isSafeInteger(item.priceMinor) || item.priceMinor < 0
      || !Number.isSafeInteger(item.stock) || item.stock < 0) throw new Error('The catalogue contains invalid product details. Please try again later.');
    ids.add(item.id);
    return { ...item, brand: typeof item.brand === 'string' ? item.brand : null, imageUrl: safeImageUrl(item.imageUrl) };
  });
  return { currency: data.currency, minorUnitDigits: data.minorUnitDigits!, products };
}
export async function loadCatalog(): Promise<ShopCatalog> {
  if (!catalogPath.startsWith('/api/') || catalogPath.includes('..') || catalogPath.includes('?') || catalogPath.includes('#')) {
    throw new Error('The shop catalogue is not connected yet. Products will appear here when the shop opens.');
  }
  return parseCatalog(await request<unknown>(catalogPath));
}
