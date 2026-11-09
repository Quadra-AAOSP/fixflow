import { computed, ref } from 'vue';
import { translate } from '@/i18n';
import { defineStore } from 'pinia';
import { useAuthStore } from './auth';
import * as api from '@/services/maintenance';
import { ApiError, errorMessage } from '@/services/api';
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
  const reportPage = ref(0);
  const totalReportPages = ref(0);
  const loadingMore = ref(false);
  const lastSynced = ref<string | null>(null);
  let generation = 0;
  let scopeRequest: AbortController | undefined;
  const reportRequests = new Map<number, symbol>();
  const selectedSite = computed(() => sites.value.find(site => site.id === selectedSiteId.value));
  const canCreate = computed(() => auth.user?.capabilities?.createReport ?? (!!auth.user && ['reporter', 'staff', 'admin', 'super_admin'].includes(auth.user.role)));
  const canAssign = computed(() => auth.user?.capabilities?.assignTechnician ?? (!!auth.user && ['staff', 'admin', 'super_admin'].includes(auth.user.role)));
  const siteName = (id: number | null) => sites.value.find(site => site.id === id)?.name ?? (id == null ? translate('Site unavailable') : translate('Site #{id}', { id }));

  function clearReportPages() {
    generation++; scopeRequest?.abort(); scopeRequest = undefined;
    reportRequests.clear();
    reports.value = []; reportsLoaded.value = false; lastSynced.value = null;
    reportPage.value = 0; totalReportPages.value = 0; loadingMore.value = false;
  }

  function reset() {
    clearReportPages();
    sites.value = []; reports.value = []; rules.value = []; selectedSiteId.value = null;
    loading.value = false; sitesError.value = ''; reportsError.value = ''; rulesError.value = '';
    reportsLoaded.value = false; lastSynced.value = null;
  }
  async function loadScope(version: number) {
    const site = selectedSite.value;
    if (!site) { if (version === generation) loading.value = false; return; }
    const reportResult = api.listReportPage(site.id, 0, scopeRequest?.signal).then(page => {
      if (version !== generation) return;
      reports.value = page.content;
      reportPage.value = page.page;
      totalReportPages.value = page.totalPages;
      reportsLoaded.value = true;
      lastSynced.value = new Date().toISOString();
    }).catch(error => {
      if (version === generation) reportsError.value = errorMessage(error);
    }).finally(() => {
      if (version === generation) loading.value = false;
    });
    const ruleResult = api.listRules(site.type).then(result => {
      if (version === generation) rules.value = result.sort((a,b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }).catch(error => {
      if (version === generation) rulesError.value = errorMessage(error);
    });
    await Promise.all([reportResult, ruleResult]);
  }
  async function refresh() {
    if (!auth.user || auth.user.role === 'shop_manager') { reset(); return; }
    clearReportPages();
    const version = generation;
    scopeRequest = new AbortController();
    loading.value = true; sitesError.value = ''; reportsError.value = ''; rulesError.value = '';
    reports.value = []; reportsLoaded.value = false; lastSynced.value = null;
    try {
      const availableSites = await api.listSites();
      if (version !== generation) return;
      sites.value = availableSites;
      const preferred = auth.user?.role === 'super_admin' ? selectedSiteId.value : auth.user?.siteId;
      const nextSiteId = availableSites.find(site => site.id === preferred)?.id ?? availableSites[0]?.id ?? null;
      if (nextSiteId !== selectedSiteId.value) {
        reports.value = []; rules.value = []; reportsLoaded.value = false; lastSynced.value = null;
      }
      selectedSiteId.value = nextSiteId;
      await loadScope(version);
    } catch (error) {
      if (version !== generation) return;
      sites.value = []; selectedSiteId.value = null; sitesError.value = errorMessage(error); loading.value = false;
    }
  }
  async function selectSite(id: number) {
    if (!sites.value.some(site => site.id === id)) return;
    clearReportPages();
    const version = generation;
    scopeRequest = new AbortController();
    selectedSiteId.value = id; reports.value = []; rules.value = []; reportsLoaded.value = false;
    reportsError.value = ''; rulesError.value = ''; lastSynced.value = null; loading.value = true;
    await loadScope(version);
  }
  async function loadMore() {
    if (loadingMore.value || loading.value || !selectedSiteId.value || reportPage.value + 1 >= totalReportPages.value) return;
    const version = generation;
    const siteId = selectedSiteId.value;
    loadingMore.value = true;
    reportsError.value = '';
    try {
      const result = await api.listReportPage(siteId, reportPage.value + 1, scopeRequest?.signal);
      if (version !== generation) return;
      const combined = new Map(reports.value.map(item => [item.id, item]));
      result.content.forEach(item => combined.set(item.id, item));
      reports.value = [...combined.values()];
      reportPage.value = result.page;
      totalReportPages.value = result.totalPages;
    } catch (error) {
      if (version === generation) reportsError.value = errorMessage(error);
    } finally {
      if (version === generation) loadingMore.value = false;
    }
  }
  async function refreshReport(id: number) {
    if (!reportsLoaded.value || selectedSiteId.value == null) return;
    const version = generation;
    const request = Symbol();
    reportRequests.set(id, request);
    const current = () => version === generation && reportRequests.get(id) === request;
    try {
      const result = await api.getReport(id, scopeRequest?.signal);
      if (current() && result.id === id) upsert(result);
    } catch (error) {
      if (current() && error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        reports.value = reports.value.filter(item => item.id !== id);
      }
    } finally {
      if (current()) reportRequests.delete(id);
    }
  }
  function upsert(report: Report) {
    if (report.siteId !== selectedSiteId.value) return;
    reports.value = [report, ...reports.value.filter(item => item.id !== report.id)];
  }
  return { sites, reports, rules, selectedSiteId, selectedSite, loading, sitesError, reportsError, rulesError,
    reportsLoaded, reportPage, totalReportPages, loadingMore, loadMore, lastSynced, canCreate, canAssign, siteName,
    refresh, selectSite, reset, upsert, clearReportPages, refreshReport };
});
