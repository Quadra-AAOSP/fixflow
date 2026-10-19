import { useFocusEffect, useRouter } from 'expo-router';
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  FileText,
  Heart,
  Hourglass,
  Leaf,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { PlantArt } from '@/components/dashboard/PlantArt';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { StatCard, type DashboardStatTone } from '@/components/ui/StatCard';
import { StateView } from '@/components/ui/StateView';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { WeeklyChart } from '@/components/ui/WeeklyChart';
import { dashboardColors, themeColors } from '@/constants/theme';
import {
  canManageSubsites,
  canProvision,
} from '@/constants/access';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listReports } from '@/services/reports';
import { useCurrentSite } from '@/stores/site';
import type { Report, ReportStatus } from '@/types';
import { humanize, relativeTime } from '@/utils/format';
import {
  effectiveUrgency,
  groupLabels,
  isUrgent,
  matchesFilter,
  statusGroup,
  statusLabels,
  summarize,
  weeklyChart,
  type ReportFilter,
} from '@/utils/maintenance';

const RECENT_REPORT_LIMIT = 3;
const RECENT_UPDATES_LIMIT = 4;
const CATEGORY_LIMIT = 4;

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
 * One "needs attention" bucket. A report can appear in several buckets (an
 * urgent report nobody has picked up is both), which is why the card's header
 * counts distinct reports rather than summing the buckets.
 */
type AttentionDef = {
  key: string;
  label: string;
  hint: string;
  predicate: (report: Report) => boolean;
  /** Report-list filter the row deep-links to. */
  filter: ReportFilter;
  icon: LucideIcon;
  tone: 'coral' | 'mint' | 'citron';
};

type AttentionItem = Omit<AttentionDef, 'predicate'> & { count: number };

const ATTENTION_DEFS: AttentionDef[] = [
  {
    key: 'urgent',
    label: 'Urgent reports',
    hint: 'High or critical urgency, still active',
    predicate: isUrgent,
    filter: 'urgent',
    icon: TriangleAlert,
    tone: 'coral',
  },
  {
    key: 'escalated',
    label: 'Escalated',
    hint: 'Past the service window the site expects',
    predicate: (report) => report.status === 'escalated',
    filter: 'open',
    icon: Activity,
    tone: 'coral',
  },
  {
    key: 'unassigned',
    label: 'Waiting for a technician',
    hint: 'Nobody has picked these up yet',
    predicate: isUnassigned,
    filter: 'open',
    icon: ClipboardList,
    tone: 'mint',
  },
  {
    key: 'awaiting',
    label: 'Awaiting confirmation',
    hint: 'Resolved and waiting on the reporter',
    predicate: (report) => report.status === 'resolved_pending_confirmation',
    filter: 'resolved',
    icon: CircleCheck,
    tone: 'citron',
  },
];

const ATTENTION_LABELS: Record<'coral' | 'mint' | 'citron', {
  disc: string;
  ink: string;
}> = {
  coral: {
    disc: 'bg-dashboard-stat-coral-soft',
    ink: 'text-dashboard-stat-coral-deep',
  },
  mint: {
    disc: 'bg-dashboard-stat-mint-soft',
    ink: 'text-dashboard-stat-mint-deep',
  },
  citron: {
    disc: 'bg-dashboard-stat-citron-soft',
    ink: 'text-dashboard-stat-citron-deep',
  },
};

/**
 * Dashboard for non-technician accounts. Mirrors `HomeView.vue` and then
 * adds the operational blocks a phone needs to answer "what should I do
 * next?" without opening the Reports tab:
 *   - Welcome banner (greeting + tagline + 3 value pills + plant art + CTA)
 *   - Site row (interactive site switcher + sync freshness + refresh)
 *   - Needs attention card (urgent / escalated / unassigned / awaiting
 *     confirmation, each deep-linking into the matching report list)
 *   - 2×2 stat grid (selected state drives the Recent Reports filter)
 *   - Maintenance Overview card with this/last week toggle, week total,
 *     week-over-week delta, and stacked chart
 *   - Reports by category card (top categories, tap to search that category)
 *   - Recent Reports card (filtered by the active stat, with a clear-filter
 *     pill when a filter is set, urgency + age per row)
 *   - Recent Updates card (status-tinted avatars, relative timestamps)
 *   - Quick Actions card (2×2)
 *   - Floating "+ New report" button (bottom-right)
 *
 * A site with no reports yet renders an onboarding card instead of the
 * zeroed-out analytics so the first screen is never a wall of zeros.
 */
export default function HomeScreen() {
  const palette = themeColors();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { site } = useCurrentSite();

  const [reports, setReports] = useState<Report[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
      // A 401 means the session died under us — sign out rather than leave the
      // dashboard stuck on an error it can never clear.
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      setError(
        err instanceof ApiError ? err.message : 'Could not load reports.',
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, logout]);

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

  const allReports = reports ?? [];
  const summary = summarize(allReports);
  const weekBuckets = weeklyChart(allReports, period);
  const isChartEmpty = weekBuckets.every((bucket) =>
    bucket.values.every((value) => value === 0),
  );

  const weekTotal = (offset: number) =>
    weeklyChart(allReports, offset).reduce(
      (sum, bucket) => sum + bucket.values.reduce((s, v) => s + v, 0),
      0,
    );
  const thisWeekTotal = weekTotal(0);
  const lastWeekTotal = weekTotal(-1);
  const weekDeltaPct =
    lastWeekTotal === 0
      ? null
      : Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100);

  const periodTotal = period === 0 ? thisWeekTotal : lastWeekTotal;
  const overviewSubtitle = `Reports created ${
    period === 0 ? 'this week' : 'last week'
  }, grouped by current status · ${periodTotal} total${
    period === 0 && weekDeltaPct !== null
      ? ` · ${weekDeltaPct >= 0 ? '▲' : '▼'} ${Math.abs(weekDeltaPct)}% vs last week`
      : ''
  }`;

  const attention: AttentionItem[] = ATTENTION_DEFS.map((def) => ({
    ...def,
    count: allReports.filter(def.predicate).length,
  }));
  const attentionReportCount = allReports.filter((report) =>
    ATTENTION_DEFS.some((def) => def.predicate(report)),
  ).length;

  const categorySlices = (() => {
    const buckets = new Map<string, { total: number; open: number }>();
    for (const report of allReports) {
      const entry = buckets.get(report.category) ?? { total: 0, open: 0 };
      entry.total += 1;
      if (report.policy.statusGroup !== 'resolved') entry.open += 1;
      buckets.set(report.category, entry);
    }
    return [...buckets.entries()]
      .map(([name, counts]) => ({
        name,
        total: counts.total,
        open: counts.open,
        share: allReports.length === 0 ? 0 : counts.total / allReports.length,
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, CATEGORY_LIMIT);
  })();

  const filteredRecent = allReports
    .filter((report) => matchesFilter(report, activeStatus))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, RECENT_REPORT_LIMIT);

  const updates = allReports
    .slice()
    .sort((a, b) => {
      const ad = new Date(a.updatedAt ?? a.createdAt).getTime();
      const bd = new Date(b.updatedAt ?? b.createdAt).getTime();
      return bd - ad;
    })
    .slice(0, RECENT_UPDATES_LIMIT);

  const canFile =
    site !== null && user !== null && user.role !== 'technician';

  // Role-differentiated home: admins whose site has no building get the
  // first-login setup gate below; applicants see their admin-application
  // status; the quick actions expose each role's actual capabilities.
  const setupRequired = user?.siteOnboarding?.setupRequired === true;
  const applicationStatus = user?.adminApplication?.status ?? null;
  const quickActionFlags = {
    canCreate: canFile,
    canSetupSite: canManageSubsites(user),
    canProvisionUsers: canProvision(user),
    reviewApplications: user?.role === 'super_admin',
    hasSite: site !== null || user?.siteId != null,
  };

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

  /** Category rows deep-link as a search over the raw category value. */
  function gotoCategory(category: string) {
    router.push({ pathname: '/reports', params: { q: category } });
  }

  const filterLabel =
    activeStatus === 'all'
      ? null
      : activeStatus === 'urgent'
        ? 'Urgent'
        : groupLabels[activeStatus];

  // First-login setup gate: a site administrator whose site has no active
  // building lands on this screen instead of the dashboard. Authentication is
  // never blocked (the backend recalculates readiness live on /me) and the
  // other tabs stay reachable — only Home is gated, since it is the landing
  // screen.
  if (setupRequired) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="mb-5 h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: dashboardColors.statCoralSoft }}
          >
            <Building2
              color={dashboardColors.statCoralDeep}
              size={30}
              strokeWidth={1.8}
            />
          </View>
          <Text
            className="text-center text-xl font-bold text-ink"
            style={{ letterSpacing: -0.5 }}
          >
            Set up {site?.name ?? 'your site'}
          </Text>
          <Text className="mt-2 text-center text-[12px] leading-[1.8] text-dashboard-subtitle">
            Reporters can&apos;t file reports until the site has at least one
            building or area. Add the labelled locations your reporters will
            pick from — for example E5 / Classroom building.
          </Text>
          <View className="mt-6 w-full">
            <Button
              label="Open site setup"
              onPress={() => router.push('/more/site-setup')}
            />
          </View>
          <Text className="mt-4 text-center text-[10px] leading-[1.7] text-dashboard-caption">
            You can still use the other tabs. This screen clears itself once
            the first building is added.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5 pb-32 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
      >
        <WelcomeBanner
          greeting={greeting}
          firstName={user?.firstName}
          ctaDisabled={!canFile}
          onPressCta={gotoNewReport}
        />

        <SiteRow
          loading={loading || refreshing}
          error={reports === null ? error : null}
          lastSynced={lastSynced}
          onRefresh={() => {
            void load();
          }}
        />

        {applicationStatus === 'pending' || applicationStatus === 'approved' ? (
          <ApplicationStatusBanner
            status={applicationStatus}
            onPress={() => router.push('/more/admin-application')}
          />
        ) : null}

        {/* A failed refresh keeps the last good data on screen, so the error
            surfaces as a strip instead of blanking the dashboard. */}
        {reports !== null && error ? (
          <StateView
            variant="error"
            description={`Could not refresh: ${error}`}
            actionLabel="Retry"
            onAction={() => {
              void load();
            }}
          />
        ) : null}

        {reports === null && loading ? <HomeSkeleton /> : null}

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
          allReports.length === 0 ? (
            <>
              <EmptyHomeCard
                siteName={site.name}
                canFile={canFile}
                onPressCreate={gotoNewReport}
              />
              <QuickActionsCard
                flags={quickActionFlags}
                onPressCreate={gotoNewReport}
                onPressBrowse={() => gotoReports('all')}
                onPressAssignments={() => router.push('/assignments')}
                onPressSites={() => router.push('/more/sites')}
                onPressSiteSetup={() => router.push('/more/site-setup')}
                onPressTeamAccess={() => router.push('/more/team-access')}
                onPressApplications={() => router.push('/more/admin-applications')}
              />
            </>
          ) : (
            <>
              <AttentionCard
                items={attention}
                reportCount={attentionReportCount}
                onPressItem={gotoReports}
              />

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
                subtitle={overviewSubtitle}
              />

              <CategoryCard
                slices={categorySlices}
                onPressCategory={gotoCategory}
                onPressAll={() => gotoReports('all')}
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
                flags={quickActionFlags}
                onPressCreate={gotoNewReport}
                onPressBrowse={() => gotoReports('all')}
                onPressAssignments={() => router.push('/assignments')}
                onPressSites={() => router.push('/more/sites')}
                onPressSiteSetup={() => router.push('/more/site-setup')}
                onPressTeamAccess={() => router.push('/more/team-access')}
                onPressApplications={() => router.push('/more/admin-applications')}
              />
            </>
          )
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

/**
 * The context line under the banner: who you are looking at (the site, now a
 * live switcher for super_admin) and how fresh the data is, with a manual
 * refresh. This is the home page's only "system status" surface — it replaced
 * the old full-width Data connection card.
 */
function SiteRow({
  loading,
  error,
  lastSynced,
  onRefresh,
}: {
  loading: boolean;
  error: string | null;
  lastSynced: Date | null;
  onRefresh: () => void;
}) {
  const syncLabel = loading
    ? 'Refreshing…'
    : error
      ? 'Refresh failed'
      : lastSynced
        ? `Updated ${relativeTime(lastSynced.toISOString())}`
        : 'Not synced yet';

  return (
    <View className="mb-3 mt-1 flex-row items-center justify-between gap-2 px-1">
      <View className="flex-1 flex-row items-center gap-1.5">
        <View
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dashboardColors.statCitronDeep }}
        />
        <SiteSwitcher />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh dashboard"
        accessibilityState={{ disabled: loading }}
        disabled={loading}
        onPress={onRefresh}
        className={`flex-row items-center gap-1.5 active:opacity-70 ${
          loading ? 'opacity-40' : ''
        }`}
      >
        <Text className="text-[10px] text-dashboard-caption">{syncLabel}</Text>
        <RefreshCw
          color={dashboardColors.subtitle}
          size={12}
          strokeWidth={1.9}
        />
      </Pressable>
    </View>
  );
}

/**
 * Citron status banner for a reporter with a live site-admin application.
 * Links to the full status screen under More.
 */
function ApplicationStatusBanner({
  status,
  onPress,
}: {
  status: 'pending' | 'approved';
  onPress: () => void;
}) {
  const approved = status === 'approved';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="mb-3 active:opacity-80"
    >
      <View
        className="rounded-[11px] border p-4"
        style={{
          backgroundColor: dashboardColors.statCitronSoft,
          borderColor: dashboardColors.statCitronSoft,
        }}
      >
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-dashboard-card-bg">
            <Hourglass
              color={dashboardColors.statCitronDeep}
              size={18}
              strokeWidth={1.9}
            />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-ink">
              {approved
                ? 'Admin application approved'
                : 'Admin application pending'}
            </Text>
            <Text className="mt-0.5 text-[10px] leading-[1.6] text-dashboard-subtitle">
              {approved
                ? 'Sign out and back in to activate your administrator role.'
                : 'A super administrator is reviewing your request to administer a site.'}
            </Text>
          </View>
          <ChevronRight color={dashboardColors.subtitle} size={16} />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * "Needs attention". Urgent and status buckets come from the server's own
 * `report.policy` block (`urgent`, `statusGroup`) plus the status enum, so
 * the phone never invents its own triage rules.
 */
function AttentionCard({
  items,
  reportCount,
  onPressItem,
}: {
  items: AttentionItem[];
  /** Distinct reports across every bucket — buckets overlap, so they are
      never summed. */
  reportCount: number;
  onPressItem: (filter: ReportFilter) => void;
}) {
  const active = items.filter((item) => item.count > 0);

  return (
    <Card padded={false} className="mb-4">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <Text
          className="text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.4 }}
        >
          Needs attention
        </Text>
        {reportCount > 0 ? (
          <Text className="text-[10px] text-dashboard-caption">
            {reportCount} report{reportCount === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      {active.length === 0 ? (
        <View className="flex-row items-center gap-3 px-4 pb-4">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-dashboard-stat-mint-soft">
            <CheckCircle2
              color={dashboardColors.statMintDeep}
              size={18}
              strokeWidth={1.8}
            />
          </View>
          <View className="flex-1">
            <Text className="text-[12px] font-semibold text-ink">
              You&apos;re all caught up
            </Text>
            <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
              Nothing urgent, escalated, or waiting for a technician.
            </Text>
          </View>
        </View>
      ) : (
        active.map((item, index) => (
          <View key={item.key}>
            {index > 0 ? (
              <View className="mx-4 border-t border-dashboard-card-line" />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.count} ${item.label}`}
              onPress={() => onPressItem(item.filter)}
              className="flex-row items-center gap-3 px-4 py-3 active:opacity-80"
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${
                  ATTENTION_LABELS[item.tone].disc
                }`}
              >
                <item.icon
                  color={
                    item.tone === 'coral'
                      ? dashboardColors.statCoralDeep
                      : item.tone === 'mint'
                        ? dashboardColors.statMintDeep
                        : dashboardColors.statCitronDeep
                  }
                  size={17}
                  strokeWidth={1.8}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[12px] font-semibold text-ink">
                  {item.label}
                </Text>
                <Text
                  className="mt-0.5 text-[10px] text-dashboard-caption"
                  numberOfLines={2}
                >
                  {item.hint}
                </Text>
              </View>
              <View
                className={`rounded-full px-2 py-0.5 ${
                  ATTENTION_LABELS[item.tone].disc
                }`}
              >
                <Text
                  className={`text-[11px] font-bold ${
                    ATTENTION_LABELS[item.tone].ink
                  }`}
                >
                  {item.count}
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

function MaintenanceOverviewCard({
  period,
  onChangePeriod,
  buckets,
  isEmpty,
  loading,
  subtitle,
}: {
  period: 0 | -1;
  onChangePeriod: (next: 0 | -1) => void;
  buckets: ReturnType<typeof weeklyChart>;
  isEmpty: boolean;
  loading: boolean;
  subtitle: string;
}) {
  return (
    <Card className="mb-4">
      <View className="mb-3 flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.4 }}>
            Maintenance overview
          </Text>
          <Text className="mt-0.5 text-[11px] text-dashboard-subtitle">
            {subtitle}
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

type CategorySlice = {
  name: string;
  total: number;
  open: number;
  share: number;
};

/**
 * Where the reports are concentrated. Proportion bars make the dominant
 * category obvious at a glance; tapping one runs a search for that category
 * on the Reports tab (the list screen already supports `?q=`).
 */
function CategoryCard({
  slices,
  onPressCategory,
  onPressAll,
}: {
  slices: CategorySlice[];
  onPressCategory: (category: string) => void;
  onPressAll: () => void;
}) {
  // Palette values are getters (see `constants/theme.ts`), so they must be
  // read during render rather than hoisted to module scope.
  const barColors = [
    dashboardColors.teal,
    dashboardColors.statCoralDeep,
    dashboardColors.statCitronDeep,
    dashboardColors.statMintDeep,
  ];

  return (
    <Card padded={false} className="mb-4">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <View className="flex-1 pr-3">
          <Text
            className="text-[15px] font-semibold text-ink"
            style={{ letterSpacing: -0.4 }}
          >
            Reports by category
          </Text>
          <Text className="mt-0.5 text-[10px] text-dashboard-caption">
            Where maintenance issues concentrate
          </Text>
        </View>
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

      <View className="px-4 pb-3">
        {slices.map((slice, index) => {
          const percent = Math.round(slice.share * 100);
          return (
            <Pressable
              key={slice.name}
              accessibilityRole="button"
              accessibilityLabel={`${humanize(slice.name)}, ${slice.total} reports`}
              onPress={() => onPressCategory(slice.name)}
              className={`py-2 active:opacity-70 ${index > 0 ? 'mt-1' : ''}`}
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text
                  className="flex-1 text-[12px] font-semibold text-ink"
                  numberOfLines={1}
                >
                  {humanize(slice.name)}
                </Text>
                <Text className="text-[10px] text-dashboard-subtitle">
                  {slice.total} · {percent}%
                </Text>
              </View>
              <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-dashboard-card-line">
                <View
                  className="h-full rounded-full"
                  style={{
                    // Keep a visible sliver even for a 1-of-500 category.
                    width: `${Math.max(4, percent)}%`,
                    backgroundColor: barColors[index % barColors.length],
                  }}
                />
              </View>
              <Text className="mt-1 text-[9px] text-dashboard-caption">
                {slice.open} still open
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
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
              className="px-4 py-3 active:opacity-80"
            >
              <View className="flex-row items-center gap-3">
                <StatusAvatar status={report.status} />
                <View className="flex-1">
                  <Text
                    className="text-[12px] font-semibold text-ink"
                    numberOfLines={1}
                  >
                    {report.description}
                  </Text>
                  <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
                    #{report.id} · {humanize(report.category)}
                  </Text>
                </View>
                <ChevronRight
                  color={dashboardColors.subtitle}
                  size={16}
                  strokeWidth={1.6}
                />
              </View>
              <View className="mt-2 flex-row items-center gap-2 pl-12">
                <UrgencyChip level={effectiveUrgency(report)} />
                <Text className="text-[10px] text-dashboard-caption">
                  {relativeTime(report.createdAt)}
                </Text>
                {isUnassigned(report) ? (
                  <Text className="text-[10px] text-dashboard-caption">
                    · Unassigned
                  </Text>
                ) : null}
              </View>
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
          {reports.map((report) => (
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
                  {relativeTime(report.updatedAt ?? report.createdAt)}
                </Text>
              </View>
              <ChevronRight
                color={dashboardColors.subtitle}
                size={14}
                strokeWidth={1.6}
              />
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

type QuickActionFlags = {
  canCreate: boolean;
  canSetupSite: boolean;
  canProvisionUsers: boolean;
  reviewApplications: boolean;
  hasSite: boolean;
};

function QuickActionsCard({
  flags,
  onPressCreate,
  onPressBrowse,
  onPressAssignments,
  onPressSites,
  onPressSiteSetup,
  onPressTeamAccess,
  onPressApplications,
}: {
  flags: QuickActionFlags;
  onPressCreate: () => void;
  onPressBrowse: () => void;
  onPressAssignments: () => void;
  onPressSites: () => void;
  onPressSiteSetup: () => void;
  onPressTeamAccess: () => void;
  onPressApplications: () => void;
}) {
  return (
    <Card padded={false} className="mb-4">
      <View className="px-4 pb-2 pt-4">
        <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.4 }}>
          Quick actions
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2 px-3 pb-3">
        {flags.canCreate ? (
          <ActionTile
            icon={Plus}
            title="Create report"
            subtitle="Log a new issue"
            tone="mint"
            onPress={onPressCreate}
          />
        ) : null}
        {flags.canSetupSite ? (
          <ActionTile
            icon={Building2}
            title="Site setup"
            subtitle="Buildings & readiness"
            tone="neutral"
            onPress={onPressSiteSetup}
          />
        ) : null}
        {flags.canProvisionUsers ? (
          <ActionTile
            icon={UserPlus}
            title="Team access"
            subtitle="Provision accounts"
            tone="neutral"
            onPress={onPressTeamAccess}
          />
        ) : null}
        {flags.reviewApplications ? (
          <ActionTile
            icon={ShieldCheck}
            title="Applications"
            subtitle="Site-admin requests"
            tone="neutral"
            onPress={onPressApplications}
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
        {flags.hasSite ? (
          <ActionTile
            icon={Leaf}
            title="Your sites"
            subtitle="View site information"
            tone="neutral"
            onPress={onPressSites}
          />
        ) : null}
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

/**
 * First-run state for a site that has never had a report filed. Replaces the
 * analytics (all of which would be zero) with the one action that matters.
 */
function EmptyHomeCard({
  siteName,
  canFile,
  onPressCreate,
}: {
  siteName: string;
  canFile: boolean;
  onPressCreate: () => void;
}) {
  return (
    <Card className="mb-4">
      <View className="items-center px-2 py-3">
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: dashboardColors.tealSoft }}
        >
          <ClipboardList
            color={dashboardColors.teal}
            size={26}
            strokeWidth={1.7}
          />
        </View>
        <Text
          className="mt-3 text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          No reports yet at {siteName}
        </Text>
        <Text className="mt-1 text-center text-[11px] leading-[1.7] text-dashboard-subtitle">
          File the first report and this dashboard starts tracking open work,
          urgency, and weekly progress.
        </Text>
        {canFile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="File your first report"
            onPress={onPressCreate}
            className="mt-4 flex-row items-center gap-2 rounded-[11px] border px-4 py-2.5 active:opacity-90"
            style={{
              backgroundColor: dashboardColors.ctaBg,
              borderColor: dashboardColors.ctaBorder,
            }}
          >
            <Plus color={dashboardColors.ctaText} size={16} strokeWidth={2.4} />
            <Text
              className="text-[13px] font-semibold"
              style={{ color: dashboardColors.ctaText }}
            >
              File your first report
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Placeholder geometry for the first load — it mirrors the real block order
 * (attention, two stat rows, chart, list) so the dashboard does not jump
 * when the data arrives.
 */
function HomeSkeleton() {
  return (
    <View accessibilityLabel="Loading dashboard">
      <View className="mb-4 h-[104px] rounded-[11px] border border-dashboard-card-line bg-dashboard-card-bg" />
      <View className="mb-3 flex-row gap-2">
        <View className="h-[76px] flex-1 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg" />
        <View className="h-[76px] flex-1 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg" />
      </View>
      <View className="mb-5 flex-row gap-2">
        <View className="h-[76px] flex-1 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg" />
        <View className="h-[76px] flex-1 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg" />
      </View>
      <View className="mb-4 h-[180px] rounded-[11px] border border-dashboard-card-line bg-dashboard-card-bg" />
      <View className="mb-4 h-[150px] rounded-[11px] border border-dashboard-card-line bg-dashboard-card-bg" />
    </View>
  );
}

function StatusAvatar({
  status,
  small = false,
}: {
  status: ReportStatus;
  small?: boolean;
}) {
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

/**
 * An unresolved report nobody is working on. Derived from two fields the
 * response already carries — `assignedTechnicianId` and the server-computed
 * `policy.statusGroup`.
 *
 * Not `policy.inAssignmentQueue`: for every non-technician actor the backend
 * computes `ownQueue` as `true`, so that flag only means "assigned and still
 * unresolved" — the opposite of this bucket.
 */
function isUnassigned(report: Report): boolean {
  return (
    report.policy.statusGroup !== 'resolved' &&
    report.assignedTechnicianId === null
  );
}

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
