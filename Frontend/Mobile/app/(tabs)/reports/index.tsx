import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { ClipboardList, House, Search } from 'lucide-react-native';

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
  ReportFilter as FilterValue,
  effectiveUrgency,
  matchesFilter,
  searchReports,
} from '@/utils/maintenance';

const FILTER_VALUES = REPORT_FILTERS.map((f) => f.value);

/**
 * Reports list. Mirrors `ReportsView.vue`: site-scoped list, status filter
 * row, free-text search (the dashboard's stat cards deep-link here with a
 * `?filter=` query).
 */
export default function ReportsScreen() {
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const {
    site,
    sites,
    loading: siteLoading,
    error: siteError,
    refresh: refreshSite,
  } = useCurrentSite();

  const params = useLocalSearchParams<{ filter?: string; q?: string }>();
  const initialFilter: FilterValue = FILTER_VALUES.includes(
    params.filter as FilterValue,
  )
    ? (params.filter as FilterValue)
    : 'all';

  const [reports, setReports] = useState<Report[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(params.q ?? '');
  const [filter, setFilter] = useState<FilterValue>(initialFilter);

  const load = useCallback(async () => {
    if (!site) return;
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
  }, [site?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const siteName = useCallback(
    (id: number | null) =>
      id !== null && site && id === site.id ? site.name : `Site #${id ?? ''}`,
    [site],
  );

  const filtered = useMemo(
    () => searchReports(reports ?? [], query, siteName, filter),
    [reports, query, siteName, filter],
  );

  const filterOptions = useMemo(
    () =>
      REPORT_FILTERS.map((option) => ({
        ...option,
        count: (reports ?? []).filter((report) =>
          matchesFilter(report, option.value),
        ).length,
      })),
    [reports],
  );

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
          icon={House}
          title="No site linked"
          description="Your account is not assigned to a site yet, so there are no reports to show."
        />
      </Screen>
    );
  }

  if (error && reports === null) {
    return (
      <Screen>
        <StateView
          variant="error"
          title="Could not load reports"
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
          <Text className="text-xl font-bold text-ink">Reports</Text>
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
        <View className="mb-3">
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder="Search reports…"
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
            <StateView variant="loading" title="Loading reports…" />
          ) : (
            <StateView
              variant="empty"
              icon={reports && reports.length === 0 ? ClipboardList : Search}
              title={
                reports && reports.length === 0
                  ? 'No reports yet'
                  : 'No matches'
              }
              description={
                reports && reports.length === 0
                  ? 'Tap "New report" on Home to file one.'
                  : 'Try a different filter or search term.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <ReportCard
            report={item}
            isCreator={user != null && item.createdByUserId === user.id}
            onPress={() => router.push(`/reports/${item.id}`)}
          />
        )}
      />
    </Screen>
  );
}

function ReportCard({
  report,
  isCreator,
  onPress,
}: {
  report: Report;
  isCreator: boolean;
  onPress: () => void;
}) {
  const visibleUrgency: Urgency =
    report.finalUrgency ?? report.aiUrgency ?? report.reporterUrgency;

  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl border border-border bg-card p-4 active:opacity-80"
      accessibilityRole="button"
    >
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-xs font-medium uppercase tracking-wide text-muted">
          {report.category}
        </Text>
        <StatusBadge status={report.status} />
      </View>
      <Text className="mb-3 text-sm text-ink" numberOfLines={3}>
        {report.description}
      </Text>
      <View className="flex-row items-center justify-between">
        <UrgencyChip level={visibleUrgency} />
        <Text className="text-xs text-muted">#{report.id}</Text>
      </View>
      {isCreator && report.address ? (
        <Text className="mt-2 text-xs text-muted">{report.address}</Text>
      ) : null}
    </Pressable>
  );
}
