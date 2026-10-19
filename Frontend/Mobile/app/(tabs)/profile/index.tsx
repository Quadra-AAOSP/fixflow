import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { roleLabels, siteRoleLabels } from '@/constants/access';
import { fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentSite } from '@/stores/site';
import { ApiError } from '@/lib/apiClient';
import { formatDateTime, humanize } from '@/utils/format';
import {
  refreshSession,
  signOut,
} from '@/services/auth';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Profile screen. Mirrors `ProfileView.vue` + `AccountDetailsView.vue` +
 * `SessionView.vue`. Every section below is a direct port of the web card
 * layout — account details, working site, contracts, session behaviour.
 */
export default function ProfileScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, logout } = useAuth();
  const { site } = useCurrentSite();

  const [refreshingSession, setRefreshingSession] = useState(false);
  const [lastActivityCheckedAt, setLastActivityCheckedAt] = useState<string | null>(
    user?.session?.checkedAt ?? null,
  );

  useEffect(() => {
    setLastActivityCheckedAt(user?.session?.checkedAt ?? null);
  }, [user?.session?.checkedAt]);

  async function doRefresh() {
    setRefreshingSession(true);
    try {
      const result = await refreshSession();
      setLastActivityCheckedAt(result.checkedAt);
    } catch (err) {
      Alert.alert(
        t('profile.manualRefreshFailed'),
        err instanceof ApiError ? err.message : t('profile.manualRefreshFailed'),
      );
    } finally {
      setRefreshingSession(false);
    }
  }

  async function doSignOut() {
    try {
      await signOut();
      await logout();
    } catch {
      Alert.alert(
        t('profile.session.signOutFailed'),
        t('profile.session.signOutFailed'),
      );
    }
  }

  const roleLabel = useMemo(
    () => (user ? roleLabels[user.role] : null),
    [user],
  );
  const siteLabel = useMemo(() => {
    if (!user) return null;
    if (user.role === 'technician') {
      return site ? siteRoleLabels.technician_solo : null;
    }
    return user.siteId !== null && site
      ? `${siteRoleLabels[user.role as keyof typeof siteRoleLabels] ?? humanize(user.role)} — ${site.name}`
      : null;
  }, [user, site]);

  const sessionStatusCopy = useCallback(() => {
    if (!user) return '';
    const s = user.session;
    if (!s) return t('profile.session.statusActive');
    if (s.signedOut) return t('profile.session.statusSignedOut');
    if (s.paused) return t('profile.session.statusPaused');
    if (!s.keepAlive) return t('profile.session.statusKeepAliveOff');
    return t('profile.session.statusActive');
  }, [user, t]);

  function openSettings() {
    router.push('/profile/settings');
  }

  if (!user) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('profile.heroKicker')}
          title={t('profile.profileTitle')}
          titleAccent="."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-10 pt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <View>
            <Text className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption">
              {t('profile.heroKicker')}
            </Text>
            <Text
              className="text-[24px] font-bold text-ink"
              style={{ letterSpacing: -0.7 }}
            >
              {t('profile.profileTitle')}
              <Text className="text-coral-decay">.</Text>
            </Text>
            <Text className="mt-0.5 text-[11px] text-dashboard-caption">
              {t('profile.idLabel', { id: user.id })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('profile.openSettings')}
            onPress={openSettings}
            className="flex-row items-center gap-1 rounded-md border border-dashboard-card-line bg-dashboard-card-bg px-3 py-2 active:opacity-80"
          >
            <Settings color={dashboardColors.teal} size={14} />
            <Text className="text-[11px] font-semibold text-dashboard-teal">
              {t('profile.openSettings')}
            </Text>
          </Pressable>
        </View>

        {/* Account details card */}
        <Card padded={false} className="mb-4">
          <View className="border-b border-dashboard-card-line px-4 py-3">
            <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('profile.accountDetails')}
            </Text>
          </View>
          <Definition t={t} label={t('profile.labels.role')} value={roleLabel ?? t('profile.dash')} />
          <Definition t={t} label={t('profile.labels.accountId')} value={String(user.id)} />
          <Definition
            t={t}
            label={t('profile.labels.siteId')}
            value={user.siteId != null ? String(user.siteId) : t('profile.dash')}
          />
          {user.email ? (
            <Definition t={t} label={t('profile.labels.type')} value={user.email} />
          ) : null}
          {user.phone ? (
            <Definition t={t} label={t('profile.labels.phone')} value={user.phone} />
          ) : null}
          {user.address ? (
            <Definition t={t} label={t('profile.labels.address')} value={user.address} />
          ) : null}
        </Card>

        {/* Contracts card */}
        <Card padded={false} className="mb-4">
          <View className="border-b border-dashboard-card-line px-4 py-3">
            <Text className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption">
              {t('profile.contracts.kicker')}
            </Text>
          </View>
          <View className="px-4 py-3">
            <Text className="text-[15px] font-semibold text-ink">
              {t('profile.contracts.title')}
            </Text>
            <Text className="mt-1 text-[11px] leading-[1.8] text-dashboard-subtitle">
              {t('profile.contracts.body', { id: user.id })}
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('profile.contracts.link')}
              onPress={() => router.push('/more/site-contracts')}
              className="mt-2 self-start py-1 active:opacity-70"
            >
              <Text
                className="text-[11px] font-semibold text-dashboard-teal underline"
                style={{ fontFamily: fontFamilies.bodyMedium }}
              >
                {t('profile.contracts.link')}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* Session card */}
        <Card padded={false} className="mb-4">
          <View className="border-b border-dashboard-card-line px-4 py-3">
            <Text className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption">
              {t('profile.session.kicker')}
            </Text>
          </View>
          <View className="px-4 py-3">
            <Text className="text-[11px] leading-[1.8] text-dashboard-subtitle">
              {t('profile.session.signedInAs', {
                role: roleLabel ?? humanize(user.role),
                site: siteLabel ? ` · ${siteLabel}` : '',
              })}
            </Text>

            <Row label={t('profile.session.lastActivity')}>
              <Text className="text-[12px] text-dashboard-subtitle">
                {lastActivityCheckedAt
                  ? formatDateTime(lastActivityCheckedAt)
                  : t('profile.session.notYetChecked')}
              </Text>
            </Row>

            <Row label={t('profile.session.signedOut')}>
              <Text className="text-[12px] text-ink">{sessionStatusCopy()}</Text>
            </Row>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.session.refreshNow')}
              disabled={refreshingSession}
              onPress={doRefresh}
              className="mt-3 flex-row items-center justify-center rounded-[11px] border border-dashboard-card-line bg-dashboard-card-bg px-4 py-3 active:opacity-80"
            >
              <Text className="text-[12px] font-semibold text-ink">
                {refreshingSession
                  ? t('profile.session.refreshing')
                  : t('profile.session.refreshNow')}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.session.signOut')}
              onPress={() =>
                Alert.alert(
                  t('profile.session.signOutAlertTitle'),
                  t('profile.session.signOutAlertBody'),
                  [
                    { text: t('profile.session.cancel'), style: 'cancel' },
                    {
                      text: t('profile.session.signOut'),
                      style: 'destructive',
                      onPress: doSignOut,
                    },
                  ],
                )
              }
              className="mt-2 flex-row items-center justify-center rounded-[11px] border px-4 py-3 active:opacity-90"
              style={{
                backgroundColor: dashboardColors.statCoralSoft,
                borderColor: dashboardColors.statCoralDeep,
              }}
            >
              <Text
                className="text-[13px] font-semibold"
                style={{ color: dashboardColors.statCoralDeep }}
              >
                {t('profile.session.signOut')}
              </Text>
            </Pressable>
          </View>
        </Card>

        <Text className="text-center text-[10px] leading-[1.6] text-dashboard-caption">
          {t('profile.tagline')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Definition({
  t, label, value,
}: {
  t: TranslateFn;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-start justify-between gap-4 border-b border-dashboard-card-line px-4 py-2 last:border-b-0">
      <Text className="text-[10px] uppercase tracking-[1.2px] text-dashboard-caption">
        {label}
      </Text>
      <Text className="flex-1 text-right text-[12px] text-ink">{value}</Text>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-2 flex-row items-center justify-between gap-4">
      <Text className="text-[11px] text-dashboard-caption">{label}</Text>
      {children}
    </View>
  );
}

// React import for JSX type check
import type { ReactNode } from 'react';
