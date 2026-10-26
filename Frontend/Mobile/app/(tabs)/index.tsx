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
import { useTranslation } from 'react-i18next';

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
  tone: DashboardStatTone;
  icon: LucideIcon;
};

const STATS: StatConfig[] = [
  { filter: 'open', tone: 'coral', icon: FileText },
  { filter: 'progress', tone: 'mint', icon: Settings },
  { filter: 'resolved', tone: 'citron', icon: CircleCheck },
  { filter: 'urgent', tone: 'coral-danger', icon: TriangleAlert },
];

/**
 * Operations roles (staff/admin/super_admin) get a triage-oriented set: the
 * queues that need an admin decision today, not the reporter's lifecycle view.
 */
const OPS_STATS: StatConfig[] = [
  { filter: 'unassigned', tone: 'coral', icon: ClipboardList },
  { filter: 'urgent', tone: 'coral-danger', icon: TriangleAlert },
  { filter: 'confirmation', tone: 'citron', icon: CircleCheck },
  { filter: 'progress', tone: 'mint', icon: Settings },
];

/**
 * One "needs attention" bucket. A report can appear in several buckets (an
 * urgent report nobody has picked up is both), which is why the card's header
 * counts distinct reports rather than summing the buckets.
 */
type AttentionDef = {
  key: string;
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
    predicate: isUrgent,
    filter: 'urgent',
    icon: TriangleAlert,
    tone: 'coral',
  },
  {
    key: 'escalated',
    predicate: (report) => report.status === 'escalated',
    filter: 'open',
    icon: Activity,
    tone: 'coral',
  },
  {
    key: 'unassigned',
    predicate: isUnassigned,
    filter: 'open',
    icon: ClipboardList,
    tone: 'mint',
  },
  {
    key: 'awaiting',
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
 */
export default function HomeScreen() {
  const { t } = useTranslation('common');
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
        err instanceof ApiError ? err.message : t('home.errors.couldNotLoad'),
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
  const periodLabel = period === 0
    ? t('home.maintenanceOverview.thisWeek')
    : t('home.maintenanceOverview.lastWeek');
  const overviewSubtitle = t('home.maintenanceOverview.subtitle', {
    period: periodLabel,
    total: periodTotal,
    delta: period === 0 && weekDeltaPct !== null
      ? t('home.maintenanceOverview.deltaVsLastWeek', {
          sign: weekDeltaPct >= 0 ? '▲' : '▼',
          pct: Math.abs(weekDeltaPct),
        })
      : '',
  });

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

  /**
   * Staff, site admins and super_admins run the site; reporters and
   * technicians consume it. Ops roles get a triage dashboard (unassigned /
   * urgent / awaiting-confirmation queues, "Review the queue" CTA) instead of
   * the reporter's filing-oriented home.
   */
  const isOps =
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'staff';
  const statSet = isOps ? OPS_STATS : STATS;
  const statValue = (filter: ReportFilter): number => {
    if (filter === 'unassigned') {
      return allReports.filter(isUnassigned).length;
    }
    if (filter === 'confirmation') {
      return allReports.filter(
        (report) => report.status === 'resolved_pending_confirmation',
      ).length;
    }
    return summaryFor(summary, filter);
  };

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
    canManageSites:
      (user?.role === 'admin' || user?.role === 'super_admin') &&
      (site !== null || user?.siteId != null),
  };

  const fileDisabledReason = !site
    ? t('home.reportDisabledReasons.noSite')
    : user?.role === 'technician'
      ? t('home.reportDisabledReasons.technician')
      : null;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetings.morning');
    if (hour < 18) return t('home.greetings.afternoon');
    return t('home.greetings.evening');
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
        ? t('home.statLabels.urgent.label')
        : activeStatus === 'confirmation'
          ? t('labels.filter.confirmation')
          : activeStatus === 'unassigned'
            ? t('home.statLabels.unassigned.label')
            : t(groupLabels[activeStatus]);

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
            {t('home.setupGate.title', { site: site?.name ?? t('home.setupGate.titleFallback') })}
          </Text>
          <Text className="mt-2 text-center text-[12px] leading-[1.8] text-dashboard-subtitle">
            {t('home.setupGate.subtitle')}
          </Text>
          <View className="mt-6 w-full">
            <Button
              label={t('home.setupGate.cta')}
              onPress={() => router.push('/more/site-setup')}
            />
          </View>
          <Text className="mt-4 text-center text-[10px] leading-[1.7] text-dashboard-caption">
            {t('home.setupGate.helper')}
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
          t={t}
          greeting={greeting}
          firstName={user?.firstName}
          ctaDisabled={isOps ? !site : !canFile}
          ctaLabelKey={isOps ? 'home.reviewQueue' : 'home.reportIssue'}
          taglineKey={isOps ? 'home.bannerTaglineOps' : 'home.bannerTagline'}
          onPressCta={isOps ? () => gotoReports('open') : gotoNewReport}
        />

        <SiteRow
          t={t}
          loading={loading || refreshing}
          error={reports === null ? error : null}
          lastSynced={lastSynced}
          onRefresh={() => {
            void load();
          }}
        />

        {applicationStatus === 'pending' || applicationStatus === 'approved' ? (
          <ApplicationStatusBanner
            t={t}
            status={applicationStatus}
            onPress={() => router.push('/more/admin-application')}
          />
        ) : null}

        {/* A failed refresh keeps the last good data on screen, so the error
            surfaces as a strip instead of blanking the dashboard. */}
        {reports !== null && error ? (
          <StateView
            variant="error"
            description={t('home.errors.couldNotRefresh', { detail: error })}
            actionLabel={t('home.errors.retry')}
            onAction={() => {
              void load();
            }}
          />
        ) : null}

        {reports === null && loading ? <HomeSkeleton /> : null}

        {error && reports === null ? (
          <StateView
            variant="error"
            title={t('home.errors.couldNotLoadTitle')}
            description={error}
            actionLabel={t('home.errors.retry')}
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
                t={t}
                siteName={site.name}
                canFile={canFile}
                onPressCreate={gotoNewReport}
              />
              <QuickActionsCard
                t={t}
                flags={quickActionFlags}
                onPressCreate={gotoNewReport}
                onPressBrowse={() => gotoReports('all')}
                onPressSites={() => router.push('/more/sites')}
                onPressSiteSetup={() => router.push('/more/site-setup')}
                onPressTeamAccess={() => router.push('/more/team-access')}
                onPressApplications={() => router.push('/more/admin-applications')}
              />
            </>
          ) : (
            <>
              <AttentionCard
                t={t}
                items={attention}
                reportCount={attentionReportCount}
                onPressItem={gotoReports}
              />

              <View className="mb-3 flex-row gap-2">
                {statSet.slice(0, 2).map((stat) => (
                  <StatCard
                    key={stat.filter}
                    label={t(`home.statLabels.${stat.filter}.label`)}
                    note={t(`home.statLabels.${stat.filter}.note`)}
                    value={reportsLoadedValue(loading, statValue(stat.filter))}
                    tone={stat.tone}
                    icon={stat.icon}
                    selected={activeStatus === stat.filter}
                    onPress={() => gotoFilter(stat.filter)}
                  />
                ))}
              </View>
              <View className="mb-5 flex-row gap-2">
                {statSet.slice(2, 4).map((stat) => (
                  <StatCard
                    key={stat.filter}
                    label={t(`home.statLabels.${stat.filter}.label`)}
                    note={t(`home.statLabels.${stat.filter}.note`)}
                    value={reportsLoadedValue(loading, statValue(stat.filter))}
                    tone={stat.tone}
                    icon={stat.icon}
                    selected={activeStatus === stat.filter}
                    onPress={() => gotoFilter(stat.filter)}
                  />
                ))}
              </View>

              <MaintenanceOverviewCard
                t={t}
                period={period}
                onChangePeriod={setPeriod}
                buckets={weekBuckets}
                isEmpty={isChartEmpty}
                loading={loading}
                subtitle={overviewSubtitle}
              />

              <CategoryCard
                t={t}
                slices={categorySlices}
                onPressCategory={gotoCategory}
                onPressAll={() => gotoReports('all')}
              />

              <RecentReportsCard
                t={t}
                filterLabel={filterLabel}
                onClearFilter={clearFilter}
                reports={filteredRecent}
                activeFilter={activeStatus}
                onPressAll={() => gotoReports(activeStatus)}
                onPressRow={gotoReport}
              />

              <RecentUpdatesCard
                t={t}
                reports={updates}
                onPressAll={() => gotoReports('all')}
                onPressRow={gotoReport}
              />

              <QuickActionsCard
                t={t}
                flags={quickActionFlags}
                onPressCreate={gotoNewReport}
                onPressBrowse={() => gotoReports('all')}
                onPressSites={() => router.push('/more/sites')}
                onPressSiteSetup={() => router.push('/more/site-setup')}
                onPressTeamAccess={() => router.push('/more/team-access')}
                onPressApplications={() => router.push('/more/admin-applications')}
              />
            </>
          )
        ) : null}
      </ScrollView>

      {/* Floating create — reporters only; ops roles file through the quick
          actions and spend their time in the triage queues. */}
      {canFile && !isOps ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.reportIssue')}
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

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

function WelcomeBanner({
  t,
  greeting,
  firstName,
  ctaDisabled,
  ctaLabelKey,
  taglineKey,
  onPressCta,
}: {
  t: TranslateFn;
  greeting: string;
  firstName: string | undefined;
  ctaDisabled: boolean;
  ctaLabelKey: string;
  taglineKey: string;
  onPressCta: () => void;
}) {
  const ctaLabel = t(ctaLabelKey);
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
          {t(taglineKey)}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-x-4 gap-y-1">
          <ValuePill icon={Leaf} color={dashboardColors.statCoralDeep}>
            {t('home.valuePills.safeSpaces')}
          </ValuePill>
          <ValuePill icon={Heart} color={dashboardColors.statCoralDeep}>
            {t('home.valuePills.happyPeople')}
          </ValuePill>
          <ValuePill icon={Users} color={dashboardColors.statMintDeep}>
            {t('home.valuePills.strongerCommunities')}
          </ValuePill>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
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
            {ctaLabel}
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
  t,
  loading,
  error,
  lastSynced,
  onRefresh,
}: {
  t: TranslateFn;
  loading: boolean;
  error: string | null;
  lastSynced: Date | null;
  onRefresh: () => void;
}) {
  const syncLabel = loading
    ? t('home.sync.refreshing')
    : error
      ? t('home.sync.failed')
      : lastSynced
        ? t('home.sync.updatedAgo', { time: relativeTime(lastSynced.toISOString()) })
        : t('home.sync.notSynced');

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
        accessibilityLabel={t('home.sync.accessibilityLabel')}
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
  t,
  status,
  onPress,
}: {
  t: TranslateFn;
  status: 'pending' | 'approved';
  onPress: () => void;
}) {
  const approved = status === 'approved';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        approved
          ? t('home.applicationBanner.approvedTitle')
          : t('home.applicationBanner.pendingTitle')
      }
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
                ? t('home.applicationBanner.approvedTitle')
                : t('home.applicationBanner.pendingTitle')}
            </Text>
            <Text className="mt-0.5 text-[10px] leading-[1.6] text-dashboard-subtitle">
              {approved
                ? t('home.applicationBanner.approvedBody')
                : t('home.applicationBanner.pendingBody')}
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
  t,
  items,
  reportCount,
  onPressItem,
}: {
  t: TranslateFn;
  items: AttentionItem[];
  /** Distinct reports across every bucket — buckets overlap, so they are
      never summed. */
  reportCount: number;
  onPressItem: (filter: ReportFilter) => void;
}) {
  const active = items.filter((item) => item.count > 0);

  const keyMap: Record<string, string> = {
    urgent: 'home.attention.urgent',
    escalated: 'home.attention.escalated',
    unassigned: 'home.attention.unassigned',
    awaiting: 'home.attention.awaiting',
  };

  return (
    <Card padded={false} className="mb-4">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <Text
          className="text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.4 }}
        >
          {t('home.attention.header')}
        </Text>
        {reportCount > 0 ? (
          <Text className="text-[10px] text-dashboard-caption">
            {t('home.attention.reportCount', {
              count: reportCount,
              plural: reportCount === 1 ? '' : 's',
            })}
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
              {t('home.attention.allCaughtUp')}
            </Text>
            <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
              {t('home.attention.allCaughtUpHint')}
            </Text>
          </View>
        </View>
      ) : (
        active.map((item, index) => {
          const key = keyMap[item.key];
          return (
            <View key={item.key}>
              {index > 0 ? (
                <View className="mx-4 border-t border-dashboard-card-line" />
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.attention.itemA11y', {
                  count: item.count,
                  label: t(`${key}.label`),
                })}
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
                    {t(`${key}.label`)}
                  </Text>
                  <Text
                    className="mt-0.5 text-[10px] text-dashboard-caption"
                    numberOfLines={2}
                  >
                    {t(`${key}.hint`)}
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
          );
        })
      )}
    </Card>
  );
}

function MaintenanceOverviewCard({
  t,
  period,
  onChangePeriod,
  buckets,
  isEmpty,
  loading,
  subtitle,
}: {
  t: TranslateFn;
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
            {t('home.maintenanceOverview.header')}
          </Text>
          <Text className="mt-0.5 text-[11px] text-dashboard-subtitle">
            {subtitle}
          </Text>
        </View>
        <PeriodToggle t={t} value={period} onChange={onChangePeriod} />
      </View>

      {loading && buckets.every((b) => b.values.every((v) => v === 0)) ? (
        <Text className="py-8 text-center text-[11px] text-dashboard-empty">
          {t('home.maintenanceOverview.loadingData')}
        </Text>
      ) : (
        <>
          <WeeklyChart buckets={buckets} />
          {isEmpty ? (
            <Text className="mt-2 text-center text-[10px] text-dashboard-caption">
              {t('home.maintenanceOverview.noReportsThisWeek')}
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

function PeriodToggle({
  t,
  value,
  onChange,
}: {
  t: TranslateFn;
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
              {option === 0
                ? t('home.maintenanceOverview.thisWeek')
                : t('home.maintenanceOverview.lastWeek')}
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
  t,
  slices,
  onPressCategory,
  onPressAll,
}: {
  t: TranslateFn;
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
            {t('home.category.header')}
          </Text>
          <Text className="mt-0.5 text-[10px] text-dashboard-caption">
            {t('home.category.subtitle')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('home.category.viewAll')}
          onPress={onPressAll}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <Text className="text-[11px] font-medium text-dashboard-teal">
            {t('home.category.viewAll')}
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
              accessibilityLabel={t('home.category.rowA11y', {
                category: humanize(slice.name),
                count: slice.total,
              })}
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
                {t('home.category.stillOpen', { count: slice.open })}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function RecentReportsCard({
  t,
  filterLabel,
  onClearFilter,
  reports,
  activeFilter,
  onPressAll,
  onPressRow,
}: {
  t: TranslateFn;
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
          {t('home.recentReports.header')}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('home.recentReports.viewAll')}
          onPress={onPressAll}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <Text className="text-[11px] font-medium text-dashboard-teal">
            {t('home.recentReports.viewAll')}
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
            accessibilityLabel={t('home.recentReports.clearFilter')}
            onPress={onClearFilter}
            className="active:opacity-70"
          >
            <Text className="text-[10px] font-medium text-dashboard-teal underline">
              {t('home.recentReports.clearFilter')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {reports.length === 0 ? (
        <Text className="px-4 pb-4 text-center text-[11px] text-dashboard-empty">
          {activeFilter === 'all'
            ? t('home.recentReports.noReportsYet')
            : t('home.recentReports.noMatch')}
        </Text>
      ) : (
        reports.map((report, index) => (
          <View key={report.id}>
            {index > 0 ? (
              <View className="mx-4 border-t border-dashboard-card-line" />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('home.recentReports.openA11y', {
                description: report.description,
              })}
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
                    {t('home.recentReports.unassignedLabel')}
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
  t,
  reports,
  onPressAll,
  onPressRow,
}: {
  t: TranslateFn;
  reports: Report[];
  onPressAll: () => void;
  onPressRow: (id: number) => void;
}) {
  return (
    <Card padded={false} className="mb-4">
      <View className="flex-row items-center justify-between px-4 pb-2 pt-4">
        <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.4 }}>
          {t('home.recentUpdates.header')}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('home.recentUpdates.viewAll')}
          onPress={onPressAll}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <Text className="text-[11px] font-medium text-dashboard-teal">
            {t('home.recentUpdates.viewAll')}
          </Text>
          <ArrowRight color={dashboardColors.teal} size={12} />
        </Pressable>
      </View>

      {reports.length === 0 ? (
        <Text className="px-4 pb-4 text-center text-[11px] text-dashboard-empty">
          {t('home.recentUpdates.noUpdatesYet')}
        </Text>
      ) : (
        <View className="px-3 pb-3">
          {reports.map((report) => (
            <Pressable
              key={report.id}
              accessibilityRole="link"
              accessibilityLabel={t('home.recentUpdates.openA11y', {
                id: report.id,
              })}
              onPress={() => onPressRow(report.id)}
              className="flex-row items-center gap-3 px-1 py-2.5 active:opacity-80"
            >
              <StatusAvatar status={report.status} small />
              <View className="flex-1">
                <Text
                  className="text-[12px] font-semibold text-ink"
                  numberOfLines={1}
                >
                  {t('home.recentUpdates.reportPrefix', { id: report.id })}
                  <Text className="font-normal text-dashboard-subtitle">
                    {'  ·  '}
                    {t(statusLabels[report.status])}
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
  /** Site management is admin-only — the More menu gates it the same way. */
  canManageSites: boolean;
};

function QuickActionsCard({
  t,
  flags,
  onPressCreate,
  onPressBrowse,
  onPressSites,
  onPressSiteSetup,
  onPressTeamAccess,
  onPressApplications,
}: {
  t: TranslateFn;
  flags: QuickActionFlags;
  onPressCreate: () => void;
  onPressBrowse: () => void;
  onPressSites: () => void;
  onPressSiteSetup: () => void;
  onPressTeamAccess: () => void;
  onPressApplications: () => void;
}) {
  return (
    <Card padded={false} className="mb-4">
      <View className="px-4 pb-2 pt-4">
        <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.4 }}>
          {t('home.quickActions.header')}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2 px-3 pb-3">
        {flags.canCreate ? (
          <ActionTile
            t={t}
            icon={Plus}
            titleKey="home.quickActions.createReport.title"
            subtitleKey="home.quickActions.createReport.subtitle"
            tone="mint"
            onPress={onPressCreate}
          />
        ) : null}
        {flags.canSetupSite ? (
          <ActionTile
            t={t}
            icon={Building2}
            titleKey="home.quickActions.siteSetup.title"
            subtitleKey="home.quickActions.siteSetup.subtitle"
            tone="neutral"
            onPress={onPressSiteSetup}
          />
        ) : null}
        {flags.canProvisionUsers ? (
          <ActionTile
            t={t}
            icon={UserPlus}
            titleKey="home.quickActions.teamAccess.title"
            subtitleKey="home.quickActions.teamAccess.subtitle"
            tone="neutral"
            onPress={onPressTeamAccess}
          />
        ) : null}
        {flags.reviewApplications ? (
          <ActionTile
            t={t}
            icon={ShieldCheck}
            titleKey="home.quickActions.applications.title"
            subtitleKey="home.quickActions.applications.subtitle"
            tone="neutral"
            onPress={onPressApplications}
          />
        ) : null}
        <ActionTile
          t={t}
          icon={FileText}
          titleKey="home.quickActions.browseReports.title"
          subtitleKey="home.quickActions.browseReports.subtitle"
          tone="neutral"
          onPress={onPressBrowse}
        />
        {flags.canManageSites ? (
          <ActionTile
            t={t}
            icon={Leaf}
            titleKey="home.quickActions.yourSites.title"
            subtitleKey="home.quickActions.yourSites.subtitle"
            tone="neutral"
            onPress={onPressSites}
          />
        ) : null}
      </View>
    </Card>
  );
}

function ActionTile({
  t,
  icon: Icon,
  titleKey,
  subtitleKey,
  tone,
  onPress,
}: {
  t: TranslateFn;
  icon: LucideIcon;
  titleKey: string;
  subtitleKey: string;
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
      accessibilityLabel={t(titleKey)}
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
          {t(titleKey)}
        </Text>
        <Text
          className="mt-0.5 text-[9px] text-dashboard-caption"
          numberOfLines={2}
        >
          {t(subtitleKey)}
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
  t,
  siteName,
  canFile,
  onPressCreate,
}: {
  t: TranslateFn;
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
          {t('home.emptyHome.title', { site: siteName })}
        </Text>
        <Text className="mt-1 text-center text-[11px] leading-[1.7] text-dashboard-subtitle">
          {t('home.emptyHome.subtitle')}
        </Text>
        {canFile ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.emptyHome.firstReport')}
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
              {t('home.emptyHome.firstReport')}
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
  const { t } = useTranslation('common');
  return (
    <View accessibilityLabel={t('home.loadingDashboard')}>
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
