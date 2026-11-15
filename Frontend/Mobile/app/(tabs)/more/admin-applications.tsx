import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Check, ShieldCheck, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  listSiteAdminApplications,
  decideSiteAdminApplication,
} from '@/services/admin';
import { listSites } from '@/services/sites';
import type { Site, SiteAdminApplication } from '@/types';
import { formatDate, relativeTime } from '@/utils/format';

/**
 * Super-admin review for site-admin applications.
 */
export default function AdminApplicationsScreen() {
  const { t } = useTranslation('common');
  const { user } = useAuth();

  const [applications, setApplications] = useState<SiteAdminApplication[] | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<'approved' | 'rejected' | null>(null);

  const canReview = user?.role === 'super_admin';

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [pending, siteList] = await Promise.all([
        listSiteAdminApplications(),
        listSites().catch(() => [] as Site[]),
      ]);
      setApplications(pending.filter((a) => a.status === 'pending'));
      setSites(siteList);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('adminApplications.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!canReview) return;
    void load();
  }, [canReview, load]);

  const siteNames = useMemo(() => {
    const map = new Map<number, string>();
    sites.forEach((site) => map.set(site.id, site.name));
    return map;
  }, [sites]);

  async function decide(id: number, approve: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await decideSiteAdminApplication(id, approve);
      setApplications((prev) => prev?.filter((a) => a.id !== id) ?? prev);
      setNotice(approve ? 'approved' : 'rejected');
    } catch (err) {
      Alert.alert(
        t('adminApplications.errors.couldNotDecide'),
        err instanceof ApiError ? err.message : t('adminApplications.errors.couldNotDecide'),
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!canReview) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('adminApplications.title') }} />
        <StateView
          variant="empty"
          icon={ShieldCheck}
          title={t('adminApplications.superAdminOnlyTitle')}
          description={t('adminApplications.superAdminOnlyDesc')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('adminApplications.title') }} />
      <ScrollView
        contentContainerClassName="px-5 pb-10 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          kicker={t('adminApplications.kicker')}
          title={t('adminApplications.title')}
          subtitle={t('adminApplications.intro')}
          icon={ShieldCheck}
        >
          <View className="flex-row flex-wrap items-center gap-2">
            <Pill
              tone={(applications?.length ?? 0) > 0 ? 'citron' : 'mint'}
              label={t('adminApplications.pendingCount', {
                count: applications?.length ?? 0,
              })}
            />
            <Text className="text-[10px] text-dashboard-caption">
              {t('adminApplications.verifyHint')}
            </Text>
          </View>
        </PageHeader>

        {notice ? (
          <View
            className="mb-4 flex-row items-start gap-2 rounded-lg px-3 py-3"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <Check color={dashboardColors.statMintDeep} size={15} />
            <Text
              accessibilityLiveRegion="polite"
              className="flex-1 text-[11px] leading-[1.7]"
              style={{ color: dashboardColors.statMintDeep }}
            >
              {t(
                notice === 'approved'
                  ? 'adminApplications.noticeApproved'
                  : 'adminApplications.noticeRejected',
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('adminApplications.dismiss')}
              onPress={() => setNotice(null)}
              className="p-0.5 active:opacity-70"
            >
              <X color={dashboardColors.statMintDeep} size={13} />
            </Pressable>
          </View>
        ) : null}

        {loading && applications === null ? (
          <StateView variant="loading" title={t('adminApplications.loading')} />
        ) : error ? (
          <StateView
            variant="error"
            description={error}
            actionLabel={t('adminApplications.retry')}
            onAction={() => { void load(); }}
          />
        ) : (applications ?? []).length === 0 ? (
          <StateView
            variant="empty"
            icon={ShieldCheck}
            title={t('adminApplications.nonePendingTitle')}
            description={t('adminApplications.nonePendingDesc')}
          />
        ) : (
          <View className="gap-3">
            {(applications ?? []).map((app) => {
              const busy = busyId === app.id;
              const siteName =
                siteNames.get(app.siteId) ?? t('adminApplications.unknownSite');
              return (
                <Card key={app.id}>
                  <View className="flex-row items-start gap-3">
                    <View
                      className="h-10 w-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: dashboardColors.statCitronSoft }}
                    >
                      <Text
                        className="text-[12px] font-bold"
                        style={{ color: dashboardColors.statCitronDeep }}
                      >
                        #{app.userId}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-semibold text-ink">
                        {t('adminApplications.applicant', { userId: app.userId })}
                      </Text>
                      <Text className="mt-0.5 text-[11px] leading-[1.6] text-dashboard-subtitle">
                        {t('adminApplications.wantsToAdminister', { site: siteName })}
                      </Text>
                      <Text className="mt-1 text-[10px] text-dashboard-caption">
                        {t('adminApplications.applicationSubmitted', {
                          id: app.id,
                          time: formatDate(app.createdAt, true),
                        })}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Pill tone="citron" label={t('adminApplications.pending')} />
                      <Text className="text-[9.5px] text-dashboard-caption">
                        {relativeTime(app.createdAt)}
                      </Text>
                    </View>
                  </View>

                  <View className="mt-3 flex-row gap-2 border-t border-dashboard-card-line pt-3">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('adminApplications.approve')}
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => void decide(app.id, true)}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border py-2.5 active:opacity-80"
                      style={{
                        borderColor: dashboardColors.statMintDeep,
                        backgroundColor: dashboardColors.statMintSoft,
                        opacity: busy ? 0.55 : 1,
                      }}
                    >
                      <Check color={dashboardColors.statMintDeep} size={14} />
                      <Text
                        className="text-[12px] font-semibold"
                        style={{ color: dashboardColors.statMintDeep }}
                      >
                        {busy ? t('adminApplications.working') : t('adminApplications.approve')}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('adminApplications.reject')}
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => void decide(app.id, false)}
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border py-2.5 active:opacity-80"
                      style={{
                        borderColor: dashboardColors.statCoralDeep,
                        backgroundColor: dashboardColors.statCoralSoft,
                        opacity: busy ? 0.55 : 1,
                      }}
                    >
                      <X color={dashboardColors.statCoralDeep} size={14} />
                      <Text
                        className="text-[12px] font-semibold"
                        style={{ color: dashboardColors.statCoralDeep }}
                      >
                        {busy ? t('adminApplications.working') : t('adminApplications.reject')}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
