import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../src/stores/auth';
import { useMaintenanceStore } from '../src/stores/maintenance';
import * as api from '../src/services/maintenance';
import { report, site } from './fixtures';
import type { Report } from '../src/types/maintenance';
vi.mock('../src/services/maintenance', () => ({ listSites: vi.fn(), listReports: vi.fn(), listRules: vi.fn() }));

beforeEach(() => {
  setActivePinia(createPinia()); vi.resetAllMocks();
  useAuthStore().user = { id: 1, email: 'test@example.invalid', firstName: 'Test', lastName: 'Account', role: 'super_admin', siteId: null, phone: null, address: null };
  vi.mocked(api.listSites).mockResolvedValue([site(7), site(9)]);
  vi.mocked(api.listRules).mockResolvedValue([]);
  vi.mocked(api.listReports).mockResolvedValue([]);
});
describe('site-scoped live state', () => {
  it('takes site IDs and categories from API results', async () => {
    vi.mocked(api.listRules).mockResolvedValue([{ id: 81, siteType: 'school', category: 'backend_new_trade', urgencyWeight: 2, sortOrder: 1 }]);
    const store = useMaintenanceStore(); await store.refresh();
    expect(store.selectedSiteId).toBe(7);
    expect(api.listReports).toHaveBeenCalledWith(7);
    expect(store.rules[0]?.category).toBe('backend_new_trade');
    expect(store.reportsLoaded).toBe(true);
  });
  it('does not turn a backend failure into an empty successful dashboard', async () => {
    const store = useMaintenanceStore(); await store.refresh();
    vi.mocked(api.listReports).mockRejectedValue(new Error('Database unavailable'));
    await store.refresh();
    expect(store.reportsLoaded).toBe(false); expect(store.reportsError).toBe('Database unavailable');
    expect(store.lastSynced).toBeNull(); expect(store.reports).toEqual([]);
  });
  it('ignores an old site response after switching sites', async () => {
    const store = useMaintenanceStore(); await store.refresh();
    let resolveOld!: (rows: Report[]) => void;
    vi.mocked(api.listReports).mockImplementation(id => id === 7 ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve([report({ siteId: 9, id: 90 })]));
    const old = store.selectSite(7); await store.selectSite(9);
    resolveOld([report({ siteId: 7 })]); await old;
    expect(store.selectedSiteId).toBe(9); expect(store.reports.map(row => row.id)).toEqual([90]);
  });
  it('does not repopulate private state after logout', async () => {
    const store = useMaintenanceStore(); await store.refresh();
    let resolve!: (rows: Report[]) => void;
    vi.mocked(api.listReports).mockImplementation(() => new Promise(done => { resolve = done; }));
    const loading = store.selectSite(7); store.reset(); resolve([report()]); await loading;
    expect(store.reports).toEqual([]); expect(store.selectedSiteId).toBeNull(); expect(store.reportsLoaded).toBe(false);
  });
  it('keeps updates from another site out of the current table', async () => {
    const store = useMaintenanceStore(); await store.refresh();
    store.upsert(report({ siteId: 9 })); expect(store.reports).toHaveLength(0);
    store.upsert(report({ siteId: 7 })); expect(store.reports).toHaveLength(1);
  });
});
