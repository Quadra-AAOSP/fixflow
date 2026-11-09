import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ClipboardList, Search, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Picker } from '@/components/ui/Picker';
import { FilterTabs } from '@/components/ui/FilterTabs';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { useToast } from '@/components/ui/useToastContext';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { claimReport, listReports } from '@/services/reports';
import { listTechnicianContracts } from '@/services/technician';
import { searchReportsNl, searchReportPage } from '@/services/searchNl';
import { useCurrentSite } from '@/stores/site';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import type { NlSearchFilters, Report, Urgency } from '@/types';
import { formatDate, humanize } from '@/utils/format';
import {
  REPORT_FILTERS,
  ReportFilter,
  effectiveUrgency,
  matchesFilter,
  searchReports,
  statusGroup,
} from '@/utils/maintenance';

const TONE_BAR: Record<string, string> = {
  primary: 'bg-dashboard-stat-coral-soft',
  accent: 'bg-dashboard-stat-mint-soft',
  lime: 'bg-dashboard-stat-citron-soft',
};

function toneBarClass(report: Report): string {
  return TONE_BAR[statusGroup(report.status)] ?? 'bg-dashboard-card-line';
}

/**
 * "Assignments" tab. Mirrors `AssignmentsView.vue`:
 */
export default function AssignmentsScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const { site: currentSite, sites, loading: siteLoading, error: siteError, refresh: refreshSite } = useCurrentSite();

  const isTechnician = user?.role === 'technician';

  const [reports, setReports] = useState<Report[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [nlFilters, setNlFilters] = useState<NlSearchFilters | null>(null);
  const [searchSiteId, setSearchSiteId] = useState<number | null>(null);
  const [contractSiteIds, setContractSiteIds] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<Report[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const searchGeneration = useRef(0);
  useEffect(() => { searchGeneration.current++; setNlFilters(null); setSearchResults([]); }, [searchSiteId, user?.id]);
  async function fetchSearch(filters: NlSearchFilters, page: number, siteId: number, generation: number) {
    const result = await searchReportPage(siteId, filters, page, 20);
    if (generation !== searchGeneration.current) return;
    setSearchResults(previous => page ? [...previous, ...result.content] : result.content);
    setSearchPage(page); setSearchHasMore(result.hasMore);
  }
  const [searchBusy, setSearchBusy] = useState(false);
  const [filter, setFilter] = useState<ReportFilter>('all');
  // Number of sites this technician is contracted to. Technicians have no
  // account-level site, so their queue is scoped by contracts instead.
  const [contractSiteCount, setContractSiteCount] = useState(0);
  // Which claimable report is currently being claimed (spinner + lockout).
  const [claimingId, setClaimingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    if (!isTechnician && !currentSite) return;
    setError(null);
    if (reports === null) setLoading(true);
    try {
      if (isTechnician) {
        // Technicians may be contracted without an account site. Their
        // contracts â€” not the account site â€” define which reports are reachable,
        // so fan out over every contract site and merge by report id.
        const contracts = await listTechnicianContracts();
        const siteIds = Array.from(new Set(contracts.map((contract) => contract.siteId)));
        setContractSiteCount(siteIds.length);
        setContractSiteIds(siteIds);
        setSearchSiteId(previous => previous && siteIds.includes(previous) ? previous : siteIds[0] ?? null);
        const pages = await Promise.all(
          siteIds.map((siteId) => listReports({ siteId })),
        );
        const merged = new Map<number, Report>();
        for (const report of pages.flat()) merged.set(report.id, report);
        setReports(Array.from(merged.values()));
      } else if (currentSite) {
        const result = await listReports({ siteId: currentSite.id });
        setReports(result);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('assignments.errors.couldNotLoad'),
      );
      // Surface the failure instead of leaving a stale list on screen.
      if (reports === null) setReports(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSite?.id, user?.id, isTechnician]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRealtimeSignal = useCallback(() => {
    if (realtimeTimer.current !== null) clearTimeout(realtimeTimer.current);
    realtimeTimer.current = setTimeout(() => {
      realtimeTimer.current = null;
      void load();
    }, 600);
  }, [load]);
  useRealtimeEvents(
    currentSite ? `/sites/${currentSite.id}/events` : null,
    onRealtimeSignal,
    { enabled: user !== null },
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
      await refreshSite();
    } finally {
      setRefreshing(false);
    }
  }

  /**
   * Claim an unassigned queue item. The backend gates this on an active
   * contract at the report's site plus accepted terms, so a rejection (403 /
   * 409) is surfaced verbatim instead of being swallowed.
   */
  async function onClaim(id: number) {
    if (claimingId !== null) return;
    setClaimingId(id);
    try {
      await claimReport(id);
      showToast(t('assignments.claimed'), 'success');
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : t('assignments.claimFailed'),
        'error',
      );
    } finally {
      setClaimingId(null);
    }
  }

  const canAssign = user?.capabilities.assignTechnician ?? false;

  // Scope by role: technicians see ONLY their own queue items; staff/admin see
  // every site report that's in an unresolved queue state. Then split into
  // "Assigned to me" vs "Available to claim" (unassigned queue items) for the
  // technician UI, so they have a clean two-section view.
  const assignedToMe = useMemo(() => {
    if (!reports || !isTechnician) return [];
    return (nlFilters ? searchResults : reports).filter(
      (r) => r.policy.inAssignmentQueue && r.assignedTechnicianId === user?.id,
    );
  }, [reports, isTechnician, user?.id, nlFilters, searchResults]);

  const availableToClaim = useMemo(() => {
    if (!reports || !isTechnician) return [];
    return (nlFilters ? searchResults : reports).filter(
      (r) => r.policy.inAssignmentQueue && r.assignedTechnicianId === null,
    );
  }, [reports, isTechnician]);

  const scoped = useMemo(() => {
    if (!reports) return [];
    const base = reports.filter((r) => r.policy.inAssignmentQueue);
    if (isTechnician) {
      // Technician only sees what's either theirs or unassigned (claimable).
      return base.filter(
        (r) => r.assignedTechnicianId === null || r.assignedTechnicianId === user?.id,
      );
    }
    // Staff/admin see everything unresolved â€” sorted by assignee.
    return base.sort(
      (a, b) => (a.assignedTechnicianId ?? 0) - (b.assignedTechnicianId ?? 0),
    );
  }, [reports, isTechnician, user?.id, nlFilters, searchResults]);

  // Report lists from technicians span several contract sites, so resolve
  // names from the full site directory rather than only the active site.
  const siteNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const site of sites) map.set(site.id, site.name);
    if (currentSite) map.set(currentSite.id, currentSite.name);
    return map;
  }, [sites, currentSite]);

  const siteName = useCallback(
    (id: number | null) => (id === null ? '' : siteNames.get(id) ?? ''),
    [siteNames],
  );

  const filtered = useMemo(
    () => searchReports(scoped, query, siteName, filter),
    [scoped, query, siteName, filter],
  );

  // Unique assignees among the scoped (unresolved, assigned) set â€” mirrors
  // the web, which counts over `assignments`, not the raw report list.
  const technicianCount = useMemo(() => {
    const seen = new Set<number>();
    for (const report of scoped) {
      if (report.assignedTechnicianId !== null) seen.add(report.assignedTechnicianId);
    }
    return seen.size;
  }, [scoped]);

  const filterOptions = REPORT_FILTERS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
    count: scoped.filter((report) => matchesFilter(report, option.value)).length,
  }));

  if (!currentSite && !isTechnician) {
    if (siteLoading) {
      return (
        <Screen>
          <StateView variant="loading" title={t('assignments.loadingSite')} />
        </Screen>
      );
    }
    if (siteError) {
      return (
        <Screen>
          <StateView
            variant="error"
            title={t('assignments.couldNotLoadTitle')}
            description={siteError.message}
            actionLabel={t('assignments.errors.retry')}
            onAction={() => {
              void refreshSite();
            }}
          />
        </Screen>
      );
    }
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={Wrench}
          title={t('assignments.noSiteTitle')}
          description={t('assignments.noSiteDesc')}
        />
      </Screen>
    );
  }

  if (error && reports === null) {
    return (
      <Screen>
        <StateView
          variant="error"
          title={t('assignments.couldNotLoadTitle')}
          description={error}
          actionLabel={t('assignments.errors.retry')}
          onAction={() => {
            void load();
          }}
        />
      </Screen>
    );
  }

  if (isTechnician) {
    // Technician UI splits into two explicit sections so the queue is legible
    // at a glance â€” "Assigned to me" and "Available to claim".
    return (
      <Screen>
        <ScrollView
          contentContainerClassName="grow px-5 pb-6 pt-4"
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.primary}
            />
          }
        >
          <View className="mb-2 flex-row items-center gap-3">
            <View
              className="rounded-xl p-3"
              style={{ backgroundColor: dashboardColors.statMintSoft }}
            >
              <ClipboardList color={dashboardColors.statMintDeep} size={26} />
            </View>
            <View className="flex-1">
              <Text
                className="text-xl font-bold text-ink"
                style={{ letterSpacing: -0.4 }}
              >
                {t('assignments.myAssignmentsTitle')}
              </Text>
              <Text className="mt-0.5 text-xs text-dashboard-subtitle">
                {isTechnician
                  ? t('assignments.contractSites', {
                      count: contractSiteCount,
                      plural: contractSiteCount === 1 ? '' : 's',
                    })
                  : currentSite?.name ?? ''}
                {reports !== null
                  ? ` Â· ${t('assignments.assignedCount', { count: assignedToMe.length })}${
                      availableToClaim.length > 0
                        ? ` Â· ${t('assignments.claimableCount', { count: availableToClaim.length })}`
                        : ''
                    }`
                  : ''}
              </Text>
            </View>
          </View>

          {contractSiteIds.length > 1 && <Picker label="Search site" value={String(searchSiteId ?? '')} onChange={value => setSearchSiteId(Number(value))} options={contractSiteIds.map(id => ({ value: String(id), label: siteName(id) || `Site #${id}` }))} />}
          <SearchField value={query} onChangeText={(value) => { searchGeneration.current++; setQuery(value); setNlFilters(null); }} placeholder={t('assignments.searchPlaceholder')} />
          <Button disabled={!query.trim() || !searchSiteId || searchBusy} onPress={async () => {
            if (!searchSiteId) return;
            const generation = ++searchGeneration.current;
            setSearchBusy(true);
            try {
              const result = await searchReportsNl(searchSiteId, query.trim());
              if (generation !== searchGeneration.current) return;
              await fetchSearch(result.filters, 0, searchSiteId, generation);
              if (generation !== searchGeneration.current) return;
              setNlFilters(result.filters);
              if (result.fallback) showToast('AI search unavailable; using text search.', 'error');
            } catch (err) { showToast(err instanceof Error ? err.message : 'Search failed', 'error'); }
            finally { setSearchBusy(false); }
          }}>{searchBusy ? 'Searchingâ€¦' : 'Search with AI'}</Button>
          {nlFilters && <View className="my-2"><Text className="text-dashboard-subtitle">{Object.entries(nlFilters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'All reports'}</Text><Pressable accessibilityRole="button" onPress={() => { searchGeneration.current++; setNlFilters(null); setSearchResults([]); setQuery(''); }}><Text className="text-dashboard-teal">Clear search</Text></Pressable></View>}
          {loading ? (
            <StateView variant="loading" title={t('assignments.loading')} />
          ) : error && reports === null ? (
            <StateView
              variant="error"
              title={t('assignments.couldNotLoadTitle')}
              description={error}
              actionLabel={t('assignments.errors.retry')}
              onAction={() => { void load(); }}
            />
          ) : (
            <TechnicianSections
              t={t}
              assigned={nlFilters ? assignedToMe : searchReports(assignedToMe, query, siteName, 'all')}
              available={nlFilters ? availableToClaim : searchReports(availableToClaim, query, siteName, 'all')}
              onOpen={(id) => router.push(`/reports/${id}`)}
              onClaim={onClaim}
              claimingId={claimingId}
              siteName={(id) => siteName(id)}
            />
          )}
          {nlFilters && searchHasMore && <Button disabled={searchBusy} onPress={async () => { if (!searchSiteId) return; setSearchBusy(true); try { await fetchSearch(nlFilters, searchPage + 1, searchSiteId, searchGeneration.current); } catch (err) { showToast(err instanceof Error ? err.message : 'Search failed', 'error'); } finally { setSearchBusy(false); } }}>Load more</Button>}
        </ScrollView>
      </Screen>
    );
  }

  // -------- Non-technician UI (staff/admin/super_admin) --------

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        className="flex-1"
        contentContainerClassName="grow px-5 pb-6 pt-4"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View>
            <View className="mb-2 flex-row items-center gap-3">
              <View
                className="rounded-xl p-3"
                style={{ backgroundColor: dashboardColors.statMintSoft }}
              >
                <ClipboardList color={dashboardColors.statMintDeep} size={26} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-xl font-bold text-ink"
                  style={{ letterSpacing: -0.4 }}
                >
                  {t('assignments.currentAssignmentsTitle')}
                </Text>
                <Text className="mt-0.5 text-xs text-dashboard-subtitle">
                  {currentSite?.name ?? ''}
                  {reports !== null
                    ? ` Â· ${t('assignments.activeReportCount', {
                        count: scoped.length,
                        plural: scoped.length === 1 ? '' : 's',
                      })} Â· ${t('assignments.assignedTechnicianCount', {
                        count: technicianCount,
                        plural: technicianCount === 1 ? '' : 's',
                      })}`
                    : ''}
                </Text>
              </View>
            </View>

            <Text className="mb-3 text-[12px] leading-[1.7] text-dashboard-subtitle">
              {canAssign
                ? t('assignments.adminIntroCanAssign')
                : t('assignments.adminIntroViewOnly')}
            </Text>

            <View className="mb-3 flex-row gap-3">
              <View className="flex-1 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-3">
                <Text className="text-[10px] font-medium uppercase tracking-wide text-dashboard-subtitle">
                  {t('assignments.statsActive')}
                </Text>
                <Text
                  className="mt-1 text-xl font-bold"
                  style={{ color: dashboardColors.statMintDeep }}
                >
                  {scoped.length}
                </Text>
              </View>
              <View className="flex-1 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-3">
                <Text className="text-[10px] font-medium uppercase tracking-wide text-dashboard-subtitle">
                  {t('assignments.statsTechnicians')}
                </Text>
                <Text
                  className="mt-1 text-xl font-bold"
                  style={{ color: dashboardColors.statCitronDeep }}
                >
                  {technicianCount}
                </Text>
              </View>
            </View>

            <View className="mb-3">
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder={t('assignments.searchPlaceholder')}
              />
            </View>

            <View className="mb-3">
              <FilterTabs
                options={filterOptions}
                value={filter}
                onChange={setFilter}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <StateView variant="loading" title={t('assignments.loading')} />
          ) : (
            <StateView
              variant="empty"
              icon={Search}
              title={scoped.length === 0 ? t('assignments.nothingInQueue') : t('assignments.noMatches')}
              description={
                scoped.length === 0
                  ? t('assignments.nothingInQueueDescAdmin')
                  : t('assignments.noMatchesDesc')
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ReportCard
            t={t}
            report={item}
            siteName={siteName(item.siteId)}
            onPress={() => router.push(`/reports/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

function ReportCard({
  t,
  report,
  siteName,
  onPress,
}: {
  t: TranslateFn;
  report: Report;
  siteName: string;
  onPress: () => void;
}) {
  const urgency: Urgency = effectiveUrgency(report);
  const assignee =
    report.assignedTechnicianId == null
      ? t('assignments.unassigned')
      : t('assignments.assigned');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('assignments.openA11y', {
        description: report.description,
      })}
      className="rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4 active:opacity-80"
    >
      <View className="mb-1 flex-row items-center justify-between gap-2">
        <Text
          className="text-xs font-medium uppercase tracking-wide text-dashboard-subtitle"
          numberOfLines={1}
        >
          {humanize(report.category)}
        </Text>
        <StatusBadge status={report.status} />
      </View>
      <Text className="text-sm text-ink" numberOfLines={3}>
        {report.description}
      </Text>
      <View className="mt-3 flex-row items-center justify-between">
        <UrgencyChip level={urgency} />
        <Text className="text-xs text-dashboard-caption">#{report.id}</Text>
      </View>
      {/* Site / created / assignee â€” the remaining ReportTable columns
          from the web's `ReportTable.vue`. */}
      <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <Text className="text-[11px] text-dashboard-subtitle" numberOfLines={1}>
          {siteName}
        </Text>
        <Text className="text-[11px] text-dashboard-subtitle">
          {formatDate(report.createdAt)}
        </Text>
        <Text className="text-[11px] font-medium text-dashboard-subtitle">
          {assignee}
        </Text>
      </View>
      <View className={`mt-3 h-1 rounded-full ${toneBarClass(report)}`} />
    </Pressable>
  );
}

/**
 * Two-section rendering for the technician queue â€” the split UI spec item
 * 8.2 ("assigned section") + 8.3 ("claimable section"). Claimable items carry
 * a Claim action backed by `POST /api/reports/{id}/claim`; tapping the card
 * still opens the report detail.
 */
function TechnicianSections({
  t,
  assigned,
  available,
  onOpen,
  onClaim,
  claimingId,
  siteName,
}: {
  t: TranslateFn;
  assigned: Report[];
  available: Report[];
  onOpen: (id: number) => void;
  onClaim: (id: number) => void;
  claimingId: number | null;
  siteName: (id: number | null) => string;
}) {
  if (assigned.length === 0 && available.length === 0) {
    return (
      <StateView
        variant="empty"
        icon={Search}
        title={t('assignments.nothingInQueue')}
        description={t('assignments.nothingInQueueDescTechnician')}
      />
    );
  }
  return (
    <View className="mt-2">
      {assigned.length > 0 ? (
        <SectionHeader title={t('assignments.assignedToMe', { count: assigned.length })} tone="mint" />
      ) : null}
      {assigned.map((r) => (
        <View key={r.id} className="mb-3">
          <ReportCard t={t} report={r} siteName={siteName(r.siteId)} onPress={() => onOpen(r.id)} />
        </View>
      ))}
      {available.length > 0 ? (
        <SectionHeader title={t('assignments.availableToClaim', { count: available.length })} tone="citron" />
      ) : null}
      {available.map((r) => (
        <View key={r.id} className="mb-3">
          <ReportCard t={t} report={r} siteName={siteName(r.siteId)} onPress={() => onOpen(r.id)} />
          <Button
            variant="cta"
            className="mt-2 min-h-0 py-2"
            label={claimingId === r.id ? t('assignments.claiming') : t('assignments.claim')}
            loading={claimingId === r.id}
            disabled={claimingId !== null}
            onPress={() => onClaim(r.id)}
          />
        </View>
      ))}
    </View>
  );
}

/** Mini section header for the technician queue split â€” colored dot + title. */
function SectionHeader({ title, tone }: { title: string; tone: 'mint' | 'citron' }) {
  const bg = tone === 'mint' ? dashboardColors.statMintDeep : dashboardColors.statCitronDeep;
  return (
    <View className="mb-2 mt-3 flex-row items-center gap-2">
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: bg }} />
      <Text
        className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-subtitle"
        style={{ letterSpacing: 1.2 }}
      >
        {title}
      </Text>
    </View>
  );
}
