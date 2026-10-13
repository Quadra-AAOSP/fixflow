import { useFocusEffect, useRouter } from 'expo-router';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  FileText,
  Heart,
  Leaf,
  Plus,
  RefreshCw,
  Settings,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { PlantArt } from '@/components/dashboard/PlantArt';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { StatCard, type DashboardStatTone } from '@/components/ui/StatCard';
import { StateView } from '@/components/ui/StateView';
import { WeeklyChart } from '@/components/ui/WeeklyChart';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listReports } from '@/services/reports';
import { useCurrentSite } from '@/stores/site';
import type { Report, ReportStatus, Urgency } from '@/types';
import { formatDate } from '@/utils/format';
import {
  effectiveUrgency,
  groupLabels,
  isUrgent,
  matchesFilter,
  statusGroup,
  statusLabels,
  statusTone,
  summarize,
  weeklyChart,
  type ReportFilter,
} from '@/utils/maintenance';

const RECENT_REPORT_LIMIT = 3;
const RECENT_UPDATES_LIMIT = 4;

/** Maps the mobile's ReportFilter union onto the 4 dashboard stat cards. */
type StatConfig = {
  filter: ReportFilter;
  label: string;
  note: string;
  tone: DashboardStatTone;
  icon: LucideIcon;
};

const STATS: StatConfig[] = [
  {
    filter: 'open',
    label: 'Open reports',
    note: 'Open, routed, reopened, escalated',
    tone: 'coral',
    icon: FileText,
  },
  {
    filter: 'progress',
    label: 'In progress',
    note: 'Assigned and in progress',
    tone: 'mint',
    icon: Settings,
  },
  {
    filter: 'resolved',
    label: 'Resolved',
    note: 'Awaiting confirmation or confirmed',
    tone: 'citron',
    icon: CircleCheck,
  },
  {
    filter: 'urgent',
    label: 'Urgent',
    note: 'Active high or critical urgency',
    tone: 'coral-danger',
    icon: TriangleAlert,
  },
];

/**
 * Dashboard for non-technician accounts. Mirrors `HomeView.vue`:
 *   - Welcome banner (greeting + tagline + 3 value pills + plant art + CTA)
 *   - Preview label (site name + "YOUR COMMUNITY AT A GLANCE")
 *   - 2×2 stat grid (selected state drives the Recent Reports filter)
 *   - Maintenance Overview card with this/last week toggle and stacked chart
 *   - Recent Reports card (filtered by the active stat, with a clear-filter
 *     pill when a filter is set)
 *   - Recent Updates card (status-tinted avatars, "Report #ID · status" copy)
 *   - Quick Actions card (2×2)
 *   - Data Connection card (state, last sync, retry)
 *   - Floating "+ New report" button (bottom-right)
 */
export default function HomeScreen() {
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { site, sites } = useCurrentSite();

  const [reports, setReports] = useState<Report[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [activeStatus, setActiveStatus] = useState<ReportFilter>('all');
  const [period, setPeriod] = useState<0 | -1>(0);

  const load = useCallback(async () => {
    if (!site) return;
    setError(null);
    if (reports === null) setLoading(true);
    try {
      const result = await listReports({ siteId: site.id });
      setReports(result);
      setLastSynced(new Date());
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

  const summary = summarize(reports ?? []);
  const weekBuckets = weeklyChart(reports ?? [], period);
  const isChartEmpty = weekBuckets.every((bucket) =>
    bucket.values.every((value) => value === 0),
  );

  const filteredRecent = (reports ?? [])
    .filter((report) => matchesFilter(report, activeStatus))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, RECENT_REPORT_LIMIT);

  const updates = (reports ?? [])
    .slice()
    .sort((a, b) => {
      const ad = new Date(a.updatedAt ?? a.createdAt).getTime();
      const bd = new Date(b.updatedAt ?? b.createdAt).getTime();
      return bd - ad;
    })
    .slice(0, RECENT_UPDATES_LIMIT);

  const canFile =
    site !== null && user !== null && user.role !== 'technician';

  const fileDisabledReason = !site
    ? 'A site must be linked before reports can be filed.'
    : user?.role === 'technician'
      ? 'Technician accounts resolve reports rather than file them.'
      : null;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  function gotoFilter(filter: ReportFilter) {
    // Tapping the already-active card clears the filter — matches the web
    // toggle behavior in `HomeView.vue`.
    const next = activeStatus === filter ? 'all' : filter;
    setActiveStatus(next);
  }

  function clearFilter() {
    setActiveStatus('all');
  }

  function gotoReports(filter: ReportFilter) {
    router.push({
      pathname: '/reports',
      params: filter === 'all' ? {} : { filter },
    });
  }

  function gotoReport(id: number) {
    router.push(`/reports/${id}`);
  }

  function gotoNewReport() {
    router.push('/reports/new');
  }

  const filterLabel =
    activeStatus === 'all'
      ? null
      : activeStatus === 'urgent'
        ? 'Urgent'
        : groupLabels[activeStatus];

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-32 pt-4">
        <WelcomeBanner
          greeting={greeting}
          firstName={user?.firstName}
          ctaDisabled={!canFile}
          onPressCta={gotoNewReport}
        />

        <PreviewLabel siteName={site?.name ?? null} />

        {reports === null && loading ? (
          <View className="py-12">
            <ActivityIndicator size="large" color={palette.primary} />
          </View>
        ) : null}

        {error && reports === null ? (
          <StateView
            variant="error"
            title="Could not load reports"
            description={error}
            actionLabel="Retry"
            onAction={() => {
              void load();
            }}
            className="py-8"
          />
        ) : null}

        {reports !== null && site ? (
          <>
            <View className="mb-3 flex-row gap-2">
              {STATS.slice(0, 2).map((stat) => (
                <StatCard
                  key={stat.filter}
                  label={stat.label}
                  note={stat.note}
                  value={reportsLoadedValue(loading, summaryFor(summary, stat.filter))}
                  tone={stat.tone}
                  icon={stat.icon}
                  selected={activeStatus === stat.filter}
                  onPress={() => gotoFilter(stat.filter)}
                />
              ))}
            </View>
            <View className="mb-5 flex-row gap-2">
              {STATS.slice(2, 4).map((stat) => (
                <StatCard
                  key={stat.filter}
                  label={stat.label}
                  note={stat.note}
                  value={reportsLoadedValue(loading, summaryFor(summary, stat.filter))}
                  tone={stat.tone}
                  icon={stat.icon}
                  selected={activeStatus === stat.filter}
                  onPress={() => gotoFilter(stat.filter)}
                />
              ))}
            </View>

            <MaintenanceOverviewCard
              period={period}
              onChangePeriod={setPeriod}
              buckets={weekBuckets}
              isEmpty={isChartEmpty}
              loading={loading}
            />

            <RecentReportsCard
              filterLabel={filterLabel}
              onClearFilter={clearFilter}
              reports={filteredRecent}
              activeFilter={activeStatus}
              onPressAll={() => gotoReports(activeStatus)}
              onPressRow={gotoReport}
            />

            <RecentUpdatesCard
              reports={updates}
              onPressAll={() => gotoReports('all')}
              onPressRow={gotoReport}
            />

            <QuickActionsCard
              canCreate={canFile}
              onPressCreate={gotoNewReport}
              onPressBrowse={() => gotoReports('all')}
              onPressAssignments={() => router.push('/assignments')}
              onPressSites={() => router.push('/more/sites')}
            />

            <DataConnectionCard
              loading={loading && reports === null}
              error={reports === null ? error : null}
              lastSynced={lastSynced}
              onRetry={() => {
                void load();
              }}
            />
          </>
        ) : null}
      </ScrollView>

      {/* Floating create — bottom-right mint disc, matching `.floating-create`
          in the web dashboard stylesheet. */}
      {canFile ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New report"
          onPress={gotoNewReport}
          className="absolute bottom-6 right-5 h-[52px] w-[52px] items-center justify-center rounded-full bg-dashboard-fab-bg active:opacity-90"
          style={{
            shadowColor: dashboardColors.fabShadow,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Plus color={dashboardColors.fabText} size={26} strokeWidth={2.2} />
        </Pressable>
      ) : null}

      {fileDisabledReason ? (
        <Text className="absolute bottom-2 left-5 right-5 text-center text-[11px] text-dashboard-caption">
          {fileDisabledReason}
        </Text>
      ) : null}
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function WelcomeBanner({
  greeting,
  firstName,
  ctaDisabled,
  onPressCta,
}: {
  greeting: string;
  firstName: string | undefined;
  ctaDisabled: boolean;
  onPressCta: () => void;
}) {
  return (
    <View
      className="mb-3 flex-row items-center gap-3 rounded-2xl border bg-dashboard-banner-bg px-4 py-4"
      style={{ borderColor: dashboardColors.bannerBorder, minHeight: 132 }}
    >
      <View className="flex-1">
        <Text
          className="text-[24px] font-semibold leading-tight text-ink"
          style={{ letterSpacing: -0.6 }}
        >
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </Text>
        <Text className="mt-1 text-[14px] text-dashboard-banner-subtitle">
          Let&apos;s keep every space working beautifully.
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1">
          <ValuePill icon={Leaf} color={dashboardColors.statCoralDeep}>
            Safe spaces
          </ValuePill>
          <ValuePill icon={Heart} color={dashboardColors.statCoralDeep}>
            Happy people
          </ValuePill>
          <ValuePill icon={Users} color={dashboardColors.statMintDeep}>
            Stronger communities
          </ValuePill>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Report an issue"
          onPress={onPressCta}
          disabled={ctaDisabled}
          className={`mt-3 flex-row items-center gap-2 self-start rounded-[11px] border px-4 py-2.5 active:opacity-90 ${
            ctaDisabled ? 'opacity-50' : ''
          }`}
          style={{
            backgroundColor: dashboardColors.ctaBg,
            borderColor: dashboardColors.ctaBorder,
          }}
        >
          <View
            className="h-[22px] w-[22px] items-center justify-center rounded-full"
            style={{ backgroundColor: dashboardColors.ctaIconBg }}
          >
            <Plus color={dashboardColors.ctaIcon} size={15} strokeWidth={2.4} />
          </View>
          <Text
            className="text-[14px] font-semibold"
            style={{ color: dashboardColors.ctaText }}
          >
            Report an issue
          </Text>
        </Pressable>
      </View>
      <View className="absolute bottom-0 right-2">
        <PlantArt size={120} />
      </View>
    </View>
  );
}

function ValuePill({
  icon: Icon,
  color,
  children,
}: {
  icon: LucideIcon;
  color: string;
  children: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon color={color} size={14} strokeWidth={1.8} />
      <Text className="text-[10px] text-dashboard-banner-values">{children}</Text>
    </View>
  );
}

function PreviewLabel({ siteName }: { siteName: string | null }) {
  return (
    <View className="mb-3 mt-1 flex-row items-center justify-between px-1">
      <View className="flex-row items-center gap-1.5">
        <View
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dashboardColors.statCitronDeep }}
        />
        <Text className="text-[10px] text-dashboard-caption">
          {siteName ?? 'Your maintenance overview'}
        </Text>
      </View>
      <Text className="text-[8px] tracking-[1.4px] text-dashboard-caption">
        YOUR COMMUNITY AT A GLANCE
      </Text>
    </View>
  );
}

function MaintenanceOverviewCard({
  period,
  onChangePeriod,
  buckets,
  isEmpty,
  loading,
}: {
  period: 0 | -1;
  onChangePeriod: (next: 0 | -1) => void;
  buckets: ReturnType<typeof weeklyChart>;
  isEmpty: boolean;
  loading: boolean;
}) {
  return (
    <Card className="mb-4">
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.4 }}>
            Maintenance overview
          </Text>
          <Text className="mt-0.5 text-[11px] text-dashboard-subtitle">
            Reports created {period === 0 ? 'this week' : 'last week'}, grouped
            by current status
          </Text>
        </View>
        <PeriodToggle value={period} onChange={onChangePeriod} />
      </View>

      {loading && buckets.every((b) => b.values.every((v) => v === 0)) ? (
        <Text className="py-8 text-center text-[11px] text-dashboard-empty">
          Loading report data…
        </Text>
      ) : (
        <>
          <WeeklyChart buckets={buckets} />
          {isEmpty ? (
            <Text className="mt-2 text-center text-[10px] text-dashboard-caption">
              No reports were created during this week.
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

function PeriodToggle({
  value,
  onChange,
}: {
  value: 0 | -1;
  onChange: (next: 0 | -1) => void;
}) {
  return (
    <View className="flex-row rounded-md border border-dashboard-card-line bg-dashboard-card-bg p-0.5">
      {([0, -1] as const).map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option)}
            className={`rounded-[5px] px-2.5 py-1 ${active ? 'bg-dashboard-pill-bg' : ''}`}
          >
            <Text
              className={`text-[10px] font-semibold ${
                active ? 'text-dashboard-teal' : 'text-dashboard-subtitle'
              }`}
            >
              {option === 0 ? 'This week' : 'Last week'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RecentReportsCard({
  filterLabel,
  onClearFilter,
  reports,
  activeFilter,
  onPressAll,
  onPressRow,
}: {
  filterLabel: string | null;
  onClearFilter: () => void;
  reports: Report[];
  activeFilter: ReportFilter;
  onPressAll: () => void;
  onPressRow: (id: number) => void;
}) {
  return (
    <Card padded={false} className="mb-4">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.4 }}>
          Recent reports
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={onPressAll}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <Text className="text-[11px] font-medium text-dashboard-teal">
            View all
          </Text>
          <ArrowRight color={dashboardColors.teal} size={12} />
        </Pressable>
      </View>

      {filterLabel ? (
        <View className="flex-row items-center gap-3 px-4 pb-2">
          <Text className="text-[10px] text-dashboard-subtitle">
            {filterLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClearFilter}
            className="active:opacity-70"
          >
            <Text className="text-[10px] font-medium text-dashboard-teal underline">
              Clear filter
            </Text>
          </Pressable>
        </View>
      ) : null}

      {reports.length === 0 ? (
        <Text className="px-4 pb-4 text-center text-[11px] text-dashboard-empty">
          {activeFilter === 'all'
            ? 'No reports yet — file one to seed this list.'
            : 'No reports match this view.'}
        </Text>
      ) : (
        reports.map((report, index) => (
          <View key={report.id}>
            {index > 0 ? (
              <View className="mx-4 border-t border-dashboard-card-line" />
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => onPressRow(report.id)}
              className="flex-row items-center gap-3 px-4 py-3 active:opacity-80"
            >
              <StatusAvatar status={report.status} />
              <View className="flex-1">
                <Text
                  className="text-[12px] font-semibold text-ink"
                  numberOfLines={1}
                >
                  {report.description}
                </Text>
                <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
                  #{report.id} · {report.category}
                </Text>
              </View>
              <ChevronRight
                color={dashboardColors.subtitle}
                size={16}
                strokeWidth={1.6}
              />
            </Pressable>
          </View>
        ))
      )}
    </Card>
  );
}

function RecentUpdatesCard({
  reports,
  onPressAll,
  onPressRow,
}: {
  reports: Report[];
  onPressAll: () => void;
  onPressRow: (id: number) => void;
}) {
  return (
    <Card padded={false} className="mb-4">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.4 }}>
          Recent updates
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={onPressAll}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <Text className="text-[11px] font-medium text-dashboard-teal">
            View all
          </Text>
          <ArrowRight color={dashboardColors.teal} size={12} />
        </Pressable>
      </View>

      {reports.length === 0 ? (
        <Text className="px-4 pb-4 text-center text-[11px] text-dashboard-empty">
          No report updates yet.
        </Text>
      ) : (
        <View className="px-3 pb-3">
          {reports.map((report) => {
            const tone = statusTone(report.status);
            return (
              <Pressable
                key={report.id}
                accessibilityRole="link"
                onPress={() => onPressRow(report.id)}
                className="flex-row items-center gap-3 px-1 py-2.5 active:opacity-80"
              >
                <StatusAvatar status={report.status} small />
                <View className="flex-1">
                  <Text
                    className="text-[12px] font-semibold text-ink"
                    numberOfLines={1}
                  >
                    Report #{report.id}
                    <Text className="font-normal text-dashboard-subtitle">
                      {'  ·  '}
                      {statusLabels[report.status]}
                    </Text>
                  </Text>
                  <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                    {formatDate(report.updatedAt ?? report.createdAt, true)}
                  </Text>
                </View>
                <ChevronRight
                  color={dashboardColors.subtitle}
                  size={14}
                  strokeWidth={1.6}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </Card>
  );
}

function QuickActionsCard({
  canCreate,
  onPressCreate,
  onPressBrowse,
  onPressAssignments,
  onPressSites,
}: {
  canCreate: boolean;
  onPressCreate: () => void;
  onPressBrowse: () => void;
  onPressAssignments: () => void;
  onPressSites: () => void;
}) {
  return (
    <Card padded={false} className="mb-4">
      <View className="px-4 pb-2 pt-4">
        <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.4 }}>
          Quick actions
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2 px-3 pb-3">
        {canCreate ? (
          <ActionTile
            icon={Plus}
            title="Create report"
            subtitle="Log a new issue"
            tone="mint"
            onPress={onPressCreate}
          />
        ) : null}
        <ActionTile
          icon={FileText}
          title="Browse reports"
          subtitle="Search and filter"
          tone="neutral"
          onPress={onPressBrowse}
        />
        <ActionTile
          icon={Users}
          title="Assignments"
          subtitle="Current technician workload"
          tone="neutral"
          onPress={onPressAssignments}
        />
        <ActionTile
          icon={Leaf}
          title="Your sites"
          subtitle="View site information"
          tone="neutral"
          onPress={onPressSites}
        />
      </View>
    </Card>
  );
}

function ActionTile({
  icon: Icon,
  title,
  subtitle,
  tone,
  onPress,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  /** `mint` is the create-report variant on the web; everything else is
      neutral grey on cream. */
  tone: 'mint' | 'neutral';
  onPress: () => void;
}) {
  const bg =
    tone === 'mint' ? 'bg-dashboard-pill-bg' : 'bg-dashboard-card-line/40';
  const iconColor =
    tone === 'mint' ? dashboardColors.ctaIcon : dashboardColors.teal;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-1 min-w-[48%] flex-row items-center gap-2.5 rounded-lg border border-dashboard-card-line p-3 active:opacity-80"
      style={{ backgroundColor: tone === 'mint' ? dashboardColors.tealSoft : dashboardColors.cardBg }}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: bg }}
      >
        <Icon color={iconColor} size={20} strokeWidth={1.7} />
      </View>
      <View className="flex-1">
        <Text
          className="text-[12px] font-semibold text-ink"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          className="mt-0.5 text-[9px] text-dashboard-caption"
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function DataConnectionCard({
  loading,
  error,
  lastSynced,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  lastSynced: Date | null;
  onRetry: () => void;
}) {
  const stateLabel = loading
    ? 'Checking connection…'
    : error
      ? 'Data request failed'
      : lastSynced
        ? 'Report data connected'
        : 'No site data available';

  return (
    <Card padded={false} className="mb-4">
      <View className="flex-row items-center justify-between px-4 pb-1 pt-4">
        <View className="flex-row items-center gap-2">
          <Activity color={dashboardColors.teal} size={18} strokeWidth={1.8} />
          <Text
            className="text-[14px] font-semibold text-ink"
            style={{ letterSpacing: -0.3 }}
          >
            Data connection
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check connection"
          disabled={loading}
          onPress={onRetry}
          className={`h-7 w-7 items-center justify-center rounded-md active:opacity-70 ${
            loading ? 'opacity-40' : ''
          }`}
        >
          <RefreshCw
            color={dashboardColors.subtitle}
            size={14}
            strokeWidth={1.8}
          />
        </Pressable>
      </View>
      <View className="px-4 pb-4">
        <Text className="text-[12px] text-dashboard-subtitle">{stateLabel}</Text>
        <Text className="mt-1 text-[10px] leading-[1.7] text-dashboard-caption">
          {lastSynced
            ? `Last successful refresh: ${formatDate(lastSynced.toISOString(), true)}`
            : 'Connection status is based on your latest data request.'}
        </Text>
        {error ? (
          <View className="mt-2 rounded-md bg-dashboard-error-bg px-3 py-2">
            <Text className="text-[10px] leading-[1.7] text-dashboard-error-text">
              Reports could not be loaded: {error}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

function StatusAvatar({
  status,
  small = false,
}: {
  status: ReportStatus;
  small?: boolean;
}) {
  const tone = statusTone(status);
  const group = statusGroup(status);
  const toneToClass: Record<typeof group, { disc: string; iconColor: string; Icon: LucideIcon }> = {
    open: {
      disc: 'bg-dashboard-stat-coral-soft',
      iconColor: dashboardColors.statCoralDeep,
      Icon: FileText,
    },
    progress: {
      disc: 'bg-dashboard-stat-mint-soft',
      iconColor: dashboardColors.statMintDeep,
      Icon: Settings,
    },
    resolved: {
      disc: 'bg-dashboard-stat-citron-soft',
      iconColor: dashboardColors.statCitronDeep,
      Icon: CheckCircle2,
    },
  };
  const cfg = toneToClass[group];
  const dim = small ? 'h-7 w-7' : 'h-9 w-9';
  const iconSize = small ? 14 : 16;
  return (
    <View
      className={`${dim} items-center justify-center rounded-full ${cfg.disc}`}
    >
      <cfg.Icon color={cfg.iconColor} size={iconSize} strokeWidth={1.7} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function summaryFor(
  summary: ReturnType<typeof summarize>,
  filter: ReportFilter,
): number {
  switch (filter) {
    case 'open':
      return summary.open;
    case 'progress':
      return summary.progress;
    case 'resolved':
      return summary.resolved;
    case 'urgent':
      return summary.urgent;
    case 'all':
    default:
      return summary.open + summary.progress + summary.resolved;
  }
}

/** Show "—" while the very first load is in flight, matching the web. */
function reportsLoadedValue(loading: boolean, value: number): number | string {
  return loading && value === 0 ? '—' : value;
}
