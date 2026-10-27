import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import {
  ArrowRight,
  ClipboardList,
  FileText,
  House,
  Plus,
  Search,
  Sparkles,
  X,
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
import { searchReportsNl } from '@/services/searchNl';
import { useCurrentSite } from '@/stores/site';
import type { NlSearchFilters, Report, ReportStatus } from '@/types';
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

  // A3 smart search: structured filters parsed from a natural-language query.
  const [nlFilters, setNlFilters] = useState<NlSearchFilters | null>(null);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askQuery, setAskQuery] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

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
      searchReports(reports ?? [], query, siteName, filter, nlFilters).sort(
        (a, b) =>
          Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''),
      ),
    [reports, query, siteName, filter, nlFilters],
  );

  async function onAskSubmit() {
    if (!site || !askQuery.trim() || askLoading) return;
    setAskLoading(true);
    setAskError(null);
    try {
      const result = await searchReportsNl(site.id, askQuery.trim());
      const hasAny =
        result.filters.status ||
        result.filters.category ||
        result.filters.urgency ||
        result.filters.from ||
        result.filters.to ||
        result.filters.text;
      setNlFilters(hasAny ? result.filters : null);
      setInterpretation(result.interpretation);
      if (result.filters.text) {
        // Let the NL `text` act as the free-text query too, so haystack
        // matching still applies alongside the structured filters.
        setQuery(result.filters.text);
      }
      setAskOpen(false);
      setAskQuery('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      setAskError(
        err instanceof ApiError
          ? err.message
          : t('reports.list.nl.error'),
      );
    } finally {
      setAskLoading(false);
    }
  }

  function clearNlChip(key: keyof NlSearchFilters) {
    setNlFilters((prev) => {
      if (!prev) return null;
      const next = { ...prev, [key]: null };
      const remaining =
        next.status || next.category || next.urgency || next.from || next.to || next.text;
      return remaining ? next : null;
    });
  }

  function clearAllNl() {
    setNlFilters(null);
    setInterpretation(null);
  }

  // The same five options the web renders in its "Status" select
  // (`ReportsView.vue`): All reports / Open / In progress / Resolved / Urgent.
  // Ops roles additionally get the triage-focused "Unassigned" and "To confirm"
  // filters — reporters and technicians have no business filtering by those.
  const isOps =
    user?.role === 'admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'staff';
  const filterSelectOptions = useMemo(
    () =>
      REPORT_FILTERS
        .filter(
          (option) =>
            isOps || (option.value !== 'unassigned' && option.value !== 'confirmation'),
        )
        .map((option) => ({
          value: option.value,
          label: option.value === 'all' ? t('reports.list.allReports') : t(option.labelKey),
        })),
    [isOps, t],
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
                nlFilters={nlFilters}
                interpretation={interpretation}
                onOpenAsk={() => { setAskError(null); setAskOpen(true); }}
                onClearNlChip={clearNlChip}
                onClearAllNl={clearAllNl}
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
      <AskModal
        visible={askOpen}
        query={askQuery}
        onChangeQuery={setAskQuery}
        loading={askLoading}
        error={askError}
        t={t}
        onClose={() => setAskOpen(false)}
        onSubmit={onAskSubmit}
      />
    </Screen>
  );
}

/** The natural-language search entry — a small modal above the reports list. */
function AskModal({
  visible,
  query,
  onChangeQuery,
  loading,
  error,
  t,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  query: string;
  onChangeQuery: (q: string) => void;
  loading: boolean;
  error: string | null;
  t: TranslateFn;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('components.modalSheet.close')}
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/40 px-6"
      >
        <View className="w-full rounded-[14px] bg-card p-4">
          <View className="mb-2 flex-row items-center gap-1.5">
            <Sparkles color={dashboardColors.statMintDeep} size={14} />
            <Text className="text-[15px] font-semibold text-ink">
              {t('reports.list.nl.title')}
            </Text>
          </View>
          <Text className="mb-2 text-[11px] leading-[1.6] text-dashboard-subtitle">
            {t('reports.list.nl.intro')}
          </Text>
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder={t('reports.list.nl.placeholder')}
            placeholderTextColor={dashboardColors.subtitle}
            multiline
            numberOfLines={3}
            autoFocus
            editable={!loading}
            className="min-h-[64px] rounded-[10px] border border-border px-3 py-2 text-[13px] text-ink"
            onSubmitEditing={onSubmit}
          />
          {error ? (
            <Text className="mt-1.5 text-[11px] leading-[1.6] text-tone-danger">
              {error}
            </Text>
          ) : null}
          <View className="mt-3 flex-row justify-end gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('components.modalSheet.close')}
              onPress={onClose}
              className="rounded-[9px] px-3 py-2 active:opacity-80"
            >
              <Text className="text-[12px] font-medium text-ink">
                {t('components.modalSheet.close')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reports.list.nl.search')}
              onPress={onSubmit}
              disabled={loading || !query.trim()}
              className="rounded-[9px] px-3 py-2 active:opacity-80"
              style={{ backgroundColor: dashboardColors.ctaBg }}
            >
              <Text
                className="text-[12px] font-semibold"
                style={{ color: dashboardColors.ctaText }}
              >
                {loading ? t('reports.list.nl.thinking') : t('reports.list.nl.search')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
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
  nlFilters: NlSearchFilters | null;
  interpretation: string | null;
  onOpenAsk: () => void;
  onClearNlChip: (key: keyof NlSearchFilters) => void;
  onClearAllNl: () => void;
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
  nlFilters,
  interpretation,
  onOpenAsk,
  onClearNlChip,
  onClearAllNl,
}: ReportsHeaderProps) {
  const chips = useMemo(() => {
    if (!nlFilters) return [];
    const items: { key: keyof NlSearchFilters; label: string }[] = [];
    if (nlFilters.status) items.push({ key: 'status', label: t(`labels.status.${nlFilters.status}`) });
    if (nlFilters.category) items.push({ key: 'category', label: humanize(nlFilters.category) });
    if (nlFilters.urgency) items.push({ key: 'urgency', label: t(urgencyLabels[nlFilters.urgency]) });
    if (nlFilters.from) items.push({ key: 'from', label: t('reports.list.nl.chipFrom', { date: nlFilters.from }) });
    if (nlFilters.to) items.push({ key: 'to', label: t('reports.list.nl.chipTo', { date: nlFilters.to }) });
    return items;
  }, [nlFilters, t]);
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

      <View className="mb-3 mt-3 flex-row items-center gap-2">
        <SearchField
          value={query}
          onChangeText={onChangeQuery}
          placeholder={t('reports.list.searchPlaceholder')}
          className="flex-1"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reports.list.nl.open')}
          onPress={onOpenAsk}
          className="flex-row items-center gap-1 rounded-[8px] border px-2.5 py-2 active:opacity-80"
          style={{
            borderColor: dashboardColors.statMintDeep,
          }}
        >
          <Sparkles color={dashboardColors.statMintDeep} size={13} />
          <Text
            className="text-[11px] font-semibold"
            style={{ color: dashboardColors.statMintDeep }}
          >
            {t('reports.list.nl.open')}
          </Text>
        </Pressable>
      </View>

      {nlFilters ? (
        <View className="mb-3">
          {interpretation ? (
            <Text className="mb-1.5 text-[10px] italic text-dashboard-subtitle">
              {t('reports.list.nl.interpreted', { interpretation })}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <View
                key={chip.key}
                className="flex-row items-center gap-1 rounded-full px-2 py-1"
                style={{ backgroundColor: dashboardColors.statMintSoft }}
              >
                <Text
                  className="text-[10px] font-medium"
                  style={{ color: dashboardColors.statMintDeep }}
                >
                  {chip.label}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('reports.list.nl.removeChip')}
                  onPress={() => onClearNlChip(chip.key)}
                  className="ml-0.5"
                >
                  <X color={dashboardColors.statMintDeep} size={11} strokeWidth={2.5} />
                </Pressable>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reports.list.nl.clearAll')}
              onPress={onClearAllNl}
              className="ml-1"
            >
              <Text className="text-[10px] font-medium text-dashboard-teal underline">
                {t('reports.list.nl.clearAll')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

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
      accessibilityLabel={t('reports.list.openA11y', {
        description: report.description,
      })}
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
            {t(urgencyLabels[urgency])} {t('reports.list.urgencySuffix')}
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
