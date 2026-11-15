import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import {
  ArrowRight,
  Bell,
  Building2,
  Camera,
  ChevronRight,
  FileSignature,
  Mail,
  Phone,
  Save,
  Settings,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { TradeProfile } from '@/components/technician/TradeProfile';
import { roleLabels } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTechnicianAvailability } from '@/stores/availability';
import { useCurrentSite } from '@/stores/site';
import { deleteMyProfilePhoto, readMyProfilePhoto, updateMyProfile, uploadMyProfilePhoto } from '@/services/auth';
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
  const { user, logout, updateUser } = useAuth();
  const { site } = useCurrentSite();
  const {
    available,
    setAvailable,
    loading: availabilityLoading,
    saving: availabilitySaving,
    syncError: availabilityError,
  } = useTechnicianAvailability();

  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setPhone(user?.phone ?? '');
    setAddress(user?.address ?? '');
    setEditing(false);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setProfilePhoto(null);
    if (user?.profilePhotoPath) {
      void readMyProfilePhoto().then((uri) => {
        if (active) setProfilePhoto(uri);
      }).catch(() => {
        if (active) setProfilePhoto(null);
      });
    }
    return () => { active = false; };
  }, [user?.id, user?.profilePhotoPath]);

  if (!user) {
    return <Screen>{null}</Screen>;
  }

  function openSettings() {
    router.push('/profile/settings');
  }

  async function saveProfile() {
    if (!user || profileBusy) return;
    setProfileBusy(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const updated = await updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      updateUser(updated);
      setEditing(false);
      setProfileNotice(t('profile.edit.saved'));
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : t('profile.edit.saveFailed'));
    } finally {
      setProfileBusy(false);
    }
  }

  async function changeProfilePhoto() {
    if (profileBusy) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      setProfileError(t('profile.edit.photoTooLarge'));
      return;
    }
    setProfileBusy(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      const updated = await uploadMyProfilePhoto({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      updateUser(updated);
      setProfilePhoto(asset.uri);
      setProfileNotice(t('profile.edit.photoSaved'));
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : t('profile.edit.photoFailed'));
    } finally {
      setProfileBusy(false);
    }
  }

  async function removeProfilePhoto() {
    if (!user || profileBusy) return;
    setProfileBusy(true);
    setProfileError(null);
    setProfileNotice(null);
    try {
      await deleteMyProfilePhoto();
      const updated = { ...user, profilePhotoPath: null };
      updateUser(updated);
      setProfilePhoto(null);
      setProfileNotice(t('profile.edit.photoRemoved'));
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : t('profile.edit.photoFailed'));
    } finally {
      setProfileBusy(false);
    }
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
          className="relative overflow-hidden border-b border-dashboard-card-line pb-6 pt-8"
          style={{ backgroundColor: dashboardColors.statMintSoft }}
        >
          {/* Soft radial accents so the tinted hero still has depth. */}
          <View
            className="absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-40"
            style={{ backgroundColor: dashboardColors.cardBg }}
          />
          <View
            className="absolute -left-6 top-24 h-24 w-24 rounded-full opacity-25"
            style={{ backgroundColor: dashboardColors.cardBg }}
          />

          <View className="relative px-5">
            {/* Top row: quiet kicker on the left, settings affordance right. */}
            <View className="mb-4 flex-row items-center justify-between">
              <Text
                className="text-[10.5px] font-semibold uppercase"
                style={{ color: dashboardColors.statMintDeep, letterSpacing: 0.8 }}
              >
                {t('profile.heroKicker')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.openSettings')}
                onPress={openSettings}
                hitSlop={8}
                className="h-9 w-9 items-center justify-center rounded-full border border-dashboard-card-line bg-dashboard-card-bg active:opacity-80"
              >
                <Settings color={dashboardColors.teal} size={16} />
              </Pressable>
            </View>

            {/* Avatar + identity column. */}
            <View className="items-center">
              <View
                className="mb-4 h-[88px] w-[88px] items-center justify-center rounded-full"
                style={{
                  borderWidth: 3,
                  borderColor: dashboardColors.teal,
                  backgroundColor: dashboardColors.cardBg,
                }}
              >
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} className="h-full w-full rounded-full" accessibilityLabel={t('profile.edit.photo')} />
                ) : <Text
                  className="text-[30px] font-bold"
                  style={{
                    color: dashboardColors.statMintDeep,
                    letterSpacing: -0.5,
                  }}
                >
                  {initials}
                </Text>}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.edit.changePhoto')}
                onPress={() => void changeProfilePhoto()}
                disabled={profileBusy}
                className="mb-3 min-h-10 flex-row items-center gap-2 rounded-full border border-dashboard-card-line bg-dashboard-card-bg px-3 active:opacity-70"
              >
                {profileBusy ? <ActivityIndicator size="small" color={dashboardColors.teal} /> : <Camera color={dashboardColors.teal} size={14} />}
                <Text className="text-[11px] font-semibold text-dashboard-teal">{t('profile.edit.changePhoto')}</Text>
              </Pressable>

              <Text
                className="text-[23px] font-bold text-ink"
                style={{ letterSpacing: -0.6 }}
              >
                {displayName || user.email}
              </Text>

              <View className="mt-1 flex-row items-center gap-1.5">
                <Mail color={dashboardColors.statMintDeep} size={12} />
                <Text
                  className="text-[12px]"
                  style={{ color: dashboardColors.statMintDeep }}
                >
                  {user.email}
                </Text>
              </View>

              {/* Role pill — visual anchor. */}
              <View
                className="mt-3 flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{ backgroundColor: dashboardColors.cardBg }}
              >
                <ShieldCheck color={dashboardColors.teal} size={11} />
                <Text
                  className="text-[10px] font-semibold uppercase"
                  style={{ color: dashboardColors.teal, letterSpacing: 0.8 }}
                >
                  {roleLabel}
                </Text>
              </View>

              {/* Site pill — second identity anchor, hidden when the account
                  is site-agnostic. */}
              {user.siteId !== null ? (
                <View
                  className="mt-2 flex-row items-center gap-1.5 rounded-full border border-dashboard-card-line px-3 py-1.5"
                  style={{ backgroundColor: dashboardColors.cardBg }}
                >
                  <Building2 color={dashboardColors.subtitle} size={11} />
                  <Text
                    className="text-[10px] font-semibold uppercase text-dashboard-subtitle"
                    style={{ letterSpacing: 0.8 }}
                  >
                    {siteName}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* MAIN CONTENT */}
        <View className="px-5 pt-5">
          {/* Account details — icon rows instead of plain key/value. */}
          <Card padded={false} className="mb-4 overflow-hidden rounded-[16px]">
            <View className="px-4 pb-1 pt-4">
              <Text className="text-[12.5px] font-semibold text-ink">
                {t('profile.accountDetails')}
              </Text>
            </View>
            <IconRow
              icon={UserRound}
              tone="mint"
              label={t('profile.labels.role')}
              value={roleLabel}
            />
            <IconRow
              icon={Phone}
              tone="coral"
              label={t('profile.labels.phone')}
              value={user.phone ?? t('profile.dash')}
            />
            <IconRow
              icon={Building2}
              tone="citron"
              label={t('profile.labels.address')}
              value={user.address ?? t('profile.dash')}
              last
            />
          </Card>

          <Card className="mb-4">
            <View className="mb-3 flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-[13px] font-semibold text-ink">{t('profile.edit.title')}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setProfileError(null);
                  setProfileNotice(null);
                  setEditing((current) => !current);
                  if (editing) {
                    setFirstName(user.firstName);
                    setLastName(user.lastName);
                    setPhone(user.phone ?? '');
                    setAddress(user.address ?? '');
                  }
                }}
                className="min-h-10 flex-row items-center gap-1.5 px-2 active:opacity-70"
              >
                <Text className="text-[11px] font-semibold text-dashboard-teal">
                  {t(editing ? 'profile.edit.cancel' : 'profile.edit.open')}
                </Text>
              </Pressable>
            </View>
            {profileError ? <Text accessibilityRole="alert" className="mb-3 text-[12px] leading-[1.6] text-tone-danger">{profileError}</Text> : null}
            {profileNotice ? <Text accessibilityRole="summary" className="mb-3 text-[12px] text-dashboard-teal">{profileNotice}</Text> : null}
            {editing ? (
              <>
                <TextField label={t('profile.edit.firstName')} value={firstName} onChangeText={setFirstName} autoCapitalize="words" maxLength={128} />
                <TextField label={t('profile.edit.lastName')} value={lastName} onChangeText={setLastName} autoCapitalize="words" maxLength={128} />
                <TextField label={t('profile.labels.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={64} />
                <TextField label={t('profile.labels.address')} value={address} onChangeText={setAddress} maxLength={512} />
                <View className="flex-row gap-2">
                  {user.profilePhotoPath ? (
                    <Button variant="secondary" label={t('profile.edit.removePhoto')} disabled={profileBusy} onPress={() => void removeProfilePhoto()} className="flex-1" />
                  ) : null}
                  <Button label={t('profile.edit.save')} loading={profileBusy} disabled={!firstName.trim() || !lastName.trim()} onPress={() => void saveProfile()} className="flex-1">
                    <Save color={dashboardColors.statMintDeep} size={15} />
                    <Text className="ml-2 text-[15px] font-semibold text-dashboard-cta-text">{t('profile.edit.save')}</Text>
                  </Button>
                </View>
              </>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setEditing(true)} className="min-h-10 flex-row items-center justify-between active:opacity-70">
                <Text className="flex-1 text-[11px] leading-[1.6] text-dashboard-subtitle">{t('profile.edit.hint')}</Text>
                <ChevronRight color={dashboardColors.teal} size={15} />
              </Pressable>
            )}
          </Card>

          {/* Shortcuts — settings and alerts are one tap away from here. */}
          <Card padded={false} className="mb-4 overflow-hidden rounded-[16px]">
            <View className="px-4 pb-1 pt-4">
              <Text className="text-[12.5px] font-semibold text-ink">
                {t('profile.shortcuts.kicker')}
              </Text>
            </View>
            <ShortcutRow
              icon={Settings}
              label={t('profile.shortcuts.settings')}
              onPress={openSettings}
            />
            <ShortcutRow
              icon={Bell}
              label={t('profile.shortcuts.notifications')}
              onPress={() => router.push('/more/notifications')}
              last
            />
          </Card>

          {/* Technician contracts — web parity, proper action row. */}
          {user.role === 'technician' ? (
            <Card padded={false} className="mb-4 overflow-hidden rounded-[16px]">
              <View className="px-4 pb-1 pt-4">
                <Text className="text-[12.5px] font-semibold text-ink">
                  {t('profile.contracts.title')}
                </Text>
                <Text className="mt-0.5 text-[11px] leading-[1.5] text-dashboard-caption">
                  {t('profile.contracts.kicker')}
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

          {/* Verification + terms: the two things a super admin checks before
              approving an account, reachable straight from the profile. */}
          {user.role === 'technician' ? (
            <Card padded={false} className="mb-4 overflow-hidden rounded-[16px]">
              <View className="px-4 pb-1 pt-4">
                <Text className="text-[12.5px] font-semibold text-ink">
                  {t('profile.verification.title')}
                </Text>
                <Text className="mt-0.5 text-[11px] leading-[1.5] text-dashboard-caption">
                  {t('profile.verification.kicker')}
                </Text>
              </View>
              <ShortcutRow
                icon={ShieldCheck}
                label={t('profile.verification.submission')}
                onPress={() => router.push('/more/my-verification')}
              />
              <ShortcutRow
                icon={FileSignature}
                label={t('profile.verification.terms')}
                onPress={() => router.push('/technician/terms')}
                last
              />
            </Card>
          ) : null}

          {/* Technician skills — trade / specialty / proficiency selection
              (GET + POST /api/technician-skills), the same component the
              workspace screen uses. Only rendered for technicians. */}
          {user.role === 'technician' ? <TradeProfile /> : null}

          {/* Preferences — availability for technicians, session echo for
              everyone else. */}
          <Card padded={false} className="mb-4 overflow-hidden rounded-[16px]">
            <View className="px-4 pb-1 pt-4">
              <Text className="text-[12.5px] font-semibold text-ink">
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
                    {availabilityError
                      ? t('profile.availability.syncError')
                      : availabilitySaving
                        ? t('profile.availability.saving')
                        : t('profile.availability.hint')}
                  </Text>
                </View>
                <Switch
                  accessibilityRole="switch"
                  accessibilityLabel={t('profile.availability.label')}
                  value={available}
                  onValueChange={setAvailable}
                  disabled={availabilitySaving}
                  trackColor={{
                    false: dashboardColors.cardLine,
                    true: dashboardColors.teal,
                  }}
                  thumbColor={dashboardColors.cardBg}
                />
              </View>
            ) : (
              <View className="flex-row items-center gap-2.5 px-4 py-3.5">
                <View
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: dashboardColors.statMintDeep }}
                />
                <Text className="flex-1 text-[11.5px] leading-[1.6] text-dashboard-subtitle">
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
  tone?: 'mint' | 'coral' | 'citron';
  last?: boolean;
};

const ROW_TONES = {
  mint: {
    soft: dashboardColors.statMintSoft,
    ink: dashboardColors.statMintDeep,
  },
  coral: {
    soft: dashboardColors.statCoralSoft,
    ink: dashboardColors.statCoralDeep,
  },
  citron: {
    soft: dashboardColors.statCitronSoft,
    ink: dashboardColors.statCitronDeep,
  },
};

/** Icon disc + label + right-aligned value, used for every detail row. */
function IconRow({ icon: Icon, label, value, tone = 'mint', last }: IconRowProps) {
  const colors = ROW_TONES[tone];
  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 ${last ? '' : 'border-b border-dashboard-card-line'}`}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.soft }}
      >
        <Icon color={colors.ink} size={14} />
      </View>
      <Text className="flex-1 text-[11.5px] font-medium text-dashboard-subtitle">
        {label}
      </Text>
      <Text className="text-[13px] font-semibold text-ink">{value}</Text>
    </View>
  );
}

/** Tappable row with a trailing chevron, for navigating out of the profile. */
function ShortcutRow({
  icon: Icon,
  label,
  onPress,
  last,
}: {
  icon: typeof UserRound;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`flex-row items-center gap-3 px-4 py-3.5 active:opacity-70 ${last ? '' : 'border-b border-dashboard-card-line'}`}
    >
      <View
        className="h-9 w-9 items-center justify-center rounded-full"
        style={{ backgroundColor: dashboardColors.statMintSoft }}
      >
        <Icon color={dashboardColors.statMintDeep} size={14} />
      </View>
      <Text className="flex-1 text-[12.5px] font-medium text-ink">{label}</Text>
      <ChevronRight color={dashboardColors.subtitle} size={15} />
    </Pressable>
  );
}
