import { request } from './api';
import { safeImageUrl } from './shop';
export interface ManagedProduct {
  id: string; name: string; description: string; category: string;
  brand: string | null; imageUrl: string | null; priceMinor: number; stock: number;
  active: boolean; createdAt: string; updatedAt: string;
}
export type ProductDraft = Omit<ManagedProduct, 'createdAt' | 'updatedAt'>;
const base = '/api/admin/shop/products';
const path = (id: string) => `${base}/${encodeURIComponent(id)}`;
export const listManagedProducts = () => request<ManagedProduct[]>(base);
export const getManagedProduct = (id: string) => request<ManagedProduct>(path(id));
export function productPayload(draft: ProductDraft) {
  const value = { id: draft.id.trim(), name: draft.name.trim(), description: draft.description, category: draft.category.trim(),
    priceMinor: draft.priceMinor, stock: draft.stock, active: draft.active,
    brand: draft.brand?.trim() || null, imageUrl: draft.imageUrl?.trim() || null };
  if (!value.id || value.id.length > 64 || !value.name || value.name.length > 255 ||
      !value.description.trim() || !value.category || value.category.length > 128 ||
      (value.brand?.length ?? 0) > 128 || (value.imageUrl?.length ?? 0) > 1024) {
    throw new Error('Complete the required product fields within the displayed limits.');
  }
  if (value.imageUrl && !safeImageUrl(value.imageUrl)) throw new Error('Use an HTTPS image URL.');
  if (![value.priceMinor, value.stock].every(n => Number.isInteger(n) && n >= 0 && n <= 2147483647)) {
    throw new Error('Price and stock must be non-negative whole numbers within the supported range.');
  }
  return value;
}
export function saveManagedProduct(draft: ProductDraft, editing: boolean) {
  const value = productPayload(draft);
  const { id, ...update } = value;
  return request<ManagedProduct>(editing ? path(id) : base, {
    method: editing ? 'PUT' : 'POST', body: JSON.stringify(editing ? update : value),
  });
}
// Backend DELETE deactivates the product; existing orders remain unchanged.
export const deactivateManagedProduct = (id: string) => request<void>(path(id), { method: 'DELETE' });
