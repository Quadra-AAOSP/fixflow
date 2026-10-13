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
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listReports } from '@/services/reports';
import { useCurrentSite } from '@/stores/site';
import type { Report, Urgency } from '@/types';
import {
  REPORT_FILTERS,
  ReportFilter,
  effectiveUrgency,
  matchesFilter,
  searchReports,
  statusGroup,
} from '@/utils/maintenance';

const TONE_BAR: Record<string, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  lime: 'bg-lime',
};

function toneBarClass(report: Report): string {
  return TONE_BAR[statusGroup(report.status)] ?? 'bg-border';
}

/**
 * "Assignments" tab. Mirrors `AssignmentsView.vue` on the web build.
 *
 *   - `technician`     → only unresolved reports assigned to them
 *   - `staff | admin | super_admin` → every unresolved report at this site
 *
 * The page is filtered and searchable. A small header summarises the active
 * count plus the technician headcount at the site for planning.
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

  // Scope by role: technicians see only their own queue, staff/admin see
  // every unresolved report at the site.
  const scoped = useMemo(() => {
    if (!reports) return [];
    const unresolved = reports.filter(
      (report) => statusGroup(report.status) !== 'resolved',
    );
    if (isTechnician) {
      return unresolved.filter(
        (report) => report.assignedTechnicianId === user?.id,
      );
    }
    return unresolved;
  }, [reports, isTechnician, user?.id]);

  // The search helper expects a (id) → name lookup; for now we just hand it a
  // site-name accessor and accept "—" for foreign sites.
  const siteName = useCallback(
    (id: number | null) => (id !== null && site && id === site.id ? site.name : `Site #${id ?? ''}`),
    [site],
  );

  const filtered = useMemo(
    () => searchReports(scoped, query, siteName, filter),
    [scoped, query, siteName, filter],
  );

  const technicianCount = useMemo(() => {
    if (!reports) return 0;
    const seen = new Set<number>();
    for (const report of reports) {
      if (report.assignedTechnicianId !== null) seen.add(report.assignedTechnicianId);
    }
    return seen.size;
  }, [reports]);

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
      <View className="mb-2 flex-row items-center gap-3">
        <View className="rounded-xl bg-primary/15 p-3">
          <ClipboardList color={palette.primary} size={26} />
        </View>
        <View className="flex-1">
          <Text className="text-xl font-bold text-ink">
            {isTechnician ? 'My assignments' : 'Assignments'}
          </Text>
          <SiteSwitcher />
        </View>
      </View>

      {sites.length > 1 ? (
        <Text className="mb-2 text-xs uppercase tracking-wide text-muted">
          {site.name}
        </Text>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-2"
      >
        <View className="mb-3 flex-row gap-3">
          <View className="flex-1 rounded-xl border border-border bg-card p-3">
            <Text className="text-xs font-medium uppercase tracking-wide text-muted">
              Active
            </Text>
            <Text className="mt-1 text-xl font-bold text-primary">
              {scoped.length}
            </Text>
          </View>
          {!isTechnician ? (
            <View className="flex-1 rounded-xl border border-border bg-card p-3">
              <Text className="text-xs font-medium uppercase tracking-wide text-muted">
                Technicians
              </Text>
              <Text className="mt-1 text-xl font-bold text-ink">
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
            onPress={() => router.push(`/reports/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}

function ReportCard({
  report,
  onPress,
}: {
  report: Report;
  onPress: () => void;
}) {
  const urgency: Urgency = effectiveUrgency(report);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="rounded-xl border border-border bg-card p-4 active:opacity-80"
    >
      <View className="mb-1 flex-row items-center justify-between gap-2">
        <Text
          className="text-xs font-medium uppercase tracking-wide text-muted"
          numberOfLines={1}
        >
          {report.category}
        </Text>
        <StatusBadge status={report.status} />
      </View>
      <Text className="text-sm text-ink" numberOfLines={3}>
        {report.description}
      </Text>
      <View className="mt-3 flex-row items-center justify-between">
        <UrgencyChip level={urgency} />
        <Text className="text-xs text-muted">#{report.id}</Text>
      </View>
      <View className={`mt-3 h-1 rounded-full ${toneBarClass(report)}`} />
    </Pressable>
  );
}
