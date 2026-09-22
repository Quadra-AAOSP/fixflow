import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import * as api from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import type { Report, Site, SiteRule } from '@/types/maintenance';

export const useMaintenanceStore = defineStore('maintenance', () => {
  const auth = useAuthStore();
  const sites = ref<Site[]>([]);
  const reports = ref<Report[]>([]);
  const rules = ref<SiteRule[]>([]);
  const selectedSiteId = ref<number | null>(null);
  const loading = ref(false);
  const sitesError = ref('');
  const reportsError = ref('');
  const rulesError = ref('');
  const reportsLoaded = ref(false);
  const lastSynced = ref<string | null>(null);
  let generation = 0;
  const selectedSite = computed(() => sites.value.find(site => site.id === selectedSiteId.value));
  const canCreate = computed(() => !!auth.user && ['reporter', 'staff', 'admin', 'super_admin'].includes(auth.user.role));
  const canAssign = computed(() => !!auth.user && ['staff', 'admin', 'super_admin'].includes(auth.user.role));
  const siteName = (id: number | null) => sites.value.find(site => site.id === id)?.name ?? (id == null ? 'Site unavailable' : `Site #${id}`);

  function reset() {
    generation++; sites.value = []; reports.value = []; rules.value = []; selectedSiteId.value = null;
    loading.value = false; sitesError.value = ''; reportsError.value = ''; rulesError.value = '';
    reportsLoaded.value = false; lastSynced.value = null;
  }
  async function loadScope(version: number) {
    const site = selectedSite.value;
    if (!site) { if (version === generation) loading.value = false; return; }
    const results = await Promise.allSettled([api.listReports(site.id), api.listRules(site.type)]);
    if (version !== generation) return;
    const [reportResult, ruleResult] = results;
    if (reportResult.status === 'fulfilled') {
      reports.value = reportResult.value; reportsLoaded.value = true; lastSynced.value = new Date().toISOString();
    } else reportsError.value = errorMessage(reportResult.reason);
    if (ruleResult.status === 'fulfilled') rules.value = ruleResult.value.sort((a,b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    else rulesError.value = errorMessage(ruleResult.reason);
    loading.value = false;
  }
  async function refresh() {
    if (!auth.user) { reset(); return; }
    const version = ++generation;
    loading.value = true; sitesError.value = ''; reportsError.value = ''; rulesError.value = '';
    reports.value = []; rules.value = []; reportsLoaded.value = false; lastSynced.value = null;
    try {
      const availableSites = await api.listSites();
      if (version !== generation) return;
      sites.value = availableSites;
      const preferred = auth.user?.role === 'super_admin' ? selectedSiteId.value : auth.user?.siteId;
      selectedSiteId.value = availableSites.find(site => site.id === preferred)?.id ?? availableSites[0]?.id ?? null;
      await loadScope(version);
    } catch (error) {
      if (version !== generation) return;
      sites.value = []; selectedSiteId.value = null; sitesError.value = errorMessage(error); loading.value = false;
    }
  }
  async function selectSite(id: number) {
    if (!sites.value.some(site => site.id === id)) return;
    const version = ++generation;
    selectedSiteId.value = id; reports.value = []; rules.value = []; reportsLoaded.value = false;
    reportsError.value = ''; rulesError.value = ''; lastSynced.value = null; loading.value = true;
    await loadScope(version);
  }
  function upsert(report: Report) {
    if (report.siteId !== selectedSiteId.value) return;
    reports.value = [report, ...reports.value.filter(item => item.id !== report.id)];
  }
  return { sites, reports, rules, selectedSiteId, selectedSite, loading, sitesError, reportsError, rulesError,
    reportsLoaded, lastSynced, canCreate, canAssign, siteName, refresh, selectSite, reset, upsert };
});
