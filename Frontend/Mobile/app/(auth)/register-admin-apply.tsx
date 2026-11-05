import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { Picker } from '@/components/ui/Picker';
import { authColors, fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import * as authApi from '@/services/auth';
import { ApiError } from '@/services/auth';
import { buildRegistrationPayload, validateRegistration } from '@/utils/registration';
import type { RegistrationFieldErrors } from '@/utils/registration';
import type { SiteType } from '@/types';
import { BackToRoles } from './register-reporter';

type Details = {
  firstName: string; lastName: string; email: string;
  password: string; phone: string;
  siteName: string; siteType?: SiteType;
  siteAddress: string; siteDescription: string;
};

/**
 * Admin self-apply screen. The applicant describes their site (name, type,
 * address) during registration. The backend creates the site immediately,
 * links it to the new reporter account, and files a pending admin
 * application. Super_admin approves → reporter flips to admin, now owns
 * the site they described. No pre-existing site required.
 */
export default function RegisterAdminApplyScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [details, setDetails] = useState<Details>({
    firstName: '', lastName: '', email: '', password: '', phone: '',
    siteName: '', siteType: undefined, siteAddress: '', siteDescription: '',
  });
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  if (!isLoading && isAuthenticated) return <Redirect href="/(tabs)" />;

  function update<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
    setServerError(null);
  }

  function validateAll(): RegistrationFieldErrors {
    return validateRegistration({ ...details, role: 'admin', siteId: '' });
  }

  async function submit() {
    if (submitting || accountCreated) return;
    const all = validateAll();
    setErrors(all);
    setServerError(null);
    if (Object.keys(all).length > 0) return;

    let payload;
    try {
      payload = buildRegistrationPayload({ ...details, role: 'admin', siteId: '' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('auth.registerAdminApply.errors.prepareForm'));
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register(payload);
      setAccountCreated(true);
      try {
        await login({ email: payload.email, password: payload.password });
      } catch {
        setServerError(t('auth.registerAdminApply.errors.accountCreatedButAutoSignInFailed'));
      }
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : t('auth.registerAdminApply.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  if (accountCreated) {
    return (
      <AuthShell>
        <View className="my-2 flex-row items-center gap-2">
          <ShieldCheck color={authColors.roseDeep} size={22} />
          <Text
            className="text-[22px] text-auth-ink"
            style={{ fontFamily: fontFamilies.headBold, letterSpacing: -0.8 }}
          >
            {t('auth.registerAdminApply.submittedTitle')}
          </Text>
        </View>
        <Text className="mt-2 text-[12px] leading-[21px] text-auth-body">
          {t('auth.registerAdminApply.submittedBody')}
          {serverError ? ` ${serverError}` : ''}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('auth.registerAdminApply.continueSignIn')}
          onPress={() => router.replace('/(auth)/login')}
          className="mt-2 self-start py-2.5 active:opacity-70"
        >
          <Text
            className="text-[11px] text-coral-link"
            style={{ fontFamily: fontFamilies.bodySemiBold }}
          >
            {t('auth.registerAdminApply.continueSignIn')}
          </Text>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <BackToRoles router={router} t={t} />
        <AuthHeading
          kicker={t('auth.registerAdminApply.kicker')}
          title={t('auth.registerAdminApply.title')}
          titleAccent="."
          description={t('auth.registerAdminApply.description')}
        />

        <Text className="mb-6 text-[11px] leading-[20px] text-auth-body">
          {t('auth.registerAdminApply.applyNotice')}
        </Text>

        {/* Personal */}
        <View className="flex-row gap-3">
          <AuthField
            label={t('auth.registerAdminApply.firstName')}
            value={details.firstName}
            onChangeText={(v) => update('firstName', v)}
            error={errors.firstName}
            autoCapitalize="words"
            textContentType="givenName"
            className="flex-1"
            placeholder={t('auth.registerAdminApply.firstNamePlaceholder')}
          />
          <AuthField
            label={t('auth.registerAdminApply.lastName')}
            value={details.lastName}
            onChangeText={(v) => update('lastName', v)}
            error={errors.lastName}
            autoCapitalize="words"
            textContentType="familyName"
            className="flex-1"
            placeholder={t('auth.registerAdminApply.lastNamePlaceholder')}
          />
        </View>

        <AuthField
          label={t('auth.registerAdminApply.email')}
          value={details.email}
          onChangeText={(v) => update('email', v)}
          error={errors.email}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          placeholder={t('auth.registerAdminApply.emailPlaceholder')}
        />

        <AuthField
          label={t('auth.registerAdminApply.password')}
          value={details.password}
          onChangeText={(v) => update('password', v)}
          error={errors.password}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          placeholder={t('auth.registerAdminApply.passwordPlaceholder')}
        />

        <AuthField
          label={t('auth.registerAdminApply.phoneOptional')}
          value={details.phone}
          onChangeText={(v) => update('phone', v)}
          error={errors.phone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder={t('auth.registerAdminApply.phonePlaceholder')}
        />

        {/* Site section */}
        <Text className="mt-4 mb-1 text-[10px] font-bold uppercase tracking-[1.5px] text-auth-muted">
          {t('auth.registerAdminApply.siteSection')}
        </Text>

        <AuthField
          label={t('auth.registerAdminApply.siteName')}
          value={details.siteName}
          onChangeText={(v) => update('siteName', v)}
          error={errors.siteName}
          placeholder={t('auth.registerAdminApply.siteNamePlaceholder')}
        />

        <Picker
          label={t('auth.registerAdminApply.siteType')}
          value={details.siteType ?? null}
          onChange={(v) => update('siteType', v as SiteType)}
          options={[
            { label: t('auth.registerAdminApply.siteTypeSchool'), value: 'school' },
            { label: t('auth.registerAdminApply.siteTypeHotel'), value: 'hotel' },
            { label: t('auth.registerAdminApply.siteTypeHostel'), value: 'hostel' },
          ]}
        />
        {errors.siteType ? (
          <Text className="mb-4 -mt-2 text-[11px] text-auth-danger">{errors.siteType}</Text>
        ) : null}

        <AuthField
          label={t('auth.registerAdminApply.siteAddress')}
          value={details.siteAddress}
          onChangeText={(v) => update('siteAddress', v)}
          error={errors.siteAddress}
          placeholder={t('auth.registerAdminApply.siteAddressPlaceholder')}
        />

        <AuthField
          label={t('auth.registerAdminApply.siteDescriptionOptional')}
          value={details.siteDescription}
          onChangeText={(v) => update('siteDescription', v)}
          error={errors.siteDescription}
          placeholder={t('auth.registerAdminApply.siteDescriptionPlaceholder')}
          multiline
          numberOfLines={3}
        />

        {serverError ? (
          <Text className="my-2 text-[12px] leading-[20px] text-auth-danger">
            {serverError}
          </Text>
        ) : null}

        <AuthButton
          label={t('auth.registerAdminApply.submit')}
          loading={submitting}
          onPress={submit}
        />
      </ScrollView>
    </AuthShell>
  );
}
