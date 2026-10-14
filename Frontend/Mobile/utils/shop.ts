import type { ShopCartItemPayload, ShopProduct } from '@/types';

export { formatMoney } from './format';

/**
 * Returns a URI safe to hand to `<Image>`, or `null`.
 *
 * The web build restricts images to `https` because a browser refuses mixed
 * content. A native app has no such rule and the dev MinIO instance serves
 * over plain `http`, so only non-network schemes are rejected here.
 */
export function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export type BasketLine = {
  product: ShopProduct;
  quantity: number;
};

/** Total item count across the basket — the badge value on the basket tab. */
export function basketCount(lines: BasketLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * Places in-stock products first, then sorts by the requested key. Sorting
 * happens client-side because the catalogue endpoint returns a single list.
 */
export type ShopSortKey = 'featured' | 'price-asc' | 'price-desc' | 'name';

export const SHOP_SORT_OPTIONS: { value: ShopSortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price ↑' },
  { value: 'price-desc', label: 'Price ↓' },
  { value: 'name', label: 'Name' },
];

export function sortProducts(
  products: ShopProduct[],
  key: ShopSortKey,
): ShopProduct[] {
  if (key === 'featured') return products;

  const sorted = [...products];
  sorted.sort((a, b) => {
    if (key === 'price-asc') return a.priceMinor - b.priceMinor;
    if (key === 'price-desc') return b.priceMinor - a.priceMinor;
    return a.name.localeCompare(b.name);
  });
  return sorted;
}

/** Distinct categories present in the catalogue, for the filter row. */
export function productCategories(products: ShopProduct[]): string[] {
  const seen = new Set<string>();
  for (const product of products) {
    const category = product.category?.trim();
    if (category) seen.add(category);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function matchesProductQuery(
  product: ShopProduct,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [product.name, product.brand, product.category, product.description]
    .filter((value): value is string => !!value)
    .join(' ')
    .toLocaleLowerCase()
    .includes(needle);
}

/** Converts basket lines into the wire payload the backend expects. */
export function toCartPayload(lines: BasketLine[]): ShopCartItemPayload[] {
  return lines.map((line) => ({
    productId: line.product.id,
    quantity: line.quantity,
  }));
}
