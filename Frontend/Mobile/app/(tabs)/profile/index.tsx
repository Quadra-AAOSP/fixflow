import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { roleLabels } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentSite } from '@/stores/site';
import { ApiError } from '@/lib/apiClient';
import { humanize } from '@/utils/format';
import { logout } from '@/services/auth';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Profile screen. Shows account details and sign-out action. Matches what
 * the backend actually exposes on the User type.
 */
export default function ProfileScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, logout: clearSession } = useAuth();
  const { site } = useCurrentSite();

  const [signingOut, setSigningOut] = useState(false);

  async function doSignOut() {
    setSigningOut(true);
    try {
      await logout();
      await clearSession();
    } catch (err) {
      Alert.alert(
        t('profile.session.signOutAlertTitle'),
        err instanceof ApiError ? err.message : t('profile.session.signOutFailed'),
      );
    } finally {
      setSigningOut(false);
    }
  }

  function openSettings() {
    router.push('/profile/settings');
  }

  if (!user) {
    return <Screen>{null}</Screen>;
  }

  const roleLabel = roleLabels[user.role];
  const siteName =
    user.siteId !== null && site ? site.name : t('profile.dash');

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
          <Definition t={t} label={t('profile.labels.role')} value={roleLabel} />
          <Definition t={t} label={t('profile.labels.accountId')} value={String(user.id)} />
          <Definition
            t={t}
            label={t('profile.labels.siteId')}
            value={user.siteId != null ? String(user.siteId) : t('profile.dash')}
          />
          <Definition
            t={t}
            label={t('profile.labels.phone')}
            value={user.phone ?? t('profile.dash')}
          />
          <Definition
            t={t}
            label={t('profile.labels.address')}
            value={user.address ?? t('profile.dash')}
          />
          <Definition t={t} label={t('profile.workingSite')} value={siteName} />
        </Card>

        {/* Session card — sign-out only (User has no session field on mobile) */}
        <Card padded={false} className="mb-4">
          <View className="border-b border-dashboard-card-line px-4 py-3">
            <Text className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption">
              {t('profile.session.kicker')}
            </Text>
          </View>
          <View className="px-4 py-3">
            <Text className="text-[11px] leading-[1.8] text-dashboard-subtitle">
              {t('profile.session.signedInAs', {
                role: roleLabel,
                site: site && user.siteId != null ? ` · ${site.name}` : '',
              })}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('profile.session.signOut')}
              disabled={signingOut}
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
              className="mt-3 flex-row items-center justify-center rounded-[11px] border px-4 py-3 active:opacity-90"
              style={{
                backgroundColor: dashboardColors.statCoralSoft,
                borderColor: dashboardColors.statCoralDeep,
                opacity: signingOut ? 0.6 : 1,
              }}
            >
              <Text
                className="text-[13px] font-semibold"
                style={{ color: dashboardColors.statCoralDeep }}
              >
                {signingOut ? t('profile.session.refreshing') : t('profile.session.signOut')}
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
