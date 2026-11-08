import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import {
  ArrowRight,
  Building2,
  Mail,
  Phone,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { roleLabels } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTechnicianAvailability } from '@/stores/availability';
import { useCurrentSite } from '@/stores/site';
import { fullName } from '@/utils/format';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Profile screen. Log out uses the same working pattern as
 * admin-application.tsx: await logout() to clear the store FIRST, then
 * router.replace('/(auth)/login') from a promise callback — never during
 * render.
 */
export default function ProfileScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, logout } = useAuth();
  const { site } = useCurrentSite();
  const {
    available,
    setAvailable,
    loading: availabilityLoading,
  } = useTechnicianAvailability();

  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return <Screen>{null}</Screen>;
  }

  function openSettings() {
    router.push('/profile/settings');
  }

  const roleLabel = t(roleLabels[user.role]);
  const siteName =
    user.siteId !== null && site ? site.name : t('profile.dash');
  const displayName = fullName(user.firstName, user.lastName).trim();
  const initials =
    `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
    user.email[0]?.toUpperCase() ||
    '?';

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="pb-12"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HERO — identity block with top-right settings. */}
        <View
          className="relative overflow-hidden border-b border-dashboard-card-line pb-6 pt-10"
          style={{ backgroundColor: dashboardColors.bannerBg }}
        >
          {/* Soft radial accents in the brand mint, consistent with the
              rest of the app's editorial hero treatment. */}
          <View
            className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          />
          <View
            className="absolute -left-4 top-20 h-20 w-20 rounded-full opacity-25"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          />

          <View className="relative px-5">
            {/* Top row: kicker on the left, settings on the right. */}
            <View className="mb-5 flex-row items-center justify-between">
              <Text
                className="text-[10px] font-semibold uppercase tracking-[1.4px] text-dashboard-caption"
                style={{ letterSpacing: 1.4 }}
              >
                {t('profile.heroKicker')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.openSettings')}
                onPress={openSettings}
                className="flex-row items-center gap-1 rounded-full border border-dashboard-card-line bg-dashboard-card-bg/80 px-3 py-1.5 active:opacity-80"
              >
                <Settings color={dashboardColors.teal} size={13} />
                <Text
                  className="text-[10px] font-semibold uppercase tracking-[1px]"
                  style={{ color: dashboardColors.teal, letterSpacing: 1 }}
                >
                  {t('profile.openSettings')}
                </Text>
              </Pressable>
            </View>

            {/* Avatar + identity column. */}
            <View className="items-center">
              <View
                className="mb-4 h-24 w-24 items-center justify-center rounded-full border-[3px]"
                style={{
                  borderColor: dashboardColors.statMintSoft,
                  backgroundColor: dashboardColors.statMintDeep,
                }}
              >
                <Text
                  className="text-[30px] font-bold text-white"
                  style={{ letterSpacing: -0.5 }}
                >
                  {initials}
                </Text>
              </View>

              <Text
                className="text-[22px] font-bold text-ink"
                style={{ letterSpacing: -0.5 }}
              >
                {displayName || user.email}
              </Text>

              <View className="mt-1 flex-row items-center gap-1.5">
                <Mail color={dashboardColors.subtitle} size={11} />
                <Text className="text-[12px] text-dashboard-subtitle">
                  {user.email}
                </Text>
              </View>

              {/* Role pill — visual anchor. */}
              <View
                className="mt-3 flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{ backgroundColor: dashboardColors.pillBg }}
              >
                <ShieldCheck color={dashboardColors.teal} size={11} />
                <Text
                  className="text-[10px] font-semibold uppercase tracking-[1.2px]"
                  style={{ color: dashboardColors.teal, letterSpacing: 1.2 }}
                >
                  {roleLabel}
                </Text>
              </View>

              {/* Site pill — second identity anchor, hidden when the account
                  is site-agnostic. */}
              {user.siteId !== null ? (
                <View className="mt-2 flex-row items-center gap-1.5 rounded-full border border-dashboard-card-line px-3 py-1.5">
                  <Building2 color={dashboardColors.subtitle} size={11} />
                  <Text
                    className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-subtitle"
                    style={{ letterSpacing: 1.2 }}
                  >
                    {siteName}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* MAIN CONTENT */}
        <View className="px-5 pt-6">
          {/* Account details — icon rows instead of plain key/value. */}
          <Card padded={false} className="mb-5 overflow-hidden">
            <View className="px-4 pb-2 pt-4">
              <Text
                className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption"
                style={{ letterSpacing: 1.2 }}
              >
                {t('profile.accountDetails')}
              </Text>
            </View>
            <IconRow
              icon={UserRound}
              label={t('profile.labels.role')}
              value={roleLabel}
            />
            <IconRow
              icon={Phone}
              label={t('profile.labels.phone')}
              value={user.phone ?? t('profile.dash')}
            />
            <IconRow
              icon={Building2}
              label={t('profile.labels.address')}
              value={user.address ?? t('profile.dash')}
              last
            />
          </Card>

          {/* Technician contracts — web parity, proper action row. */}
          {user.role === 'technician' ? (
            <Card padded={false} className="mb-5 overflow-hidden">
              <View className="px-4 pb-2 pt-4">
                <Text
                  className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption"
                  style={{ letterSpacing: 1.2 }}
                >
                  {t('profile.contracts.kicker')}
                </Text>
                <Text
                  className="mt-0.5 text-[15px] font-semibold text-ink"
                  style={{ letterSpacing: -0.2 }}
                >
                  {t('profile.contracts.title')}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/more/contracts')}
                className="mx-3 mb-3 flex-row items-center justify-between rounded-lg border border-dashboard-card-line px-3 py-3 active:opacity-80"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-[12px] leading-[1.5] text-dashboard-subtitle">
                    {t('profile.contracts.body')}
                  </Text>
                </View>
                <ArrowRight color={dashboardColors.teal} size={14} />
              </Pressable>
            </Card>
          ) : null}

          {/* Preferences — availability for technicians, session echo for
              everyone else. */}
          <Card padded={false} className="mb-5 overflow-hidden">
            <View className="px-4 pb-2 pt-4">
              <Text
                className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption"
                style={{ letterSpacing: 1.2 }}
              >
                {t('profile.availability.kicker')}
              </Text>
            </View>
            {user.role === 'technician' && !availabilityLoading ? (
              <View className="flex-row items-center justify-between px-4 py-3">
                <View className="flex-1 pr-3">
                  <Text className="text-[13px] font-semibold text-ink">
                    {t('profile.availability.label')}
                  </Text>
                  <Text className="mt-0.5 text-[11px] leading-[1.5] text-dashboard-caption">
                    {t('profile.availability.hint')}
                  </Text>
                </View>
                <Switch
                  accessibilityRole="switch"
                  accessibilityLabel={t('profile.availability.label')}
                  value={available}
                  onValueChange={setAvailable}
                  trackColor={{
                    false: dashboardColors.cardLine,
                    true: dashboardColors.teal,
                  }}
                  thumbColor={dashboardColors.cardBg}
                />
              </View>
            ) : (
              <View className="px-4 py-3">
                <Text className="text-[12px] leading-[1.5] text-dashboard-subtitle">
                  {t('profile.session.signedInAs', {
                    role: roleLabel,
                    site: user.siteId !== null && site ? ` · ${site.name}` : '',
                  })}
                </Text>
              </View>
            )}
          </Card>

          {/* LOG OUT — direct, no Alert. Same proven pattern as
              admin-application.tsx:185. */}
          <Button
            variant="secondary"
            label={t('profile.session.signOut')}
            loading={signingOut}
            disabled={signingOut}
            onPress={() => {
              setSigningOut(true);
              void logout().then(() => {
                router.replace('/(auth)/login');
              }).catch(() => {
                router.replace('/(auth)/login');
              });
            }}
            className="mb-4"
          />

          <Text className="text-center text-[10px] leading-[1.6] text-dashboard-caption">
            {t('profile.tagline')}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

type IconRowProps = {
  icon: typeof UserRound;
  label: string;
  value: string;
  last?: boolean;
};

/** Icon disc + label + right-aligned value, used for every detail row. */
function IconRow({ icon: Icon, label, value, last }: IconRowProps) {
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3 ${last ? '' : 'border-b border-dashboard-card-line'}`}
    >
      <View
        className="h-8 w-8 items-center justify-center rounded-full"
        style={{ backgroundColor: dashboardColors.statMintSoft }}
      >
        <Icon color={dashboardColors.statMintDeep} size={13} />
      </View>
      <Text
        className="text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption"
        style={{ letterSpacing: 1.2 }}
      >
        {label}
      </Text>
      <Text className="flex-1 text-right text-[13px] font-medium text-ink">
        {value}
      </Text>
    </View>
  );
}
