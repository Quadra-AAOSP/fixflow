import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import {
  ArrowRight,
  ClipboardList,
  FileText,
  House,
  Plus,
  Search,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listReports } from '@/services/reports';
import { useCurrentSite } from '@/stores/site';
import type { Report, ReportStatus } from '@/types';
import { formatDate, humanize } from '@/utils/format';
import {
  REPORT_FILTERS,
  ReportFilter as FilterValue,
  effectiveUrgency,
  searchReports,
  statusGroup,
  urgencyLabels,
} from '@/utils/maintenance';

const FILTER_VALUES = REPORT_FILTERS.map((f) => f.value);

/**
 * Reports list. Mirrors the web's Reports tab
 * (`ReportsView.vue` + `components/dashboard/ReportTable.vue`)
 */
export default function ReportsScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const router = useRouter();
  const { user, logout } = useAuth();
  const {
    site,
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
      // A 401 means the session died under us — sign out rather than leave the
      // tab stuck on an error it can never clear.
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      setError(
        err instanceof ApiError ? err.message : t('reports.list.errors.couldNotLoad'),
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

  const siteName = useCallback(
    (id: number | null) =>
      id !== null && site && id === site.id ? site.name : `Site #${id ?? ''}`,
    [site],
  );

  const filtered = useMemo(
    // Newest first — matches the web's sort in `ReportsView.vue`.
    () =>
      searchReports(reports ?? [], query, siteName, filter).sort(
        (a, b) =>
          Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''),
      ),
    [reports, query, siteName, filter],
  );

  // The same five options the web renders in its "Status" select
  // (`ReportsView.vue`): All reports / Open / In progress / Resolved / Urgent.
  const filterSelectOptions = useMemo(
    () =>
      REPORT_FILTERS.map((option) => ({
        value: option.value,
        label: option.value === 'all' ? t('reports.list.allReports') : option.label,
      })),
    [t],
  );

  /*
   * The web keeps its `.dashboard-card` heading and filters visible while the
   * content area shows `.live-error` / loading inline — never a bare page. So
   * every state below renders inside the card's `ListEmptyComponent` instead
   * of short-circuiting the whole screen.
   */
  const canCreate = site != null && (user?.capabilities.createReport ?? false);
  const list = site != null && error === null ? filtered : [];

  return (
    <Screen className="px-0 pt-0">
      {/* The whole page sits in one white card — the web wraps the Reports
          tab in `.dashboard-card.live-page` (`ReportsView.vue`). */}
      <View className="flex-1 px-4 pt-3">
        <Card padded={false} className="flex-1 px-[13px] py-[18px]">
          <FlatList
            data={list}
            keyExtractor={(item) => String(item.id)}
            className="flex-1"
            contentContainerClassName="grow"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={
                  site != null
                    ? onRefresh
                    : () => {
                        void refreshSite();
                      }
                }
                tintColor={palette.primary}
              />
            }
            ListHeaderComponent={
              <ReportsHeader
                t={t}
                siteName={site?.name ?? ''}
                contractStatus={site?.contractStatus ?? null}
                canCreate={canCreate}
                onCreate={() => router.push('/reports/new')}
                query={query}
                onChangeQuery={setQuery}
                filter={filter}
                onChangeFilter={setFilter}
                filterOptions={filterSelectOptions}
                matchingCount={filtered.length}
                loaded={site != null && error === null && reports !== null}
              />
            }
            ItemSeparatorComponent={() => (
              <View className="h-px bg-dashboard-card-line" />
            )}
            ListEmptyComponent={
              site == null ? (
                siteLoading ? (
                  <StateView variant="loading" title={t('reports.list.loadingSite')} />
                ) : siteError != null ? (
                  <StateView
                    variant="error"
                    description={siteError.message}
                    actionLabel={t('reports.list.errors.retry')}
                    onAction={() => {
                      void refreshSite();
                    }}
                  />
                ) : (
                  <StateView
                    variant="empty"
                    icon={House}
                    title={t('reports.list.noSiteTitle')}
                    description={t('reports.list.noSiteDesc')}
                  />
                )
              ) : error !== null ? (
                <StateView
                  variant="error"
                  description={error}
                  actionLabel={t('reports.list.errors.retry')}
                  onAction={() => {
                    void load();
                  }}
                />
              ) : loading ? (
                <StateView variant="loading" title={t('reports.list.loadingReports')} />
              ) : (
                <StateView
                  variant="empty"
                  icon={reports && reports.length === 0 ? ClipboardList : Search}
                  title={
                    reports && reports.length === 0
                      ? t('reports.list.noReportsTitle')
                      : t('reports.list.noMatchesTitle')
                  }
                  description={
                    reports && reports.length === 0
                      ? t('reports.list.noReportsDesc')
                      : t('reports.list.noMatchesDesc')
                  }
                />
              )
            }
            renderItem={({ item }) => (
              <ReportRow
                t={t}
                report={item}
                siteName={siteName(item.siteId)}
                onPress={() => router.push(`/reports/${item.id}`)}
              />
            )}
          />
        </Card>
      </View>
    </Screen>
  );
}

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

type ReportsHeaderProps = {
  t: TranslateFn;
  siteName: string;
  contractStatus?: 'contracted' | 'uncontracted' | null;
  canCreate: boolean;
  onCreate: () => void;
  query: string;
  onChangeQuery: (q: string) => void;
  filter: FilterValue;
  onChangeFilter: (f: FilterValue) => void;
  filterOptions: { value: string; label: string }[];
  matchingCount: number;
  loaded: boolean;
};

/**
 * The card's top block: the `.card-heading` (title + site + "New report"),
 * then the search control, then the `.report-filters` row (a "Status"
 * select, the matching count, and the clear-search affordance).
 */
function ReportsHeader({
  t,
  siteName,
  contractStatus,
  canCreate,
  onCreate,
  query,
  onChangeQuery,
  filter,
  onChangeFilter,
  filterOptions,
  matchingCount,
  loaded,
}: ReportsHeaderProps) {
  return (
    <View className="mb-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className="text-[22px] font-semibold text-ink"
            style={{ letterSpacing: -0.7 }}
          >
            {t('reports.list.title')}
          </Text>
          <Text className="mt-0.5 text-[11px] text-dashboard-subtitle">
            {siteName}
            {contractStatus === 'contracted' ? (
              <>
                {' · '}
                <Text
                  className="font-semibold"
                  style={{ color: dashboardColors.statMintDeep }}
                >
                  {t('reports.list.contracted')}
                </Text>
              </>
            ) : contractStatus === 'uncontracted' ? (
              <>
                {' · '}
                <Text
                  className="font-semibold"
                  style={{ color: dashboardColors.statCitronDeep }}
                >
                  {t('reports.list.uncontracted')}
                </Text>
              </>
            ) : null}
          </Text>
        </View>
        {canCreate ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('reports.list.newReport')}
            onPress={onCreate}
            className="flex-row items-center gap-2 rounded-[11px] border px-3.5 py-2.5 active:opacity-90"
            style={{
              backgroundColor: dashboardColors.ctaBg,
              borderColor: dashboardColors.ctaBorder,
            }}
          >
            <Plus color={dashboardColors.ctaText} size={17} strokeWidth={2.4} />
            <Text
              className="text-[13px] font-semibold"
              style={{ color: dashboardColors.ctaText }}
            >
              {t('reports.list.newReport')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View className="mb-3 mt-3">
        <SearchField
          value={query}
          onChangeText={onChangeQuery}
          placeholder={t('reports.list.searchPlaceholder')}
        />
      </View>

      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
        <Picker
          label={t('reports.list.status')}
          value={filter}
          options={filterOptions}
          onChange={(value) => onChangeFilter(value as FilterValue)}
          renderTrigger={({ selected, open, disabled }) => (
            <View className="flex-row items-center gap-2.5">
              <Text className="text-[12px] text-dashboard-subtitle">{t('reports.list.status')}</Text>
              <Pressable
                onPress={open}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={t('reports.list.status')}
                accessibilityState={{ disabled }}
                className="flex-row items-center gap-2 rounded-[7px] border border-dashboard-card-line bg-card px-2.5 py-1.5 active:opacity-80"
              >
                <Text className="text-[12px] text-ink">
                  {selected ? selected.label : t('reports.list.allReports')}
                </Text>
                <Text className="text-[10px] text-dashboard-caption">▾</Text>
              </Pressable>
            </View>
          )}
        />
        {loaded ? (
          <Text className="text-[12px] text-dashboard-subtitle">
            {t('reports.list.matchingCount', {
              count: matchingCount,
              plural: matchingCount === 1 ? '' : 's',
            })}
          </Text>
        ) : null}
        {query ? (
          <View className="flex-row items-center gap-1.5">
            <Text className="text-[12px] text-dashboard-subtitle">
              {t('reports.list.searching', { query })}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reports.list.clearSearch')}
              onPress={() => onChangeQuery('')}
              className="active:opacity-70"
            >
              <Text className="text-[12px] font-medium text-dashboard-teal underline">
                {t('reports.list.clearSearch')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One `.report-table` row. The web's columns (Report / Site / Created /
 * Assignee / Status / Urgency) are stacked onto a phone-width row: the
 * status-tinted glyph, the report description with its "#id · category"
 * line, a status badge + effective urgency, then the meta line and the arrow.
 */
function ReportRow({
  t,
  report,
  siteName,
  onPress,
}: {
  t: TranslateFn;
  report: Report;
  siteName: string;
  onPress: () => void;
}) {
  const urgency = effectiveUrgency(report);
  const assignee =
    report.assignedTechnicianId == null
      ? t('reports.list.assigneeUnassigned')
      : t('reports.list.assigneeTechnicianId', { id: report.assignedTechnicianId });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${report.description}`}
      className="flex-row items-start gap-2.5 py-3 active:opacity-80"
    >
      <ReportStatusIcon status={report.status} />
      <View className="flex-1">
        <Text className="text-[12px] font-semibold text-ink" numberOfLines={1}>
          {report.description}
        </Text>
        <Text className="mt-0.5 text-[9px] text-dashboard-caption">
          #{report.id} · {humanize(report.category)}
        </Text>
        <View className="mt-1.5 flex-row items-center gap-2">
          <StatusBadge status={report.status} />
          <Text className="text-[10px] text-dashboard-subtitle">
            {urgencyLabels[urgency]} {t('reports.list.urgencySuffix')}
          </Text>
        </View>
        <Text
          className="mt-1.5 text-[10px] text-dashboard-subtitle"
          numberOfLines={1}
        >
          {siteName} · {formatDate(report.createdAt)} · {assignee}
        </Text>
      </View>
      <ArrowRight
        color={dashboardColors.subtitle}
        size={16}
        strokeWidth={1.6}
      />
    </Pressable>
  );
}

/**
 * The web's `.report-small-icon`: a 29px disc tinted by the status group
 * (`statusTone()`), wrapping a file glyph — the leading icon in every
 * `.report-table` row.
 */
function ReportStatusIcon({ status }: { status: ReportStatus }) {
  const tone = {
    open: { disc: 'bg-coral-bg', icon: dashboardColors.statCoralDeep },
    progress: { disc: 'bg-mint-bg', icon: dashboardColors.statMintDeep },
    resolved: { disc: 'bg-citron-bg', icon: dashboardColors.statCitronDeep },
  }[statusGroup(status)];

  return (
    <View
      className={`h-[29px] w-[29px] items-center justify-center rounded-full ${tone.disc}`}
    >
      <FileText color={tone.icon} size={16} strokeWidth={1.7} />
    </View>
  );
}
