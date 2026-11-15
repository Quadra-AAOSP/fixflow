import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { HomeNotificationBell } from '@/components/dashboard/HomeNotificationBell';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { toErrorMessage } from '@/lib/apiClient';
import { listSiteAdminApplications } from '@/services/admin';
import { listVerifications } from '@/services/onboarding';
import { searchReportsPage } from '@/services/reports';
import { listSites } from '@/services/sites';
import { buildPlatformDashboardData } from '@/utils/platformDashboard';
import type { PlatformDashboardData } from '@/utils/platformDashboard';

const REPORT_PREVIEW_LIMIT = 5;

export function SuperAdminDashboard() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const palette = themeColors();
  const { user } = useAuth();
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [sites, adminApplications, verifications, reports] = await Promise.all([
        listSites(),
        listSiteAdminApplications(),
        listVerifications(),
        searchReportsPage({
          siteId: null,
          filters: { unattended: true },
          size: REPORT_PREVIEW_LIMIT,
        }),
      ]);
      setData(buildPlatformDashboardData(sites, adminApplications, verifications, reports.content, reports.hasMore));
    } catch (err) {
      setError(toErrorMessage(err, { fallback: t('superAdminDashboard.loadFailed') }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (user?.role === 'super_admin') void load();
  }, [load, user?.role]);

  if (user?.role !== 'super_admin') {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={ShieldCheck}
          title={t('superAdminDashboard.deniedTitle')}
          description={t('superAdminDashboard.deniedDescription')}
        />
      </Screen>
    );
  }

  const activeSites = data?.sites.filter((site) => site.contractStatus === 'contracted').length ?? 0;

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="w-full max-w-[760px] self-center px-5 pb-32 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={palette.primary}
          />
        }
      >
        <HomeNotificationBell />
        <View className="mb-5 overflow-hidden rounded-2xl px-5 py-5" style={{ backgroundColor: dashboardColors.statMintDeep }}>
          <View className="mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <ShieldCheck color={dashboardColors.cardBg} size={16} />
              <Text className="text-[10px] font-semibold uppercase text-white" style={{ letterSpacing: 0.8 }}>
                {t('superAdminDashboard.kicker')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('superAdminDashboard.refresh')}
              onPress={() => void load()}
              disabled={loading}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.16)', opacity: loading ? 0.5 : 1 }}
            >
              <RefreshCw color={dashboardColors.cardBg} size={15} />
            </Pressable>
          </View>
          <Text className="text-[25px] font-bold text-white">{t('superAdminDashboard.title')}</Text>
          <Text className="mt-1 text-[12px] leading-[1.7] text-white">
            {t('superAdminDashboard.subtitle')}
          </Text>
        </View>

        {error ? (
          <Card className="mb-4">
            <Text accessibilityRole="alert" className="mb-3 text-[12px] leading-[1.6] text-tone-danger">{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load()} className="flex-row items-center gap-2">
              <RefreshCw color={dashboardColors.teal} size={14} />
              <Text className="text-[12px] font-semibold text-dashboard-teal">{t('superAdminDashboard.retry')}</Text>
            </Pressable>
          </Card>
        ) : null}

        {loading && data === null ? (
          <StateView variant="loading" title={t('superAdminDashboard.loading')} />
        ) : data ? (
          <>
            <View className="mb-4 flex-row gap-2">
              <Metric icon={Building2} label={t('superAdminDashboard.metrics.sites')} value={data.sites.length} note={t('superAdminDashboard.metrics.contracted', { count: activeSites })} />
              <Metric icon={Users} label={t('superAdminDashboard.metrics.adminApplications')} value={data.pendingAdmins} note={t('superAdminDashboard.metrics.awaitingReview')} />
              <Metric icon={BadgeCheck} label={t('superAdminDashboard.metrics.technicianChecks')} value={data.pendingTechnicians} note={t('superAdminDashboard.metrics.awaitingReview')} />
            </View>

            <View className="mb-5 flex-row flex-wrap gap-2">
              <QuickLink icon={ClipboardList} label={t('superAdminDashboard.actions.reports')} onPress={() => router.push('/more/all-reports')} />
              <QuickLink icon={Building2} label={t('superAdminDashboard.actions.sites')} onPress={() => router.push('/more/sites')} />
              <QuickLink icon={Users} label={t('superAdminDashboard.actions.team')} onPress={() => router.push('/more/team-access')} />
              <QuickLink icon={Activity} label={t('superAdminDashboard.actions.analytics')} onPress={() => router.push('/more/report-analytics')} />
            </View>

            <PageHeader
              kicker={t('superAdminDashboard.unattendedKicker')}
              title={t('superAdminDashboard.unattendedTitle')}
              subtitle={t('superAdminDashboard.unattendedSubtitle')}
              icon={ClipboardList}
            >
              <Pressable accessibilityRole="button" onPress={() => router.push('/more/all-reports')} className="flex-row items-center gap-1.5">
                <Text className="text-[11px] font-semibold text-dashboard-teal">{t('superAdminDashboard.viewQueue')}</Text>
                <ArrowRight color={dashboardColors.teal} size={13} />
              </Pressable>
            </PageHeader>

            {data.unattended.length === 0 ? (
              <Card className="mb-5">
                <Text className="text-[12px] leading-[1.7] text-dashboard-subtitle">{t('superAdminDashboard.noUnattended')}</Text>
              </Card>
            ) : (
              <Card padded={false} className="mb-5 overflow-hidden">
                {data.unattended.map((report, index) => (
                  <Pressable
                    key={report.id}
                    accessibilityRole="button"
                    accessibilityLabel={t('superAdminDashboard.openReport', { id: report.id })}
                    onPress={() => router.push(`/reports/${report.id}`)}
                    className={`flex-row items-center gap-3 px-4 py-3.5 active:opacity-70 ${index < data.unattended.length - 1 ? 'border-b border-dashboard-card-line' : ''}`}
                  >
                    <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: dashboardColors.statCoralSoft }}>
                      <ClipboardList color={dashboardColors.statCoralDeep} size={14} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[12px] font-semibold text-ink" numberOfLines={1}>{report.description}</Text>
                      <Text className="mt-0.5 text-[10px] text-dashboard-caption" numberOfLines={1}>
                        {t('superAdminDashboard.reportMeta', { id: report.id, site: data.sites.find((site) => site.id === report.siteId)?.name ?? t('superAdminDashboard.unknownSite') })}
                      </Text>
                    </View>
                    <ArrowRight color={dashboardColors.teal} size={14} />
                  </Pressable>
                ))}
                {data.moreUnattended ? (
                  <Text className="px-4 py-3 text-[10px] text-dashboard-caption">{t('superAdminDashboard.moreUnattended')}</Text>
                ) : null}
              </Card>
            )}

            <PageHeader
              kicker={t('superAdminDashboard.sitesKicker')}
              title={t('superAdminDashboard.sitesTitle')}
              subtitle={t('superAdminDashboard.sitesSubtitle', { count: data.sites.length })}
              icon={Building2}
            >
              <Pressable accessibilityRole="button" onPress={() => router.push('/more/sites')} className="flex-row items-center gap-1.5">
                <Text className="text-[11px] font-semibold text-dashboard-teal">{t('superAdminDashboard.manageSites')}</Text>
                <ArrowRight color={dashboardColors.teal} size={13} />
              </Pressable>
            </PageHeader>
            {data.sites.length === 0 ? (
              <Card><Text className="text-[12px] text-dashboard-subtitle">{t('superAdminDashboard.noSites')}</Text></Card>
            ) : (
              <Card padded={false} className="overflow-hidden">
                {data.sites.slice(0, 4).map((site, index) => (
                  <View key={site.id} className={`flex-row items-center gap-3 px-4 py-3 ${index < Math.min(data.sites.length, 4) - 1 ? 'border-b border-dashboard-card-line' : ''}`}>
                    <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: dashboardColors.statCitronSoft }}>
                      <Building2 color={dashboardColors.statCitronDeep} size={14} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[12px] font-semibold text-ink" numberOfLines={1}>{site.name}</Text>
                      <Text className="mt-0.5 text-[10px] text-dashboard-caption">{t(`sites.types.${site.type}`)}</Text>
                    </View>
                    <Text className="text-[10px] font-medium text-dashboard-subtitle">{t(`sites.contractStatuses.${site.contractStatus}`)}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <Card className="min-w-0 flex-1 px-3 py-3">
      <Icon color={dashboardColors.teal} size={15} />
      <Text className="mt-2 text-[20px] font-bold text-ink">{value}</Text>
      <Text className="mt-0.5 text-[10px] font-semibold text-dashboard-subtitle" numberOfLines={2}>{label}</Text>
      <Text className="mt-1 text-[9px] text-dashboard-caption" numberOfLines={2}>{note}</Text>
    </Card>
  );
}

function QuickLink({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Building2;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="min-h-10 flex-row items-center gap-2 rounded-lg border border-dashboard-card-line px-3 py-2 active:opacity-70">
      <Icon color={dashboardColors.teal} size={14} />
      <Text className="text-[11px] font-semibold text-ink">{label}</Text>
    </Pressable>
  );
}
