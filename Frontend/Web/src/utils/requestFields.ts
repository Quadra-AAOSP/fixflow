import type { SitePayload } from '@/types/maintenance';
import type { ShopCartItem } from '@/types/shop';

export function sitePayload(input: SitePayload): SitePayload {
  const currency = (input.contractFeeCurrency ?? 'USD').trim().toUpperCase() || 'USD';
  const value = { name: input.name.trim(), type: input.type, contractStatus: input.contractStatus,
    address: input.address?.trim() || null, description: input.description?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    contractFlatFeeMinor: input.contractFlatFeeMinor ?? null,
    contractFeeCurrency: currency };
  if (!value.name || value.name.length > 255 || (value.address?.length ?? 0) > 512 || (value.imageUrl?.length ?? 0) > 1024 ||
      !['school', 'hostel', 'hotel'].includes(value.type) || !['contracted', 'uncontracted'].includes(value.contractStatus) ||
      currency.length < 3 || currency.length > 8 ||
      (value.contractFlatFeeMinor != null && (!Number.isSafeInteger(value.contractFlatFeeMinor) || value.contractFlatFeeMinor < 0))) {
    throw new Error('Complete the site fields within the displayed limits.');
  }
  if (value.imageUrl) {
    try { if (!['https:', 'http:'].includes(new URL(value.imageUrl).protocol)) throw new Error(); }
    catch { throw new Error('Use an HTTP or HTTPS image URL.'); }
  }
  return value;
}

export function cartPayload(items: ShopCartItem[]): ShopCartItem[] {
  if (!items.length || items.some(item => !item.productId.trim() || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647)) {
    throw new Error('Choose products with valid whole-number quantities.');
  }
  // Preserve exact product IDs: they are opaque backend identifiers, not labels.
  return items.map(item => ({ productId: item.productId, quantity: item.quantity }));
}

export function shippingPayload(input: { shippingName: string; shippingPhone?: string; shippingAddress: string }) {
  const value = { shippingName: input.shippingName.trim(), shippingPhone: input.shippingPhone?.trim() || null,
    shippingAddress: input.shippingAddress.trim() };
  if (!value.shippingName || value.shippingName.length > 255 || (value.shippingPhone?.length ?? 0) > 64 ||
      !value.shippingAddress || value.shippingAddress.length > 512) {
    throw new Error('Enter a name and shipping address within the displayed limits.');
  }
  return value;
}

export function optionalContractText(value: string) {
  const text = value.trim();
  if (text.length > 1000) throw new Error('Use a note or reason of 1,000 characters or fewer.');
  return text || null;
}
export function positiveIdentifier(id: number, message: string) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(message);
  return id;
}
