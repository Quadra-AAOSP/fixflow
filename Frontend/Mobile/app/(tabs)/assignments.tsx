import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native';
import { ClipboardList, Search, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { FilterTabs } from '@/components/ui/FilterTabs';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listReports } from '@/services/reports';
import { useCurrentSite } from '@/stores/site';
import type { Report, Urgency } from '@/types';
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
  const { site, sites, loading: siteLoading, error: siteError, refresh: refreshSite } = useCurrentSite();

  const [reports, setReports] = useState<Report[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ReportFilter>('all');

  const load = useCallback(async () => {
    if (!site || !user) return;
    setError(null);
    if (reports === null) setLoading(true);
    try {
      const result = await listReports({ siteId: site.id });
      setReports(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('assignments.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
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

  const isTechnician = user?.role === 'technician';
  const canAssign = user?.capabilities.assignTechnician ?? false;

  // Scope by role: technicians see ONLY their own queue items; staff/admin see
  // every site report that's in an unresolved queue state. Then split into
  // "Assigned to me" vs "Available to claim" (unassigned queue items) for the
  // technician UI, so they have a clean two-section view.
  const assignedToMe = useMemo(() => {
    if (!reports || !isTechnician) return [];
    return reports.filter(
      (r) => r.policy.inAssignmentQueue && r.assignedTechnicianId === user?.id,
    );
  }, [reports, isTechnician, user?.id]);

  const availableToClaim = useMemo(() => {
    if (!reports || !isTechnician) return [];
    return reports.filter(
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
    // Staff/admin see everything unresolved — sorted by assignee.
    return base.sort(
      (a, b) => (a.assignedTechnicianId ?? 0) - (b.assignedTechnicianId ?? 0),
    );
  }, [reports, isTechnician, user?.id]);

  const siteName = useCallback(
    (id: number | null) => (id !== null && site && id === site.id ? site.name : `Site #${id ?? ''}`),
    [site],
  );

  const filtered = useMemo(
    () => searchReports(scoped, query, siteName, filter),
    [scoped, query, siteName, filter],
  );

  // Unique assignees among the scoped (unresolved, assigned) set — mirrors
  // the web, which counts over `assignments`, not the raw report list.
  const technicianCount = useMemo(() => {
    const seen = new Set<number>();
    for (const report of scoped) {
      if (report.assignedTechnicianId !== null) seen.add(report.assignedTechnicianId);
    }
    return seen.size;
  }, [scoped]);

  const filterOptions = REPORT_FILTERS.map((option) => ({
    ...option,
    count: scoped.filter((report) => matchesFilter(report, option.value)).length,
  }));

  if (!site) {
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
    // at a glance — "Assigned to me" and "Available to claim".
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
                {site.name}
                {reports !== null
                  ? ` · ${t('assignments.assignedCount', { count: assignedToMe.length })}${
                      availableToClaim.length > 0
                        ? ` · ${t('assignments.claimableCount', { count: availableToClaim.length })}`
                        : ''
                    }`
                  : ''}
              </Text>
            </View>
          </View>

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
              assigned={assignedToMe}
              available={availableToClaim}
              onOpen={(id) => router.push(`/reports/${id}`)}
              siteName={(id) => siteName(id)}
            />
          )}
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
                  {site.name}
                  {reports !== null
                    ? ` · ${t('assignments.activeReportCount', {
                        count: scoped.length,
                        plural: scoped.length === 1 ? '' : 's',
                      })} · ${t('assignments.assignedTechnicianCount', {
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
      : t('assignments.technicianId', { id: report.assignedTechnicianId });
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
      {/* Site / created / assignee — the remaining ReportTable columns
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
 * Two-section rendering for the technician queue — the split UI spec item
 * 8.2 ("assigned section") + 8.3 ("claimable section"). "Available to claim"
 * items show an inline pill; tapping navigates to the report detail which
 * will still show the "unassigned" card (backend `POST /claim` doesn't exist
 * yet, so claiming is read-only for now).
 */
function TechnicianSections({
  t,
  assigned,
  available,
  onOpen,
  siteName,
}: {
  t: TranslateFn;
  assigned: Report[];
  available: Report[];
  onOpen: (id: number) => void;
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
        </View>
      ))}
    </View>
  );
}

/** Mini section header for the technician queue split — colored dot + title. */
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
