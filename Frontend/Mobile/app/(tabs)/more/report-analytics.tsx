import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  BarChart3,
  CheckCircle2,
  CircleDot,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Screen } from '@/components/ui/Screen';
import { StatCard } from '@/components/ui/StatCard';
import { StateView } from '@/components/ui/StateView';
import { WeeklyChart } from '@/components/ui/WeeklyChart';
import { dashboardColors, colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, toErrorMessage } from '@/lib/apiClient';
import { searchReportsPage } from '@/services/reports';
import { useCurrentSite } from '@/stores/site';
import type { Report, Urgency } from '@/types';
import { humanize } from '@/utils/format';
import {
  monthlyChart,
  monthsAgoIso,
  summarize,
  todayIso,
  urgencyLabels,
  weeklyChart,
  type DayBucket,
  type WeekBucket,
} from '@/utils/maintenance';

// ─── Types ──────────────────────────────────────────────────────────────────

type TimeWindow = 'week' | 'month' | 'all';

const WINDOWS: TimeWindow[] = ['week', 'month', 'all'];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Clamp to 100 results per page — the backend max. */
const PAGE_SIZE = 100;

/** Fetch all pages for the given filters and return the combined array. */
async function fetchAllReports(
  siteId: number | null,
  from: string | undefined,
  to: string | undefined,
): Promise<Report[]> {
  const all: Report[] = [];
  let page = 0;
  // Safety cap: at most 20 pages (2 000 reports). Analytics screens rarely
  // need more, and this prevents infinite loops on unusually large sites.
  while (page < 20) {
    const result = await searchReportsPage({
      siteId,
      filters: { from, to },
      page,
      size: PAGE_SIZE,
    });
    all.push(...result.content);
    if (!result.hasMore) break;
    page++;
  }
  return all;
}

function windowDates(window: TimeWindow): { from?: string; to?: string } {
  const now = new Date();
  if (window === 'week') {
    // Start of this Monday.
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return {
      from: `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`,
      to: todayIso(now),
    };
  }
  if (window === 'month') {
    return { from: monthsAgoIso(1, now), to: todayIso(now) };
  }
  return {}; // all time — no date filter
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function ReportAnalyticsScreen() {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const { site } = useCurrentSite();

  // super_admin → cross-site (siteId: null); admin → their site.
  const siteId: number | null =
    user?.role === 'super_admin' ? null : (site?.id ?? user?.siteId ?? null);

  const [timeWindow, setTimeWindow] = useState<TimeWindow>('month');
  const [reports, setReports] = useState<Report[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);

  const load = useCallback(async () => {
    const gen = ++loadGen.current;
    setError(null);
    if (reports === null) setLoading(true);
    try {
      const { from, to } = windowDates(timeWindow);
      const result = await fetchAllReports(siteId, from, to);
      if (gen !== loadGen.current) return;
      setReports(result);
    } catch (err) {
      if (gen !== loadGen.current) return;
      if (err instanceof ApiError && err.status === 401) return;
      setError(toErrorMessage(err, { fallback: t('analytics.loadError') }));
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, [siteId, timeWindow, reports, t]);

  // Reload when the window changes or the screen comes into focus.
  useFocusEffect(
    useCallback(() => {
      void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timeWindow, siteId]),
  );

  async function onRefresh() {
    setRefreshing(true);
    // Reset so the full load clears the stale data.
    setReports(null);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const all = reports ?? [];
  const summary = summarize(all);
  const total = all.length;

  // ── Status breakdown ──────────────────────────────────────────────────────
  const resolvedPct = total === 0 ? 0 : Math.round(((summary.resolved) / total) * 100);

  // ── Urgency breakdown ─────────────────────────────────────────────────────
  const urgencyCounts = useMemo<Record<Urgency, number>>(() => {
    const counts: Record<Urgency, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const r of all) {
      const u = r.policy.effectiveUrgency ?? r.reporterUrgency;
      counts[u] = (counts[u] ?? 0) + 1;
    }
    return counts;
  }, [all]);

  // ── Category breakdown ────────────────────────────────────────────────────
  const categoryRows = useMemo(() => {
    const map = new Map<string, { total: number; resolved: number }>();
    for (const r of all) {
      const e = map.get(r.category) ?? { total: 0, resolved: 0 };
      e.total += 1;
      if (r.policy.statusGroup === 'resolved') e.resolved += 1;
      map.set(r.category, e);
    }
    return [...map.entries()]
      .map(([name, c]) => ({ name, ...c }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [all]);

  // ── Chart ─────────────────────────────────────────────────────────────────
  const now = new Date();
  const weekBuckets: WeekBucket[] = useMemo(
    () => weeklyChart(all, 0, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all],
  );
  const monthBuckets: DayBucket[] = useMemo(
    () => monthlyChart(all, now.getFullYear(), now.getMonth()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all],
  );

  // For the "all time" window we show the month chart of the current month,
  // but that feels misleading — better to show the last 7 days as a summary.
  // We always show week buckets when window === 'week' | 'all' and month
  // buckets when window === 'month'.
  const showMonthChart = timeWindow === 'month';
  const chartBuckets = showMonthChart ? monthBuckets : weekBuckets;
  const chartIsEmpty = chartBuckets.every((b) => b.values.every((v) => v === 0));

  // ── Render ────────────────────────────────────────────────────────────────

  if (error && reports === null) {
    return (
      <Screen>
        <StateView
          variant="error"
          title={t('analytics.loadErrorTitle')}
          description={error}
          actionLabel={t('analytics.retry')}
          onAction={() => void load()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-5 pt-4">
          <PageHeader
            kicker={
              user?.role === 'super_admin'
                ? t('analytics.kickerSuperAdmin')
                : t('analytics.kickerAdmin', { site: site?.name ?? '' })
            }
            title={t('analytics.title')}
            subtitle={t('analytics.subtitle')}
            icon={BarChart3}
          >
            <View className="flex-row items-center gap-2">
              {/* Window selector */}
              <WindowToggle
                value={timeWindow}
                onChange={(w) => { setTimeWindow(w); setReports(null); }}
              />
              {loading ? (
                <ActivityIndicator color={dashboardColors.teal} size="small" />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('analytics.refresh')}
                  onPress={() => void load()}
                  className="h-7 w-7 items-center justify-center rounded-md active:opacity-70"
                >
                  <RefreshCw color={dashboardColors.subtitle} size={14} />
                </Pressable>
              )}
            </View>
          </PageHeader>
        </View>

        {loading && reports === null ? (
          <StateView variant="loading" title={t('analytics.loading')} />
        ) : (
          <View className="px-5">
            {/* Error banner (non-blocking — data already shown) */}
            {error ? (
              <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
                <Text className="text-[11px] text-dashboard-error-text">{error}</Text>
              </View>
            ) : null}

            {/* ── 4 stat cards ───────────────────────────────────────────── */}
            <View className="mb-4 gap-2">
              <View className="flex-row gap-2">
                <StatCard
                  label={t('analytics.stats.total')}
                  value={total}
                  tone="mint"
                  icon={BarChart3}
                  note={t('analytics.stats.totalNote', { window: t(`analytics.window.${timeWindow}`) })}
                />
                <StatCard
                  label={t('analytics.stats.open')}
                  value={summary.open + summary.progress}
                  tone="coral"
                  icon={CircleDot}
                />
              </View>
              <View className="flex-row gap-2">
                <StatCard
                  label={t('analytics.stats.resolved')}
                  value={summary.resolved}
                  tone="citron"
                  icon={CheckCircle2}
                  note={total > 0 ? `${resolvedPct}%` : undefined}
                />
                <StatCard
                  label={t('analytics.stats.urgent')}
                  value={summary.urgent}
                  tone="coral-danger"
                  icon={TriangleAlert}
                />
              </View>
            </View>

            {/* ── Timeline chart ─────────────────────────────────────────── */}
            <Card className="mb-4">
              <View className="mb-3 flex-row items-center justify-between">
                <Text
                  className="text-[15px] font-semibold text-ink"
                  style={{ letterSpacing: -0.3 }}
                >
                  {t('analytics.chart.title')}
                </Text>
                <Text className="text-[11px] text-dashboard-caption">
                  {t(`analytics.window.${timeWindow}`)}
                </Text>
              </View>
              {chartIsEmpty ? (
                <View className="py-6 items-center">
                  <Text className="text-[12px] text-dashboard-caption">
                    {t('analytics.chart.empty')}
                  </Text>
                </View>
              ) : (
                <>
                  {showMonthChart ? (
                    <MonthChart buckets={monthBuckets} />
                  ) : (
                    <WeeklyChart buckets={weekBuckets} />
                  )}
                </>
              )}
            </Card>

            {/* ── Status breakdown donut ─────────────────────────────────── */}
            <Card className="mb-4">
              <Text
                className="mb-4 text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                {t('analytics.statusBreakdown.title')}
              </Text>
              {total === 0 ? (
                <Text className="text-[12px] text-dashboard-caption">
                  {t('analytics.empty')}
                </Text>
              ) : (
                <View className="flex-row items-center gap-5">
                  <ProgressRing
                    size={88}
                    thickness={9}
                    trackColor={dashboardColors.bannerBorder}
                    segments={[
                      { value: summary.open, color: colors.primary },
                      { value: summary.progress, color: colors.accent },
                      { value: summary.resolved, color: colors.lime },
                    ]}
                  >
                    <Text
                      className="text-[20px] font-bold text-ink"
                      style={{ letterSpacing: -0.5 }}
                    >
                      {total}
                    </Text>
                    <Text className="text-[7px] font-medium uppercase text-dashboard-subtitle">
                      {t('analytics.statusBreakdown.total')}
                    </Text>
                  </ProgressRing>
                  <View className="flex-1 gap-2">
                    <StatusBreakdownRow
                      color={colors.primary}
                      label={t('analytics.statusBreakdown.open')}
                      count={summary.open}
                      total={total}
                    />
                    <StatusBreakdownRow
                      color={colors.accent}
                      label={t('analytics.statusBreakdown.inProgress')}
                      count={summary.progress}
                      total={total}
                    />
                    <StatusBreakdownRow
                      color={colors.lime}
                      label={t('analytics.statusBreakdown.resolved')}
                      count={summary.resolved}
                      total={total}
                    />
                    {summary.urgent > 0 ? (
                      <StatusBreakdownRow
                        color={dashboardColors.statCoralDeep}
                        label={t('analytics.statusBreakdown.urgent')}
                        count={summary.urgent}
                        total={total}
                        italic
                      />
                    ) : null}
                  </View>
                </View>
              )}
            </Card>

            {/* ── Urgency breakdown ──────────────────────────────────────── */}
            <Card className="mb-4">
              <Text
                className="mb-3 text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                {t('analytics.urgencyBreakdown.title')}
              </Text>
              {total === 0 ? (
                <Text className="text-[12px] text-dashboard-caption">
                  {t('analytics.empty')}
                </Text>
              ) : (
                <View className="gap-2">
                  {(['critical', 'high', 'medium', 'low'] as Urgency[]).map((u) => (
                    <UrgencyBreakdownRow
                      key={u}
                      urgency={u}
                      count={urgencyCounts[u]}
                      total={total}
                      t={t}
                    />
                  ))}
                </View>
              )}
            </Card>

            {/* ── Category breakdown ─────────────────────────────────────── */}
            <Card className="mb-4">
              <Text
                className="mb-3 text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                {t('analytics.categoryBreakdown.title')}
              </Text>
              {categoryRows.length === 0 ? (
                <Text className="text-[12px] text-dashboard-caption">
                  {t('analytics.empty')}
                </Text>
              ) : (
                <View className="gap-2">
                  {categoryRows.map((row) => (
                    <CategoryBreakdownRow
                      key={row.name}
                      name={row.name}
                      total={row.total}
                      resolved={row.resolved}
                      grandTotal={total}
                    />
                  ))}
                </View>
              )}
            </Card>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function WindowToggle({
  value,
  onChange,
}: {
  value: TimeWindow;
  onChange: (w: TimeWindow) => void;
}) {
  const { t } = useTranslation('common');
  return (
    <View className="flex-row overflow-hidden rounded-lg border border-dashboard-card-line bg-dashboard-card-bg">
      {WINDOWS.map((w) => {
        const active = w === value;
        return (
          <Pressable
            key={w}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(w)}
            className={`px-3 py-1.5 ${active ? 'bg-dashboard-pill-bg' : ''}`}
          >
            <Text
              className="text-[10px] font-semibold"
              style={{
                color: active ? dashboardColors.teal : dashboardColors.subtitle,
              }}
            >
              {t(`analytics.window.${w}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatusBreakdownRow({
  color,
  label,
  count,
  total,
  italic,
}: {
  color: string;
  label: string;
  count: number;
  total: number;
  italic?: boolean;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <View>
      <View className="mb-1 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <Text
            className="text-[11px] text-ink"
            style={{ fontStyle: italic ? 'italic' : 'normal' }}
          >
            {label}
          </Text>
        </View>
        <Text className="text-[11px] font-semibold text-ink">
          {count}
          <Text className="text-[9px] font-normal text-dashboard-caption">
            {' '}({pct}%)
          </Text>
        </Text>
      </View>
      {/* Bar */}
      <View className="h-1.5 overflow-hidden rounded-full bg-border">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

const URGENCY_COLORS: Record<Urgency, string> = {
  low: colors.lime,
  medium: colors.accent,
  high: dashboardColors.statCoralDeep,
  critical: '#b91c1c',
};

function UrgencyBreakdownRow({
  urgency,
  count,
  total,
  t,
}: {
  urgency: Urgency;
  count: number;
  total: number;
  t: (key: string) => string;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  const color = URGENCY_COLORS[urgency];
  return (
    <View>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-[11px] text-ink">{t(urgencyLabels[urgency])}</Text>
        <Text className="text-[11px] font-semibold text-ink">
          {count}
          <Text className="text-[9px] font-normal text-dashboard-caption">
            {' '}({pct}%)
          </Text>
        </Text>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-border">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

function CategoryBreakdownRow({
  name,
  total,
  resolved,
  grandTotal,
}: {
  name: string;
  total: number;
  resolved: number;
  grandTotal: number;
}) {
  const pct = grandTotal === 0 ? 0 : Math.round((total / grandTotal) * 100);
  const resolvedPct = total === 0 ? 0 : Math.round((resolved / total) * 100);
  return (
    <View>
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-[11px] font-medium text-ink" numberOfLines={1}>
          {humanize(name)}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-[9px] text-dashboard-caption">
            {resolvedPct}% resolved
          </Text>
          <Text className="text-[11px] font-semibold text-ink">
            {total}
            <Text className="text-[9px] font-normal text-dashboard-caption">
              {' '}({pct}%)
            </Text>
          </Text>
        </View>
      </View>
      <View className="h-1.5 overflow-hidden rounded-full bg-border">
        <View
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: dashboardColors.teal }}
        />
      </View>
    </View>
  );
}

/**
 * Condensed bar chart for a full calendar month. Renders every day as a
 * thin bar; label shown only for the 1st and 15th to avoid crowding.
 * Reuses the same `WeekBucket` stacked-bar logic as `WeeklyChart` but packs
 * more bars into the same space.
 */
function MonthChart({ buckets }: { buckets: DayBucket[] }) {
  const { t } = useTranslation('common');
  const totals = buckets.map((b) => b.values.reduce((s, v) => s + v, 0));
  const max = Math.max(1, ...totals);
  const BAR_HEIGHT = 72;

  return (
    <View>
      <View className="flex-row items-end justify-between">
        {buckets.map((bucket, index) => {
          const total = totals[index];
          const filled = Math.max(
            total === 0 ? 0 : 4,
            Math.round((total / max) * BAR_HEIGHT),
          );
          const showLabel = bucket.date.getDate() === 1 || bucket.date.getDate() === 15;
          return (
            <View key={bucket.date.toISOString()} className="flex-1 items-center">
              {showLabel ? (
                <Text className="mb-0.5 text-[8px] text-muted">{total > 0 ? total : ''}</Text>
              ) : null}
              <View
                style={{ height: BAR_HEIGHT }}
                className="w-2 justify-end overflow-hidden rounded-sm bg-border/50"
              >
                <View style={{ height: filled }} className="w-full">
                  <View style={{ flex: bucket.values[2], backgroundColor: colors.lime }} />
                  <View style={{ flex: bucket.values[1], backgroundColor: colors.accent }} />
                  <View style={{ flex: bucket.values[0], backgroundColor: colors.primary }} />
                </View>
              </View>
              {showLabel ? (
                <Text className="mt-1 text-[7px] text-muted">{bucket.label}</Text>
              ) : (
                <View className="mt-1 h-[9px]" />
              )}
            </View>
          );
        })}
      </View>
      <View className="mt-3 flex-row justify-center gap-4">
        <Legend color={colors.primary} label={t('components.weeklyChart.open')} />
        <Legend color={colors.accent} label={t('components.weeklyChart.inProgress')} />
        <Legend color={colors.lime} label={t('components.weeklyChart.resolved')} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ backgroundColor: color }} className="h-2 w-2 rounded-sm" />
      <Text className="text-[9px] text-muted">{label}</Text>
    </View>
  );
}
