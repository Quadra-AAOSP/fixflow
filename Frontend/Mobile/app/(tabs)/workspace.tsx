import { useFocusEffect, useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Briefcase,
  Handshake,
  UserRound,
  Wrench,
} from 'lucide-react-native';

import { HomeNotificationBell } from '@/components/dashboard/HomeNotificationBell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SiteSwitcher } from '@/components/ui/SiteSwitcher';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { useToast } from '@/components/ui/useToastContext';
import { TradeProfile } from '@/components/technician/TradeProfile';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { claimReport, listReports } from '@/services/reports';
import { listTechnicianContracts } from '@/services/technician';
import { useTechnicianAvailability } from '@/stores/availability';
import { useCurrentSite } from '@/stores/site';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import type { Report } from '@/types';
import { humanize } from '@/utils/format';
import { effectiveUrgency, isClaimable, statusGroup } from '@/utils/maintenance';

/**
 * Landing page for `technician` accounts. Mirrors `TechnicianView.vue`:
 *   - Welcome banner (cream background, large Wrench)
 *   - `TradeProfile` component (technician's trade + specialty + proficiency)
 *   - Two info cards in a grid: "Independent by default" / "Work with a site"
 *   - "Assigned work" card with the count of reports assigned to this user
 *
 * Reporting (filing new issues) is a tenant-side action; technicians don't
 * file, they resolve. Hence the absence of a "New report" FAB.
 */
export default function WorkspaceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const { site, sites } = useCurrentSite();
  const {
    available,
    loading: availabilityLoading,
  } = useTechnicianAvailability();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Contract-site names for the open jobs preview (technicians usually have no
  // account site, so names cannot be resolved from the site directory alone).
  const [siteNames, setSiteNames] = useState<Record<number, string>>({});
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      // Technicians usually have no account site, so their work comes from the
      // sites they hold contracts with. Fan out across those sites and merge.
      const contracts = await listTechnicianContracts();
      setSiteNames(
        Object.fromEntries(contracts.map((contract) => [contract.siteId, contract.siteName])),
      );
      const siteIds = Array.from(
        new Set([
          ...contracts.map((contract) => contract.siteId),
          ...(site ? [site.id] : []),
        ]),
      );
      const pages = await Promise.all(
        siteIds.map((siteId) => listReports({ siteId })),
      );
      const merged = new Map<number, Report>();
      for (const report of pages.flat()) merged.set(report.id, report);
      setReports(Array.from(merged.values()));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('home.errors.couldNotLoad'),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useRealtimeEvents(
    site ? `/sites/${site.id}/events` : null,
    useCallback(() => {
      void load();
    }, [load]),
    { enabled: user !== null },
  );

  const myAssignments = (reports ?? []).filter(
    (report) =>
      report.policy.inAssignmentQueue,
  );

  const openJobs = (reports ?? []).filter(isClaimable);

  async function onClaim(id: number) {
    if (claimingId !== null) return;
    setClaimingId(id);
    try {
      await claimReport(id);
      showToast(t('openJobs.claimed'), 'success');
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : t('openJobs.claimFailed'),
        'error',
      );
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <HomeNotificationBell />
        {/* Welcome banner — mirrors the web's `.welcome-banner` block
            inside `TechnicianView.vue`, with a large Wrench on the right. */}
        <View
          className="mb-4 flex-row items-center gap-3 rounded-2xl border bg-dashboard-banner-bg px-4 py-4"
          style={{ borderColor: dashboardColors.bannerBorder, minHeight: 110 }}
        >
          <View className="flex-1">
            <Text
              className="text-[22px] font-semibold leading-tight text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              {t('workspace.title')}
              {user?.firstName ? `, ${user.firstName}` : ''}
            </Text>
            <Text className="mt-1 text-[14px] text-dashboard-banner-subtitle">
              {t('workspace.subtitle')}
            </Text>
            {!availabilityLoading ? (
              <View
                className="mt-2 flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: available
                    ? dashboardColors.statMintSoft
                    : dashboardColors.statCitronSoft,
                }}
              >
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: available
                      ? dashboardColors.statMintDeep
                      : dashboardColors.statCitronDeep,
                  }}
                />
                <Text
                  className="text-[10px] font-semibold"
                  style={{
                    color: available
                      ? dashboardColors.statMintDeep
                      : dashboardColors.statCitronDeep,
                  }}
                >
                  {t(
                    available
                      ? 'workspace.availability.available'
                      : 'workspace.availability.unavailable',
                  )}
                </Text>
              </View>
            ) : null}
            <SiteSwitcher />
          </View>
          <Wrench color={dashboardColors.statMintDeep} size={42} strokeWidth={1.6} />
        </View>

        {/* Trade profile — direct child of the page on the web. */}
        <Text
          className="mb-2 text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('workspace.tradeProfile')}
        </Text>
        <TradeProfile />

        {/* Two info cards in a grid — mirrors the web's `.technician-grid`. */}
        <Text
          className="mb-2 mt-4 text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('workspace.howAccountWorks')}
        </Text>
        <View className="flex-row gap-2">
          <InfoCard
            icon={UserRound}
            tone="mint"
            title={t('workspace.info.independentTitle')}
            body={t('workspace.info.independentBody')}
            actionLabel={t('workspace.info.independentAction')}
            onPress={() => router.push('/profile')}
          />
          <InfoCard
            icon={Handshake}
            tone="citron"
            title={t('workspace.info.siteTitle')}
            body={t('workspace.info.siteBody')}
            actionLabel={t('workspace.info.siteAction')}
            onPress={() => router.push('/more/contracts')}
          />
        </View>

        {/* Open jobs — unassigned reports at the technician's contract sites. */}
        <Text
          className="mb-2 mt-4 text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('workspace.openJobs')}
        </Text>
        <Card className="mb-4">
          <View className="flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: dashboardColors.statMintSoft }}
            >
              <Briefcase
                color={dashboardColors.statMintDeep}
                size={24}
                strokeWidth={1.7}
              />
            </View>
            <View className="flex-1">
              <Text
                className="text-[22px] font-semibold text-ink"
                style={{ letterSpacing: -0.5 }}
              >
                {reports === null ? '—' : openJobs.length}
              </Text>
              <Text className="mt-0.5 text-[11px] leading-[1.6] text-dashboard-subtitle">
                {reports === null
                  ? t('workspace.openJobsLoading')
                  : openJobs.length === 0
                    ? t('workspace.openJobsEmpty')
                    : t('workspace.openJobsSummary', {
                        count: openJobs.length,
                        plural: openJobs.length === 1 ? '' : 's',
                      })}
              </Text>
            </View>
          </View>
          {/* Unassigned reports at the technician's contract sites. Claiming
              flips the report to `assigned`, so it leaves this list on reload. */}
          {openJobs.length > 0 ? (
            <View className="mt-3">
              {openJobs.slice(0, 3).map((report) => (
                <View
                  key={report.id}
                  className="mb-2 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3"
                >
                  <Pressable
                    onPress={() => router.push(`/reports/${report.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={t('assignments.openA11y', {
                      description: report.description,
                    })}
                    className="active:opacity-80"
                  >
                    <View className="mb-1 flex-row items-center justify-between">
                      <Text
                        className="text-[10px] font-medium uppercase tracking-wide text-dashboard-subtitle"
                        numberOfLines={1}
                      >
                        {humanize(report.category)}
                      </Text>
                      <StatusBadge status={report.status} />
                    </View>
                    <Text className="text-[12px] text-ink" numberOfLines={2}>
                      {report.description}
                    </Text>
                    <View className="mt-2 flex-row items-center justify-between gap-2">
                      <UrgencyChip level={effectiveUrgency(report)} />
                      <Text
                        className="flex-1 text-right text-[10px] text-dashboard-subtitle"
                        numberOfLines={1}
                      >
                        {report.siteId === null ? '' : siteNames[report.siteId] ?? ''}
                      </Text>
                    </View>
                  </Pressable>
                  <Button
                    variant="cta"
                    className="mt-2 min-h-0 py-2"
                    label={
                      claimingId === report.id
                        ? t('openJobs.claiming')
                        : t('openJobs.claim')
                    }
                    loading={claimingId === report.id}
                    disabled={claimingId !== null}
                    onPress={() => void onClaim(report.id)}
                  />
                </View>
              ))}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/technician/open-jobs')}
            className="mt-1 flex-row items-center gap-1 self-start active:opacity-70"
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: dashboardColors.teal }}
            >
              {t('workspace.viewOpenJobs')}
            </Text>
            <ArrowRight color={dashboardColors.teal} size={13} />
          </Pressable>
        </Card>

        {/* Assigned work — mirrors the web's bottom `.dashboard-card`. */}
        <Text
          className="mb-2 mt-4 text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('workspace.assignedWork')}
        </Text>
        <Card className="mb-4">
          {reports === null ? (
            <StateView variant="loading" title={t('assignments.loading')} />
          ) : error ? (
            <StateView
              variant="error"
              title={t('workspace.couldNotLoadAssignments')}
              description={error}
              actionLabel={t('workspace.retry')}
              onAction={() => {
                void load();
              }}
              className="py-3"
            />
          ) : (
            <>
              <Text className="text-[12px] leading-[1.7] text-dashboard-subtitle">
                {t('workspace.assignedSummary', {
                  count: myAssignments.length,
                  plural: myAssignments.length === 1 ? '' : 's',
                  site: site ? t('workspace.atSite', { site: site.name }) : '',
                })}
              </Text>
              {myAssignments.length === 0 ? (
                <Pressable accessibilityRole="link" onPress={() => router.push('/more/marketplace')} className="mt-2">
                  <Text className="text-[12px] font-semibold text-ink">{t('marketplace.title')}</Text>
                </Pressable>
              ) : (
                <View className="mt-3">
                  {myAssignments.slice(0, 3).map((report) => (
                    <Pressable
                      key={report.id}
                      onPress={() => router.push(`/reports/${report.id}`)}
                      accessibilityRole="button"
                      className="mb-2 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3 active:opacity-80"
                    >
                      <View className="mb-1 flex-row items-center justify-between">
                        <Text
                          className="text-[10px] font-medium uppercase tracking-wide text-dashboard-subtitle"
                          numberOfLines={1}
                        >
                          {report.category}
                        </Text>
                        <StatusBadge status={report.status} />
                      </View>
                      <Text
                        className="text-[12px] text-ink"
                        numberOfLines={2}
                      >
                        {report.description}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {/* The web always links to /assignments once reports are
                  loaded (`TechnicianView.vue`), regardless of count. */}
              <Pressable
                onPress={() => router.push('/assignments')}
                accessibilityRole="link"
                className="mt-1 flex-row items-center gap-1 self-start active:opacity-70"
              >
                <Text
                  className="text-[11px] font-semibold"
                  style={{ color: dashboardColors.teal }}
                >
                  {t('workspace.viewAssignments')}
                </Text>
                <ArrowRight color={dashboardColors.teal} size={13} />
              </Pressable>
            </>
          )}
        </Card>

        {/* Quick links — a mobile-only shortcut card (the web has no
            equivalent section; its navigation lives in the sidebar). */}
        <Text
          className="mb-2 text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('workspace.quickLinks')}
        </Text>
        <Card padded={false} className="mb-6">
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/technician/terms')}
            className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
          >
            <View className="flex-1 pr-3">
              <Text className="text-[13px] font-semibold text-ink">
                {t('workspace.terms')}
              </Text>
              <Text className="mt-0.5 text-[11px] text-dashboard-subtitle">
                {t('workspace.termsHint')}
              </Text>
            </View>
            <ArrowRight color={dashboardColors.subtitle} size={16} />
          </Pressable>

          <View className="mx-4 border-t border-dashboard-card-line" />
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/more/my-verification')}
            className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
          >
            <Text className="flex-1 pr-3 text-[13px] font-semibold text-ink">
              {t('review.myVerification')}
            </Text>
            <ArrowRight color={dashboardColors.subtitle} size={16} />
          </Pressable>
        </Card>
        {/* Sites link is web-only; mirror it in the quick links so the
            page is symmetrical with the web's footer link. */}
        {sites.length > 1 ? (
          <Card padded={false} className="mb-6">
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/more/sites')}
              className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
            >
              <View className="flex-1 pr-3">
                <Text className="text-[13px] font-semibold text-ink">
                  {t('workspace.switchSite')}
                </Text>
                <Text className="mt-0.5 text-[11px] text-dashboard-subtitle">
                  {t('workspace.sitesLinked', { count: sites.length })}
                </Text>
              </View>
              <ArrowRight color={dashboardColors.subtitle} size={16} />
            </Pressable>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * One of the two `.technician-grid` info cards. Each card has a soft tinted
 * icon disc, a heading, a body, and a teal text-action.
 */
function InfoCard({
  icon: Icon,
  tone,
  title,
  body,
  actionLabel,
  onPress,
}: {
  icon: typeof Handshake;
  tone: 'mint' | 'citron';
  title: string;
  body: string;
  actionLabel: string;
  onPress: () => void;
}) {
  const disc =
    tone === 'mint'
      ? dashboardColors.statMintSoft
      : dashboardColors.statCitronSoft;
  const iconColor =
    tone === 'mint'
      ? dashboardColors.statMintDeep
      : dashboardColors.statCitronDeep;
  return (
    <Card className="flex-1">
      <View
        className="mb-2 h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: disc }}
      >
        <Icon color={iconColor} size={26} strokeWidth={1.7} />
      </View>
      <Text
        className="text-[14px] font-semibold text-ink"
        style={{ letterSpacing: -0.2 }}
      >
        {title}
      </Text>
      <Text className="mt-1 text-[11px] leading-[1.7] text-dashboard-subtitle">
        {body}
      </Text>
      <Pressable
        accessibilityRole="link"
        onPress={onPress}
        className="mt-3 flex-row items-center gap-1 active:opacity-70"
      >
        <Text
          className="text-[11px] font-semibold"
          style={{ color: dashboardColors.teal }}
        >
          {actionLabel}
        </Text>
        <ArrowRight color={dashboardColors.teal} size={13} />
      </Pressable>
    </Card>
  );
}
