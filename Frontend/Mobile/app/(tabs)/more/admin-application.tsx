import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  CheckCircle2,
  CircleX,
  Hourglass,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { getMySiteAdminApplication } from '@/services/auth';
import type { SiteAdminApplication } from '@/types';
import { relativeTime } from '@/utils/format';

/**
 * My admin application — the applicant-facing status page for the site-admin
 * self-application flow. Reads the live record (`GET /api/auth/site-admin-application`)
 * so an approved/rejected decision surfaces without waiting for re-login;
 * approval still only grants the admin role on the *next* session, which the
 * approved state says and offers a sign-out shortcut for.
 */
export default function MyAdminApplicationScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation('common');

  const [application, setApplication] = useState<SiteAdminApplication | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApplication(await getMySiteAdminApplication());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('adminApplication.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Signed-in but never applied — deep link or stale menu entry.
  if (!loading && application === null && !error && user?.adminApplication == null) {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={ShieldCheck}
          title={t('adminApplication.noApplicationTitle')}
          description={t('adminApplication.noApplicationDesc')}
        />
      </Screen>
    );
  }

  const status = application?.status ?? user?.adminApplication?.status ?? null;

  const statusBlock = (() => {
    switch (status) {
      case 'approved':
        return {
          icon: CheckCircle2,
          tint: dashboardColors.statMintDeep,
          bg: dashboardColors.statMintSoft,
          title: t('adminApplication.approvedTitle'),
          body: t('adminApplication.approvedBody'),
        };
      case 'rejected':
        return {
          icon: CircleX,
          tint: dashboardColors.statCoralDeep,
          bg: dashboardColors.statCoralSoft,
          title: t('adminApplication.rejectedTitle'),
          body: t('adminApplication.rejectedBody'),
        };
      case 'pending':
      default:
        return {
          icon: Hourglass,
          tint: dashboardColors.statCitronDeep,
          bg: dashboardColors.statCitronSoft,
          title: t('adminApplication.pendingTitle'),
          body: t('adminApplication.pendingBody'),
        };
    }
  })();

  const StatusIcon = statusBlock.icon;

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              {t('adminApplication.title')}
            </Text>
            <Text className="mt-1 text-[13px] leading-[1.7] text-dashboard-subtitle">
              {t('adminApplication.intro')}
            </Text>
          </View>
          <ShieldCheck color={dashboardColors.statMintDeep} size={30} />
        </View>

        {error ? (
          <StateView
            variant="error"
            description={error}
            actionLabel={t('adminApplication.retry')}
            onAction={() => {
              void load();
            }}
          />
        ) : null}

        {loading && application === null ? (
          <StateView variant="loading" title={t('adminApplication.checking')} />
        ) : null}

        {status ? (
          <Card className="mb-4">
            <View className="flex-row items-center gap-3">
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: statusBlock.bg }}
              >
                <StatusIcon color={statusBlock.tint} size={20} strokeWidth={1.9} />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-semibold text-ink">
                  {statusBlock.title}
                </Text>
                {application ? (
                  <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
                    {t('adminApplication.applicationSubmitted', {
                      id: application.id,
                      time: relativeTime(application.createdAt),
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
            <Text className="mt-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
              {statusBlock.body}
            </Text>
            {application?.decidedAt ? (
              <Text className="mt-2 text-[10px] text-dashboard-caption">
                {t('adminApplication.decided', {
                  time: relativeTime(application.decidedAt),
                })}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {status === 'approved' ? (
          <Button
            label={t('adminApplication.signOutToActivate')}
            onPress={() => {
              void logout().then(() => router.replace('/(auth)/login'));
            }}
          />
        ) : (
          <Button
            variant="secondary"
            label={
              loading
                ? t('adminApplication.refreshing')
                : t('adminApplication.checkForUpdates')
            }
            loading={loading}
            onPress={() => {
              void load();
            }}
          />
        )}

        <View className="mt-4 flex-row items-start gap-2 px-1">
          <RefreshCw color={dashboardColors.teal} size={13} />
          <Text className="flex-1 text-[10px] leading-[1.7] text-dashboard-caption">
            {t('adminApplication.liveNote')}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
