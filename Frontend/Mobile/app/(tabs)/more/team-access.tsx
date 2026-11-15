import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  ArrowRight,
  Check,
  KeyRound,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import {
  canProvision,
  provisionableRoles,
  roleLabels,
} from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useAccountPolicy } from '@/hooks/useAccountPolicy';
import { ApiError } from '@/lib/apiClient';
import { provisionUser } from '@/services/admin';
import { listSites } from '@/services/sites';
import type { ProvisionUserPayload, Site, UserRole } from '@/types';

/** Numbered step marker used by the section cards. */
function StepBadge({ step }: { step: number }) {
  return (
    <View
      className="h-6 w-6 items-center justify-center rounded-full"
      style={{ backgroundColor: dashboardColors.statMintSoft }}
    >
      <Text
        className="text-[11px] font-bold"
        style={{ color: dashboardColors.statMintDeep }}
      >
        {step}
      </Text>
    </View>
  );
}

/**
 * Team access. Admin and super_admin only. Mirrors `TeamAccessView.vue` on the
 * web build — the actor picks a role, a site, fills the new user's name /
 * work email / initial password, and the backend mints the account. The
 * backend returns the new user; the new person signs in themselves.
 */
export default function TeamAccessScreen() {
  const { user } = useAuth();
  const policy = useAccountPolicy();
  const { t } = useTranslation('common');

  const [sites, setSites] = useState<Site[] | null>(null);
  const [loadingSites, setLoadingSites] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);

  const [role, setRole] = useState<UserRole | null>(null);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [showCriteria, setShowCriteria] = useState(false);

  const roles = useMemo(
    () => (user ? provisionableRoles(user) : []),
    [user],
  );

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    setSitesError(null);
    try {
      const result = await listSites();
      setSites(result);
    } catch (err) {
      setSitesError(
        err instanceof ApiError ? err.message : t('more.teamAccess.couldNotLoadSites'),
      );
    } finally {
      setLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  // Default the role to the first allowed role (so the picker doesn't open
  // with a null value), but only the first time the screen is opened.
  useEffect(() => {
    if (role === null && roles.length > 0) {
      setRole(roles[0]);
    }
  }, [role, roles]);

  // Pick a sensible default site once the list arrives.
  useEffect(() => {
    if (siteId === null && sites && sites.length > 0) {
      const userSite = sites.find((site) => site.id === user?.siteId);
      setSiteId(userSite?.id ?? sites[0].id);
    }
  }, [siteId, sites, user?.siteId]);

  if (!user || !canProvision(user)) {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={ShieldCheck}
          title={t('more.teamAccess.adminsOnlyTitle')}
          description={t('more.teamAccess.adminsOnlyDesc')}
        />
      </Screen>
    );
  }

  const siteOptions = (sites ?? []).map((site) => ({
    value: String(site.id),
    label: site.name,
  }));
  const roleOptions = roles.map((value) => ({
    value,
    label: t(roleLabels[value]),
  }));

  // Shop managers (and super admins) are platform-level accounts — the
  // backend requires a null siteId for them (`AuthService.resolveSiteForRole`).
  const siteless = role === 'shop_manager' || role === 'super_admin';
  const selectedSiteName = siteless
    ? t('more.teamAccess.noSitePlatform')
    : (sites?.find((site) => site.id === siteId)?.name ??
      t('more.teamAccess.unknownSite'));
  // Self-registration roles are display metadata from `/api/auth/policy`;
  // resolve them to the same labels used in the picker.
  const selfRoles = (policy?.selfRegistrationRoles ?? [])
    .map((value) => (roleLabels[value as UserRole] ? t(roleLabels[value as UserRole]) : value))
    .join(', ');

  async function onSubmit() {
    if (role === null) {
      setError(t('more.teamAccess.errors.chooseRole'));
      return;
    }
    if (!siteless && siteId === null) {
      setError(t('more.teamAccess.errors.chooseSite'));
      return;
    }
    if (firstName.trim().length === 0 || lastName.trim().length === 0) {
      setError(t('more.teamAccess.errors.nameRequired'));
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError(t('more.teamAccess.errors.emailRequired'));
      return;
    }
    const minimum = policy?.passwordMinLength ?? 8;
    if (password.length < minimum) {
      setError(t('more.teamAccess.errors.passwordTooShort', { count: minimum }));
      return;
    }
    const payload: ProvisionUserPayload = {
      role: role as ProvisionUserPayload['role'],
      siteId: siteless ? null : siteId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim().length > 0 ? phone.trim() : undefined,
      address: address.trim().length > 0 ? address.trim() : undefined,
    };

    setSubmitting(true);
    setError(null);
    try {
      const created = await provisionUser(payload);
      // Full success notice — same shape as the web's `.draft-notice`:
      // "{Role} account created for {name} ({email}), at {site}."
      const siteName =
        created.siteId === null
          ? t('more.teamAccess.noSitePlatform')
          : (sites?.find((site) => site.id === created.siteId)?.name ??
            t('more.teamAccess.unknownSite'));
      setConfirmation(
        t('more.teamAccess.confirmation', {
          role: t(roleLabels[created.role]),
          name: `${created.firstName} ${created.lastName}`,
          email: created.email,
          site: siteName,
        }),
      );
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setAddress('');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('more.teamAccess.errors.provisionFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 pb-12 pt-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <PageHeader
            kicker={t('more.teamAccess.kicker')}
            title={t('more.teamAccess.title')}
            subtitle={
              user.role === 'super_admin'
                ? t('more.teamAccess.subtitleSuperAdmin')
                : t('more.teamAccess.subtitleAdmin')
            }
            icon={ShieldCheck}
          >
            <View className="flex-row flex-wrap items-center gap-2">
              <Pill tone="mint" label={t('more.teamAccess.pillAdminsOnly')} />
              <Pill
                tone="neutral"
                label={t('more.teamAccess.sitesAvailable', {
                  count: sites?.length ?? 0,
                  plural: (sites?.length ?? 0) === 1 ? '' : 's',
                })}
              />
            </View>
          </PageHeader>

          <Text className="mb-4 text-[11px] leading-[1.75] text-dashboard-caption">
            {t('more.teamAccess.intro')}
          </Text>

          {confirmation ? (
            <View
              className="mb-4 flex-row items-start gap-2 rounded-lg px-3 py-3"
              style={{ backgroundColor: dashboardColors.statMintSoft }}
            >
              <Check color={dashboardColors.statMintDeep} size={16} />
              <Text
                accessibilityLiveRegion="polite"
                className="flex-1 text-[11.5px] leading-[1.7]"
                style={{ color: dashboardColors.statMintDeep }}
              >
                {confirmation}
              </Text>
            </View>
          ) : null}

          {sitesError ? (
            <StateView
              variant="error"
              title={t('more.teamAccess.couldNotLoadSitesTitle')}
              description={sitesError}
              actionLabel={t('more.teamAccess.retry')}
              onAction={() => {
                void loadSites();
              }}
            />
          ) : null}

          {loadingSites && sites === null ? (
            <StateView variant="loading" title={t('more.teamAccess.loadingSites')} />
          ) : null}

          {!loadingSites && (sites?.length ?? 0) === 0 && !siteless ? (
            <StateView
              variant="empty"
              icon={Users}
              title={t('more.teamAccess.noSitesTitle')}
              description={t('more.teamAccess.noSitesDesc')}
            />
          ) : null}

          {siteless || (sites?.length ?? 0) > 0 ? (
            <>
              <Card className="mb-4">
                <View className="mb-4 flex-row items-center gap-2">
                  <StepBadge step={1} />
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-ink">
                      {t('more.teamAccess.scopeTitle')}
                    </Text>
                    <Text className="mt-0.5 text-[10.5px] leading-[1.6] text-dashboard-caption">
                      {t('more.teamAccess.scopeHint')}
                    </Text>
                  </View>
                </View>

                <Picker
                  label={t('more.teamAccess.roleLabel')}
                  value={role ?? roles[0]}
                  onChange={(value) => setRole(value as UserRole)}
                  options={roleOptions}
                />
                {!siteless ? (
                  <Picker
                    label={t('more.teamAccess.siteLabel')}
                    value={siteId !== null ? String(siteId) : null}
                    onChange={(value) => setSiteId(Number(value))}
                    options={siteOptions}
                  />
                ) : null}

                <View
                  className="flex-row items-center gap-2 rounded-lg px-3 py-2.5"
                  style={{ backgroundColor: dashboardColors.statMintSoft }}
                >
                  <ShieldCheck
                    color={dashboardColors.statMintDeep}
                    size={14}
                  />
                  <Text
                    className="flex-1 text-[10.5px] font-medium leading-[1.6]"
                    style={{ color: dashboardColors.statMintDeep }}
                  >
                    {`${t(roleLabels[role ?? 'staff'])} · ${selectedSiteName}`}
                  </Text>
                </View>

                {siteless ? (
                  <Text className="mt-2 text-[10px] leading-[1.65] text-dashboard-caption">
                    {t('more.teamAccess.platformLevelNote', {
                      role: t(roleLabels[role ?? 'staff']),
                    })}
                  </Text>
                ) : null}
              </Card>

              <Card className="mb-4">
                <View className="mb-4 flex-row items-center gap-2">
                  <StepBadge step={2} />
                  <View className="flex-1">
                    <Text className="text-[13px] font-semibold text-ink">
                      {t('more.teamAccess.identityTitle')}
                    </Text>
                    <Text className="mt-0.5 text-[10.5px] leading-[1.6] text-dashboard-caption">
                      {t('more.teamAccess.identityHint')}
                    </Text>
                  </View>
                  <KeyRound
                    color={dashboardColors.statMintDeep}
                    size={16}
                  />
                </View>

                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <TextField
                      label={t('more.teamAccess.firstNameLabel')}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>
                  <View className="flex-1">
                    <TextField
                      label={t('more.teamAccess.lastNameLabel')}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <TextField
                  label={t('more.teamAccess.emailLabel')}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <TextField
                  label={t('more.teamAccess.passwordLabel')}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  placeholder={t('more.teamAccess.passwordPlaceholder', {
                    count: policy?.passwordMinLength ?? 'the server-required number of',
                  })}
                />
                <Text className="-mt-3 mb-4 text-[10px] leading-[1.65] text-dashboard-caption">
                  {t('more.teamAccess.passwordHint', {
                    count: policy?.passwordMinLength ?? 'the required number of',
                  })}
                </Text>
                <TextField
                  label={t('more.teamAccess.phoneLabel')}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
                <TextField
                  label={t('more.teamAccess.addressLabel')}
                  value={address}
                  onChangeText={setAddress}
                  autoCapitalize="words"
                />

                {error ? (
                  <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
                    <Text
                      accessibilityRole="alert"
                      className="text-[11px] leading-[1.7] text-dashboard-error-text"
                    >
                      {error}
                    </Text>
                  </View>
                ) : null}

                <Button
                  label={
                    submitting
                      ? t('more.teamAccess.creating')
                      : t('more.teamAccess.createAccount')
                  }
                  loading={submitting}
                  onPress={() => void onSubmit()}
                >
                  {submitting ? (
                    <Text
                      className="text-[15px] font-semibold"
                      style={{ color: dashboardColors.ctaText }}
                    >
                      {t('more.teamAccess.creating')}
                    </Text>
                  ) : (
                    <View className="flex-row items-center gap-2">
                      <UserPlus
                        color={dashboardColors.ctaText}
                        size={16}
                        strokeWidth={2.2}
                      />
                      <Text
                        className="text-[15px] font-semibold"
                        style={{ color: dashboardColors.ctaText }}
                      >
                        {t('more.teamAccess.createAccount')}
                      </Text>
                    </View>
                  )}
                </Button>
              </Card>
            </>
          ) : null}

          {/* "Super-admin access is separate" — mirrors the web's
              `.access-policy-summary` section. The mobile doesn't have a
              dedicated /access-policy route, so the link is informational. */}
          <Card>
            <View className="mb-1 flex-row items-center gap-2">
              <ShieldCheck color={dashboardColors.statMintDeep} size={15} />
              <Text className="flex-1 text-[13px] font-semibold text-ink">
                {t('more.teamAccess.superAdminSeparate')}
              </Text>
            </View>
            <Text className="mb-2 mt-1 text-[11px] leading-[1.75] text-dashboard-subtitle">
              {policy?.managedRoleMessage ?? t('more.teamAccess.managedAccessFallback')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showCriteria }}
              onPress={() => setShowCriteria((open) => !open)}
              hitSlop={8}
              className="flex-row items-center gap-1 self-start active:opacity-70"
            >
              <Text
                className="text-[11px] font-semibold"
                style={{ color: dashboardColors.teal }}
              >
                {t(
                  showCriteria
                    ? 'more.teamAccess.hideCriteria'
                    : 'more.teamAccess.viewCriteria',
                )}
              </Text>
              <ArrowRight
                color={dashboardColors.teal}
                size={13}
                style={{
                  transform: [{ rotate: showCriteria ? '90deg' : '0deg' }],
                }}
              />
            </Pressable>
            {showCriteria ? (
              <View
                className="mt-2 gap-1.5 rounded-lg px-3 py-2.5"
                style={{ backgroundColor: dashboardColors.pillBg }}
              >
                <Text className="text-[10.5px] leading-[1.6]" style={{ color: dashboardColors.subtitle }}>
                  {`• ${t('more.teamAccess.criteriaProvisioning')}`}
                </Text>
                <Text className="text-[10.5px] leading-[1.6]" style={{ color: dashboardColors.subtitle }}>
                  {`• ${t('more.teamAccess.criteriaPassword', {
                    count: policy?.passwordMinLength ?? 8,
                  })}`}
                </Text>
                {selfRoles ? (
                  <Text className="text-[10.5px] leading-[1.6]" style={{ color: dashboardColors.subtitle }}>
                    {`• ${t('more.teamAccess.criteriaSelfRegistration', { roles: selfRoles })}`}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Card>

          {confirmation ? (
            <Text className="mt-3 text-[10px] leading-[1.7] text-dashboard-caption">
              {t('more.teamAccess.dismissNote')}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
