import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { parseCatalog, safeImageUrl } from '../src/services/shop';
import * as service from '../src/services/shop';
import { useShopStore } from '../src/stores/shop';

const product = { id: 'part-1', name: 'Test part', description: 'Test only', category: 'Parts', brand: null, imageUrl: null, priceMinor: 1255, stock: 3 };
const catalog = { currency: 'USD', minorUnitDigits: 2, products: [product] };
beforeEach(() => { vi.restoreAllMocks(); setActivePinia(createPinia()); });

describe('catalogue boundary', () => {
  it('accepts real zero stock and zero prices without inventing defaults', () => {
    expect(parseCatalog({ ...catalog, products: [{ ...product, stock: 0, priceMinor: 0 }] }).products[0]?.stock).toBe(0);
  });
  it('rejects malformed amounts, stock, currency and duplicate product IDs', () => {
    for (const patch of [{ priceMinor: -1 }, { priceMinor: 1.5 }, { stock: -1 }, { stock: 1.5 }, { name: '' }]) {
      expect(() => parseCatalog({ ...catalog, products: [{ ...product, ...patch }] })).toThrow();
    }
    expect(() => parseCatalog({ ...catalog, currency: '' })).toThrow();
    expect(() => parseCatalog({ ...catalog, products: [product, product] })).toThrow();
  });
  it('rejects unsafe image schemes and keeps HTTPS images', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl('http://example.com/image.jpg')).toBeNull();
    expect(safeImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
  });
});
describe('shop basket', () => {
  it('bounds quantities by stock and calculates minor-unit totals', async () => {
    vi.spyOn(service, 'loadCatalog').mockResolvedValue(catalog);
    const shop = useShopStore(); await shop.refresh();
    shop.setQuantity(product.id, 2);
    expect(shop.count).toBe(2); expect(shop.subtotal).toBe(2510);
    shop.setQuantity(product.id, 4); expect(shop.count).toBe(2);
    shop.setQuantity(product.id, -1); expect(shop.count).toBe(2);
    shop.setQuantity(product.id, 0); expect(shop.lines).toEqual([]);
  });
  it('reconciles stock on refresh and clears a basket if currency changes', async () => {
    const fetch = vi.spyOn(service, 'loadCatalog').mockResolvedValue(catalog);
    const shop = useShopStore(); await shop.refresh(); shop.setQuantity(product.id, 3);
    fetch.mockResolvedValue({ ...catalog, products: [{ ...product, stock: 1 }] });
    await shop.refresh(); expect(shop.count).toBe(1);
    fetch.mockResolvedValue({ ...catalog, currency: 'EUR' });
    await shop.refresh(); expect(shop.count).toBe(0);
  });
  it('does not accept a late response after signout reset', async () => {
    let resolve!: (value: typeof catalog) => void;
    vi.spyOn(service, 'loadCatalog').mockReturnValue(new Promise(r => { resolve = r; }));
    const shop = useShopStore(); const pending = shop.refresh(); shop.reset(); resolve(catalog); await pending;
    expect(shop.catalog).toBeNull(); expect(shop.count).toBe(0);
  });
  it('reports a failed refresh and freezes stale basket edits', async () => {
    const fetch = vi.spyOn(service, 'loadCatalog').mockResolvedValue(catalog);
    const shop = useShopStore(); await shop.refresh(); shop.setQuantity(product.id, 1);
    fetch.mockRejectedValue(new Error('Offline')); await shop.refresh();
    expect(shop.error).toBe('Offline'); shop.setQuantity(product.id, 2); expect(shop.count).toBe(1);
  });
});
