import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ClipboardList, Search, Wrench } from 'lucide-react-native';

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
 *   - Card heading with site name, active count, and technician headcount
 *   - "Open a report to assign or reassign a technician" / "View the current
 *     assignments for your site" dialog intro
 *   - Search + status filter
 *   - List of report cards with a status-tinted bottom bar
 *
 *   - `technician`     → only unresolved reports assigned to them
 *   - `staff | admin | super_admin` → every unresolved report at this site
 */
export default function AssignmentsScreen() {
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
        err instanceof ApiError ? err.message : 'Could not load reports.',
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

  // Scope by role: only reports with an assignee count as assignments —
  // technicians see their own queue, staff/admin see every assigned
  // unresolved report at the site. Sorted by assignee, like the web's
  // `assignments` computed in `AssignmentsView.vue`.
  const scoped = useMemo(() => {
    if (!reports) return [];
    return reports
      .filter(
        (report) =>
          report.policy.inAssignmentQueue,
      )
      .sort(
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
          <StateView variant="loading" title="Loading site…" />
        </Screen>
      );
    }
    if (siteError) {
      return (
        <Screen>
          <StateView
            variant="error"
            title="Could not load site"
            description={siteError.message}
            actionLabel="Retry"
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
          title="No site linked"
          description="Your account is not assigned to a site yet, so there are no assignments to show."
        />
      </Screen>
    );
  }

  if (error && reports === null) {
    return (
      <Screen>
        <StateView
          variant="error"
          title="Could not load assignments"
          description={error}
          actionLabel="Retry"
          onAction={() => {
            void load();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen className="px-5 pt-4">
      {/* Card heading — mirrors the web's `.card-heading` block in
          `AssignmentsView.vue` with the title, site + count + technician
          count summary line, and the dialog intro underneath. */}
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
            {isTechnician ? 'My assignments' : 'Current assignments'}
          </Text>
          <Text className="mt-0.5 text-xs text-dashboard-subtitle">
            {site.name}
            {reports !== null
              ? ` · ${scoped.length} active report${
                  scoped.length === 1 ? '' : 's'
                }${!isTechnician ? ` · ${technicianCount} assigned technician${
                  technicianCount === 1 ? '' : 's'
                }` : ''}`
              : ''}
          </Text>
        </View>
      </View>

      <Text className="mb-3 text-[12px] leading-[1.7] text-dashboard-subtitle">
        {canAssign
          ? 'Open a report to assign or reassign a technician.'
          : 'View the current assignments for your site.'}
      </Text>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-2"
      >
        <View className="mb-3 flex-row gap-3">
          <View className="flex-1 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-3">
            <Text className="text-[10px] font-medium uppercase tracking-wide text-dashboard-subtitle">
              Active
            </Text>
            <Text
              className="mt-1 text-xl font-bold"
              style={{ color: dashboardColors.statMintDeep }}
            >
              {scoped.length}
            </Text>
          </View>
          {!isTechnician ? (
            <View className="flex-1 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-3">
              <Text className="text-[10px] font-medium uppercase tracking-wide text-dashboard-subtitle">
                Technicians
              </Text>
              <Text
                className="mt-1 text-xl font-bold"
                style={{ color: dashboardColors.statCitronDeep }}
              >
                {technicianCount}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mb-3">
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={
              isTechnician ? 'Search your work…' : 'Search assignments…'
            }
          />
        </View>

        <View className="mb-3">
          <FilterTabs
            options={filterOptions}
            value={filter}
            onChange={setFilter}
          />
        </View>
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="grow pb-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          loading ? (
            <StateView variant="loading" title="Loading assignments…" />
          ) : (
            <StateView
              variant="empty"
              icon={Search}
              title={
                scoped.length === 0
                  ? isTechnician
                    ? 'No work assigned to you'
                    : 'Nothing in the queue'
                  : 'No matches'
              }
              description={
                scoped.length === 0
                  ? 'Reports assigned to you will show up here once a manager routes them.'
                  : 'Try a different filter or search term.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ReportCard
            report={item}
            siteName={siteName(item.siteId)}
            onPress={() => router.push(`/reports/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}

function ReportCard({
  report,
  siteName,
  onPress,
}: {
  report: Report;
  siteName: string;
  onPress: () => void;
}) {
  const urgency: Urgency = effectiveUrgency(report);
  const assignee =
    report.assignedTechnicianId == null
      ? 'Unassigned'
      : `Technician #${report.assignedTechnicianId}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
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
