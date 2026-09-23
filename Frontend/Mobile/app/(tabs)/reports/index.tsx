import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { ClipboardList } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listReports } from '@/services/reports';
import type { Report, Urgency } from '@/types';
import { useCurrentSite } from '@/stores/site';

export default function ReportsScreen() {
  const palette = themeColors();
  const { user } = useAuth();
  const { site, loading: siteLoading } = useCurrentSite();

  const [reports, setReports] = useState<Report[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    // We intentionally re-key on the site id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id]);

  // Refresh when the tab comes into focus (e.g. after returning from
  // `/reports/new`) so the user always sees the latest data.
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

  if (!site && siteLoading) {
    return (
      <Screen className="items-center justify-center">
        <Text className="text-sm text-muted">Loading site…</Text>
      </Screen>
    );
  }

  if (error && !reports) {
    return (
      <Screen className="items-center justify-center px-6">
        <Text className="text-sm text-tone-danger">{error}</Text>
      </Screen>
    );
  }

  return (
    <Screen className="px-5 pt-4">
      <Text className="mb-4 text-2xl font-bold text-ink">Your reports</Text>
      <FlatList
        data={reports ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="pb-6"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          <View className="items-center py-16">
            <ClipboardList color={palette.muted} size={40} />
            <Text className="mt-3 text-center text-sm text-muted">
              {loading ? 'Loading…' : 'No reports yet. Tap "New report" on Home to file one.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ReportCard
            report={item}
            isCreator={user != null && item.createdByUserId === user.id}
          />
        )}
      />
    </Screen>
  );
}

function ReportCard({
  report,
  isCreator,
}: {
  report: Report;
  isCreator: boolean;
}) {
  // Show final → ai → reporter in that order. `final_urgency` is set when
  // staff/admin override; otherwise the AI label (when present) wins over
  // the reporter's pick to surface the platform's classification.
  const visibleUrgency: Urgency =
    report.finalUrgency ?? report.aiUrgency ?? report.reporterUrgency;

  return (
    <View className="rounded-xl border border-border bg-card p-4">
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
        <Text className="text-xs text-muted">
          {new Date(report.createdAt).toLocaleString()}
        </Text>
      </View>
      {/* `address` and `reporterReason` are server-masked for peer
          reporters and non-assigned technicians. We only render them when
          the API actually delivered them, so masked `null`s never surface
          a placeholder row that leaks their existence. */}
      {isCreator && report.address ? (
        <Text className="mt-2 text-xs text-muted">{report.address}</Text>
      ) : null}
    </View>
  );
}