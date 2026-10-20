import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ArrowRight, Check, ShieldCheck, UserPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import {
  canProvision,
  provisionableRoles,
  roleLabels,
} from '@/constants/access';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useAccountPolicy } from '@/hooks/useAccountPolicy';
import { ApiError } from '@/lib/apiClient';
import { provisionUser } from '@/services/admin';
import { listSites } from '@/services/sites';
import type { ProvisionUserPayload, Site, UserRole } from '@/types';

/**
 * Team access. Admin and super_admin only. Mirrors `TeamAccessView.vue` on the
 * web build — the actor picks a role, a site, fills the new user's name /
 * work email / initial password, and the backend mints the account. The
 * backend returns the new user; the new person signs in themselves.
 */
export default function TeamAccessScreen() {
  const palette = themeColors();
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
    label: roleLabels[value],
  }));

  // Shop managers (and super admins) are platform-level accounts — the
  // backend requires a null siteId for them (`AuthService.resolveSiteForRole`).
  const siteless = role === 'shop_manager' || role === 'super_admin';

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
            `Site #${created.siteId}`);
      setConfirmation(
        t('more.teamAccess.confirmation', {
          role: roleLabels[created.role],
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
        {/* Card heading — mirrors the web's `.card-heading` with a
            large `ShieldCheck` on the right. */}
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              {t('more.teamAccess.title')}
            </Text>
            <Text className="mt-1 text-[13px] leading-[1.7] text-dashboard-subtitle">
              {user.role === 'super_admin'
                ? t('more.teamAccess.subtitleSuperAdmin')
                : t('more.teamAccess.subtitleAdmin')}
            </Text>
            <Text className="mt-2 text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('more.teamAccess.intro')}
            </Text>
          </View>
          <ShieldCheck color={dashboardColors.statMintDeep} size={30} />
        </View>

        {sitesError ? (
          <StateView
            variant="error"
            title={t('more.teamAccess.couldNotLoadSitesTitle')}
            description={sitesError}
            actionLabel={t('more.teamAccess.retry')}
            onAction={() => {
              void loadSites();
            }}
            className="py-6"
          />
        ) : null}

        {loadingSites && sites === null ? (
          <Card>
            <Text className="text-sm text-dashboard-subtitle">{t('more.teamAccess.loadingSites')}</Text>
          </Card>
        ) : null}

        {!loadingSites && (sites?.length ?? 0) === 0 && !siteless ? (
          <StateView
            variant="empty"
            title={t('more.teamAccess.noSitesTitle')}
            description={t('more.teamAccess.noSitesDesc')}
          />
        ) : null}

        {siteless || (sites?.length ?? 0) > 0 ? (
          <Card className="mb-4">
            {confirmation ? (
              <View
                className="mb-3 flex-row items-start gap-2 rounded-md px-3 py-2"
                style={{ backgroundColor: dashboardColors.statMintSoft }}
              >
                <Check color={dashboardColors.statMintDeep} size={16} />
                <Text
                  className="flex-1 text-[12px] leading-[1.6]"
                  style={{ color: dashboardColors.statMintDeep }}
                >
                  {confirmation}
                </Text>
              </View>
            ) : null}

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Picker
                  label={t('more.teamAccess.roleLabel')}
                  value={role ?? roles[0]}
                  onChange={(value) => setRole(value as UserRole)}
                  options={roleOptions}
                />
              </View>
              {!siteless ? (
                <View className="flex-1">
                  <Picker
                    label={t('more.teamAccess.siteLabel')}
                    value={siteId !== null ? String(siteId) : null}
                    onChange={(value) => setSiteId(Number(value))}
                    options={siteOptions}
                  />
                </View>
              ) : null}
            </View>

            {siteless ? (
              <Text className="-mt-2 mb-4 text-[10px] leading-[1.65] text-dashboard-subtitle">
                {t('more.teamAccess.platformLevelNote', {
                  role: roleLabels[role ?? 'staff'],
                })}
              </Text>
            ) : null}

            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField
                  label={t('more.teamAccess.firstNameLabel')}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"                />
              </View>
              <View className="flex-1">
                <TextField
                  label={t('more.teamAccess.lastNameLabel')}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"                />
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
              })}            />
            <Text className="-mt-3 mb-4 text-[10px] leading-[1.65] text-dashboard-subtitle">
              {t('more.teamAccess.passwordHint', {
                count: policy?.passwordMinLength ?? 'the required number of',
              })}
            </Text>
            <TextField
              label={t('more.teamAccess.phoneLabel')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"            />
            <TextField
              label={t('more.teamAccess.addressLabel')}
              value={address}
              onChangeText={setAddress}
              autoCapitalize="words"            />

            {error ? (
              <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
                <Text className="text-[11px] leading-[1.7] text-dashboard-error-text">
                  {error}
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={onSubmit}
              className="mt-1 flex-row items-center justify-center gap-2 rounded-[11px] border px-4 py-3 active:opacity-90"
              style={{
                backgroundColor: dashboardColors.ctaBg,
                borderColor: dashboardColors.ctaBorder,
                opacity: submitting ? 0.55 : 1,
              }}
            >
              <UserPlus
                color={dashboardColors.ctaText}
                size={17}
                strokeWidth={2.2}
              />
              <Text
                className="text-[14px] font-semibold"
                style={{ color: dashboardColors.ctaText }}
              >
                {submitting
                  ? t('more.teamAccess.creating')
                  : t('more.teamAccess.createAccount')}
              </Text>
            </Pressable>
          </Card>
        ) : null}

        {/* "Super-admin access is separate" — mirrors the web's
            `.access-policy-summary` section. The mobile doesn't have a
            dedicated /access-policy route, so the link is informational. */}
        <Card>
          <Text
            className="mb-1 text-[15px] font-semibold text-ink"
            style={{ letterSpacing: -0.3 }}
          >
            {t('more.teamAccess.superAdminSeparate')}
          </Text>
          <Text className="mb-2 text-[12px] leading-[1.8] text-dashboard-subtitle">
            {policy?.managedRoleMessage ?? t('more.teamAccess.managedAccessFallback')}
          </Text>
          <View className="flex-row items-center gap-1 self-start">
            <Text
              className="text-[11px] font-semibold"
              style={{ color: dashboardColors.teal }}
            >
              {t('more.teamAccess.viewCriteria')}
            </Text>
            <ArrowRight color={dashboardColors.teal} size={13} />
          </View>
        </Card>

        {/* Keeps the old "you can dismiss a confirmation" footnote hidden
            under the new "Super-admin access is separate" card, but only
            when no confirmation is showing — the visual weight should
            belong to the policy section. */}
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
