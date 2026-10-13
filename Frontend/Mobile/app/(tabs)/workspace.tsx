import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useCallback, useState } from 'react';
import {
  Bell,
  ClipboardList,
  Wrench,
} from 'lucide-react-native';

import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TradeProfile } from '@/components/technician/TradeProfile';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listReports } from '@/services/reports';
import { useCurrentSite } from '@/stores/site';
import type { Report } from '@/types';
import { statusGroup } from '@/utils/maintenance';

/**
 * Landing page for `technician` accounts. Mirrors `TechnicianView.vue` on the
 * web build — welcome banner, the `TradeProfile` form, two info cards about
 * availability and contracts, and a peek at currently assigned work.
 *
 * Reporting (filing new issues) is a tenant-side action; technicians don't
 * file, they resolve. Hence the absence of a "New report" FAB.
 */
export default function WorkspaceScreen() {
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { site, sites } = useCurrentSite();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!site || !user) return;
    setError(null);
    try {
      const result = await listReports({ siteId: site.id });
      setReports(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not load reports.',
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const myAssignments = (reports ?? []).filter(
    (report) =>
      report.assignedTechnicianId === user?.id &&
      statusGroup(report.status) !== 'resolved',
  );

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <View className="mb-5 flex-row items-center gap-3">
          <View className="rounded-xl bg-accent/20 p-3">
            <Wrench color={palette.accentForeground} size={28} />
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-ink">
              Welcome{user ? `, ${user.firstName}` : ''}
            </Text>
            <SiteSwitcher />
          </View>
        </View>

        {sites.length > 1 ? (
          <Text className="mb-3 text-xs uppercase tracking-wide text-muted">
            Showing {site?.name ?? '—'}
          </Text>
        ) : null}

        <Card className="mb-6">
          <Text className="text-sm font-medium text-muted">Hello</Text>
          <Text className="mt-1 text-base font-semibold text-ink">
            {user ? `${user.firstName} ${user.lastName}` : ''}
          </Text>
          <Text className="mt-0.5 text-xs text-muted">
            {user?.email ?? ''}
          </Text>
          <Text className="mt-3 text-sm leading-5 text-ink">
            Technicians resolve work, not file it. Use the Trade profile to
            publish your specialties, then track open assignments on the
            Assignments tab.
          </Text>
        </Card>

        <Text className="mb-2 text-base font-semibold text-ink">
          Trade profile
        </Text>
        <TradeProfile />

        <Text className="mb-2 text-base font-semibold text-ink">
          Available actions
        </Text>
        <Card padded={false} className="mb-6">
          <ListRow
            title="My assignments"
            subtitle={`${myAssignments.length} open ${
              myAssignments.length === 1 ? 'report' : 'reports'
            }.`}
            icon={ClipboardList}
            className="px-4 py-3"
            onPress={() => router.push('/assignments')}
          />
          <View className="mx-4 border-t border-border" />
          <ListRow
            title="Site contracts"
            subtitle="Submit or review a contract application."
            icon={Bell}
            className="px-4 py-3"
            onPress={() => router.push('/more/contracts')}
          />
        </Card>

        <Text className="mb-2 text-base font-semibold text-ink">
          Assigned work
        </Text>
        {reports === null ? (
          <View className="py-8">
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : error ? (
          <StateView
            variant="error"
            title="Could not load assignments"
            description={error}
            actionLabel="Retry"
            onAction={() => {
              void load();
            }}
            className="py-6"
          />
        ) : myAssignments.length === 0 ? (
          <Card className="mb-6">
            <Text className="text-sm text-muted">
              You have no open assignments right now. New work assigned to you
              will appear here and on the Assignments tab.
            </Text>
          </Card>
        ) : (
          <View className="mb-6">
            {myAssignments.slice(0, 3).map((report) => (
              <Pressable
                key={report.id}
                onPress={() => router.push(`/reports/${report.id}`)}
                accessibilityRole="button"
                className="mb-2 rounded-xl border border-border bg-card p-3 active:opacity-80"
              >
                <View className="mb-1 flex-row items-center justify-between">
                  <Text
                    className="text-xs font-medium uppercase tracking-wide text-muted"
                    numberOfLines={1}
                  >
                    {report.category}
                  </Text>
                  <StatusBadge status={report.status} />
                </View>
                <Text className="text-sm text-ink" numberOfLines={2}>
                  {report.description}
                </Text>
              </Pressable>
            ))}
            {myAssignments.length > 3 ? (
              <Pressable
                onPress={() => router.push('/assignments')}
                accessibilityRole="button"
                className="rounded-lg border border-border bg-card px-3 py-2 active:opacity-70"
              >
                <Text className="text-center text-sm font-medium text-primary">
                  See {myAssignments.length - 3} more
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
