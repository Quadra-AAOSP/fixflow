import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { ClipboardList, House } from 'lucide-react-native';

import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
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
  const router = useRouter();
  const { user } = useAuth();
  const {
    site,
    sites,
    loading: siteLoading,
    error: siteError,
    refresh: refreshSite,
  } = useCurrentSite();

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
    // Intentionally re-key on the site id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id]);

  // Refresh on focus so returning from `new` or `[id]` shows current data.
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

  if (error && !reports) {
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
      {/* Multi-site callers (super_admin) need to know which site this list
          is scoped to, since the switcher lives on Home. */}
      {sites.length > 1 ? (
        <Text className="mb-3 text-xs uppercase tracking-wide text-muted">
          {site.name}
        </Text>
      ) : null}
      <FlatList
        data={reports ?? []}
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
              icon={ClipboardList}
              title="No reports yet"
              description={'Tap "New report" on Home to file one.'}
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
  // final → ai → reporter. `finalUrgency` is set when staff/admin override;
  // otherwise the AI label (when present) wins over the reporter's pick so
  // the platform's classification is what surfaces at a glance.
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
        <Text className="text-xs text-muted">
          {new Date(report.createdAt).toLocaleString()}
        </Text>
      </View>
      {/* `address` and `reporterReason` are server-masked for peer reporters
          and non-assigned technicians. Render only when the API actually
          delivered them, so masked nulls never leak a placeholder row. */}
      {isCreator && report.address ? (
        <Text className="mt-2 text-xs text-muted">{report.address}</Text>
      ) : null}
    </Pressable>
  );
}