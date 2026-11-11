import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  BellRing,
  Check,
  ClipboardCheck,
  Globe,
  MapPin,
  RefreshCw,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { toErrorMessage } from '@/lib/apiClient';
import { notifySiteAdmin, searchReportsPage } from '@/services/reports';
import { useCurrentSite } from '@/stores/site';
import type { Report } from '@/types';
import { relativeTime } from '@/utils/format';

const PAGE_SIZE = 20;

type Mode = 'all' | 'unattended';

/**
 * Super-admin oversight queue: every report on the platform, not just the
 * current site. The point of the screen is the "unattended" mode — reports
 * that nobody has picked up yet — plus a one-tap way to notify that site's
 * administrators, so a stalled report cannot sit unnoticed.
 */
export default function AllReportsScreen() {
  const { user } = useAuth();
  const { sites } = useCurrentSite();
  const palette = themeColors();
  const router = useRouter();
  const { t } = useTranslation('common');

  const isSuperAdmin = user?.role === 'super_admin';

  const [mode, setMode] = useState<Mode>('unattended');
  const [siteId, setSiteId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [text, setText] = useState('');

  const [reports, setReports] = useState<Report[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [notified, setNotified] = useState<Record<number, true>>({});
  const [notifyingId, setNotifyingId] = useState<number | null>(null);

  const generation = useRef(0);

  // Debounce typing so the server isn't hit on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setText(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const siteNames = useMemo(() => {
    const map = new Map<number, string>();
    sites.forEach((site) => map.set(site.id, site.name));
    return map;
  }, [sites]);

  const siteName = useCallback(
    (id: number | null) =>
      (id === null ? undefined : siteNames.get(id)) ??
      t('more.allReports.unknownSite'),
    [siteNames, t],
  );

  const load = useCallback(
    async (targetPage: number) => {
      const gen = ++generation.current;
      if (targetPage === 0) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const result = await searchReportsPage({
          siteId,
          filters: {
            ...(mode === 'unattended' ? { unattended: true } : {}),
            ...(text ? { text } : {}),
          },
          page: targetPage,
          size: PAGE_SIZE,
        });
        if (gen !== generation.current) return;
        setReports((prev) =>
          targetPage === 0 ? result.content : [...(prev ?? []), ...result.content],
        );
        setPage(targetPage);
        setHasMore(result.hasMore);
      } catch (err) {
        if (gen !== generation.current) return;
        setError(toErrorMessage(err, { fallback: t('more.allReports.loadFailed') }));
      } finally {
        if (gen === generation.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [mode, siteId, text, t],
  );

  useEffect(() => {
    if (!isSuperAdmin) return;
    void load(0);
  }, [isSuperAdmin, load]);

  async function onRefresh() {
    setRefreshing(true);
    await load(0);
  }

  function askToNotify(report: Report) {
    Alert.alert(
      t('more.allReports.notifyTitle'),
      t('more.allReports.notifyMessage', {
        id: report.id,
        site: siteName(report.siteId),
      }),
      [
        { text: t('more.allReports.cancel'), style: 'cancel' },
        {
          text: t('more.allReports.notify'),
          onPress: () => {
            void sendNotice(report);
          },
        },
      ],
    );
  }

  async function sendNotice(report: Report) {
    setNotifyingId(report.id);
    setNotice(null);
    try {
      const result = await notifySiteAdmin(report.id);
      setNotified((prev) => ({ ...prev, [report.id]: true }));
      setNotice({
        tone: 'ok',
        text: t('more.allReports.notifySuccess', {
          count: result.recipients,
          site: result.siteName,
          plural: result.recipients === 1 ? '' : 's',
        }),
      });
    } catch (err) {
      setNotice({
        tone: 'error',
        text: toErrorMessage(err, { fallback: t('more.allReports.notifyFailed') }),
      });
    } finally {
      setNotifyingId(null);
    }
  }

  if (!isSuperAdmin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('more.allReports.title') }} />
        <StateView
          variant="empty"
          icon={Globe}
          title={t('more.allReports.deniedTitle')}
          description={t('more.allReports.deniedDesc')}
        />
      </Screen>
    );
  }

  const siteOptions = [
    { value: 'all', label: t('more.allReports.allSites') },
    ...sites.map((site) => ({ value: String(site.id), label: site.name })),
  ];

  const unattendedCount = (reports ?? []).filter(isUnattended).length;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('more.allReports.title') }} />
      <ScrollView
        contentContainerClassName="px-5 pb-12 pt-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={palette.primary}
          />
        }
      >
        <PageHeader
          kicker={t('more.allReports.kicker')}
          title={t('more.allReports.title')}
          subtitle={t('more.allReports.subtitle')}
          icon={Globe}
        >
          <View className="flex-row flex-wrap items-center gap-2">
            <Pill
              tone={mode === 'unattended' ? 'citron' : 'mint'}
              label={
                mode === 'unattended'
                  ? t('more.allReports.pillUnattended', { count: unattendedCount })
                  : t('more.allReports.pillAll', { count: reports?.length ?? 0 })
              }
            />
            <Pill
              tone="neutral"
              label={
                siteId === null
                  ? t('more.allReports.allSites')
                  : siteName(siteId)
              }
            />
          </View>
        </PageHeader>

        <Card className="mb-4">
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value)}
            options={[
              { value: 'unattended', label: t('more.allReports.modeUnattended') },
              { value: 'all', label: t('more.allReports.modeAll') },
            ]}
          />
          <Text className="mb-3 mt-2 text-[10px] leading-[1.6] text-dashboard-caption">
            {mode === 'unattended'
              ? t('more.allReports.unattendedHint')
              : t('more.allReports.allHint')}
          </Text>

          <Picker
            label={t('more.allReports.siteLabel')}
            value={siteId === null ? 'all' : String(siteId)}
            onChange={(value) => setSiteId(value === 'all' ? null : Number(value))}
            options={siteOptions}
          />

          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t('more.allReports.searchPlaceholder')}
          />
        </Card>

        {notice ? (
          <View
            className="mb-3 flex-row items-start gap-2 rounded-lg px-3 py-2.5"
            style={{
              backgroundColor:
                notice.tone === 'ok'
                  ? dashboardColors.statMintSoft
                  : dashboardColors.errorBg,
            }}
          >
            {notice.tone === 'ok' ? (
              <Check color={dashboardColors.statMintDeep} size={14} />
            ) : (
              <X color={dashboardColors.errorText} size={14} />
            )}
            <Text
              accessibilityLiveRegion="polite"
              className="flex-1 text-[11px] leading-[1.65]"
              style={{
                color:
                  notice.tone === 'ok'
                    ? dashboardColors.statMintDeep
                    : dashboardColors.errorText,
              }}
            >
              {notice.text}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('more.allReports.dismiss')}
              onPress={() => setNotice(null)}
              className="p-0.5 active:opacity-70"
            >
              <X
                color={
                  notice.tone === 'ok'
                    ? dashboardColors.statMintDeep
                    : dashboardColors.errorText
                }
                size={12}
              />
            </Pressable>
          </View>
        ) : null}

        {error ? (
          <StateView
            variant="error"
            description={error}
            actionLabel={t('more.allReports.retry')}
            onAction={() => void load(0)}
          />
        ) : loading && reports === null ? (
          <StateView variant="loading" title={t('more.allReports.loading')} />
        ) : (reports ?? []).length === 0 ? (
          <StateView
            variant="empty"
            icon={ClipboardCheck}
            title={
              mode === 'unattended'
                ? t('more.allReports.emptyUnattendedTitle')
                : t('more.allReports.emptyAllTitle')
            }
            description={
              mode === 'unattended'
                ? t('more.allReports.emptyUnattendedDesc')
                : t('more.allReports.emptyAllDesc')
            }
          />
        ) : (
          <>
            {(reports ?? []).map((report) => {
              const unattended = isUnattended(report);
              const busy = notifyingId === report.id;
              const alreadyNotified = notified[report.id] === true;
              return (
                <Card key={report.id} className="mb-3">
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push(`/reports/${report.id}`)}
                    className="active:opacity-80"
                  >
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-1 flex-row items-center gap-1.5">
                        <MapPin color={dashboardColors.statMintDeep} size={12} />
                        <Text
                          className="flex-1 text-[11px] font-semibold text-dashboard-teal"
                          numberOfLines={1}
                        >
                          {siteName(report.siteId)}
                        </Text>
                      </View>
                      <StatusBadge status={report.status} />
                    </View>

                    <Text
                      className="mt-1.5 text-[13px] leading-[1.6] text-ink"
                      numberOfLines={3}
                    >
                      {report.description}
                    </Text>

                    <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
                      <UrgencyChip level={report.policy.effectiveUrgency} />
                      <Pill tone="neutral" label={report.category} />
                      <Text className="text-[10px] text-dashboard-caption">
                        #{report.id} · {relativeTime(report.createdAt)}
                      </Text>
                    </View>
                  </Pressable>

                  {unattended ? (
                    <View className="mt-3 flex-row items-center gap-2 border-t border-dashboard-card-line pt-2.5">
                      <BellRing color={dashboardColors.statCitronDeep} size={13} />
                      <Text className="flex-1 text-[10px] leading-[1.55] text-dashboard-caption">
                        {t('more.allReports.noAssignee')}
                      </Text>
                      {alreadyNotified ? (
                        <Pill tone="mint" label={t('more.allReports.notified')} />
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ disabled: busy }}
                          disabled={busy}
                          onPress={() => askToNotify(report)}
                          className="flex-row items-center gap-1 rounded-full border px-2.5 py-1.5 active:opacity-80"
                          style={{
                            borderColor: dashboardColors.ctaBorder,
                            backgroundColor: dashboardColors.ctaBg,
                            opacity: busy ? 0.55 : 1,
                          }}
                        >
                          <BellRing color={dashboardColors.ctaText} size={11} />
                          <Text
                            className="text-[10.5px] font-semibold"
                            style={{ color: dashboardColors.ctaText }}
                          >
                            {busy
                              ? t('more.allReports.notifying')
                              : t('more.allReports.notifySiteAdmin')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ) : null}
                </Card>
              );
            })}

            {hasMore ? (
              <Button
                className="mt-1"
                variant="secondary"
                label={
                  loadingMore
                    ? t('more.allReports.loadingMore')
                    : t('more.allReports.loadMore')
                }
                loading={loadingMore}
                disabled={loadingMore}
                onPress={() => void load(page + 1)}
              />
            ) : (
              <View className="mt-2 flex-row items-center justify-center gap-1.5">
                <RefreshCw color={dashboardColors.caption} size={11} />
                <Text className="text-[10px] text-dashboard-caption">
                  {t('more.allReports.endOfList')}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** No assignee and still in a state that expects a first response. */
function isUnattended(report: Report): boolean {
  return (
    report.assignedTechnicianId === null &&
    ['open', 'routed', 'escalated', 'reopened'].includes(report.status)
  );
}
