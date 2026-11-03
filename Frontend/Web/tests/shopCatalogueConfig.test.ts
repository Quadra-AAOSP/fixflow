import { afterEach, expect, it, vi } from 'vitest';
import { request } from '../src/services/api';
vi.mock('../src/services/api', () => ({ request: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.clearAllMocks(); });
it('connects to the published catalogue when no override is configured', async () => {
  vi.stubEnv('VITE_SHOP_CATALOG_PATH', ''); vi.resetModules();
  vi.mocked(request).mockResolvedValue({ currency: 'SGD', minorUnitDigits: 2, products: [] });
  const { loadCatalog, catalogPath } = await import('../src/services/shop');
  expect(catalogPath).toBe('/api/shop/catalog');
  await expect(loadCatalog()).resolves.toEqual({ currency: 'SGD', minorUnitDigits: 2, products: [] });
  expect(request).toHaveBeenCalledWith('/api/shop/catalog');
});
it('retains a deployment API-path override', async () => {
  vi.stubEnv('VITE_SHOP_CATALOG_PATH', '/api/catalogue'); vi.resetModules();
  vi.mocked(request).mockResolvedValue({ currency: 'USD', minorUnitDigits: 2, products: [] });
  const { loadCatalog } = await import('../src/services/shop'); await loadCatalog();
  expect(request).toHaveBeenCalledWith('/api/catalogue');
});
it('rejects a non-API override without sending a request', async () => {
  vi.stubEnv('VITE_SHOP_CATALOG_PATH', 'https://example.invalid/catalogue'); vi.resetModules();
  const { loadCatalog } = await import('../src/services/shop');
  await expect(loadCatalog()).rejects.toThrow('not connected'); expect(request).not.toHaveBeenCalled();
});
