import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { roleLabels } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  listSiteAdminApplications,
  decideSiteAdminApplication,
} from '@/services/admin';
import type { SiteAdminApplication } from '@/types';
import { formatDate } from '@/utils/format';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Super-admin review for site-admin applications.
 */
export default function AdminApplicationsScreen() {
  const { t } = useTranslation('common');
  const { user } = useAuth();

  const [applications, setApplications] = useState<SiteAdminApplication[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const canReview = user?.role === 'super_admin';

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setApplications(
        (await listSiteAdminApplications()).filter((a) => a.status === 'pending'),
      );
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

  async function decide(id: number, approve: boolean) {
    setBusyId(id);
    try {
      await decideSiteAdminApplication(id, approve);
      setApplications((prev) => prev?.filter((a) => a.id !== id) ?? prev);
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
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <Text className="mb-4 text-[12px] leading-[1.8] text-dashboard-subtitle">
          {t('adminApplications.intro')}
        </Text>

        {loading ? (
          <Text className="text-[12px] text-dashboard-caption">
            {t('adminApplications.loading')}
          </Text>
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
              return (
                <View
                  key={app.id}
                  className="rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4"
                >
                  <Text className="text-[13px] font-semibold text-ink">
                    {t('adminApplications.applicationUserSite', {
                      userId: app.userId,
                      siteId: app.siteId,
                    })}
                  </Text>
                  <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                    {t('adminApplications.applicationSubmitted', {
                      id: app.id,
                      time: formatDate(app.submittedAt, true),
                    })}
                  </Text>
                  <View className="mt-3 flex-row gap-2">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('adminApplications.approve')}
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => decide(app.id, true)}
                      className="flex-1 rounded-md border py-2 active:opacity-80"
                      style={{
                        borderColor: dashboardColors.statMintDeep,
                        backgroundColor: dashboardColors.statMintSoft,
                      }}
                    >
                      <Text
                        className="text-center text-[12px] font-semibold"
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
                      onPress={() => decide(app.id, false)}
                      className="flex-1 rounded-md border py-2 active:opacity-80"
                      style={{
                        borderColor: dashboardColors.statCoralDeep,
                        backgroundColor: dashboardColors.statCoralSoft,
                      }}
                    >
                      <Text
                        className="text-center text-[12px] font-semibold"
                        style={{ color: dashboardColors.statCoralDeep }}
                      >
                        {busy ? t('adminApplications.working') : t('adminApplications.reject')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
