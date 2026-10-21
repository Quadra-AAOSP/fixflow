import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { authColors, fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import * as authApi from '@/services/auth';
import { ApiError } from '@/services/auth';
import { buildRegistrationPayload, validateRegistration } from '@/utils/registration';
import type { RegistrationFieldErrors } from '@/utils/registration';

type Details = {
  firstName: string; lastName: string; email: string;
  password: string; siteId: string; phone: string;
};

/**
 * Dedicated reporter registration form. Distinct from the technician form —
 * this one requires a site ID and skips the business address + legal-name
 * fields. Per-field inline validation gives users friendly feedback before
 * they submit; the server still runs its own policy checks.
 */
export default function RegisterReporterScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [details, setDetails] = useState<Details>({
    firstName: '', lastName: '', email: '', password: '', siteId: '', phone: '',
  });
  const [errors, setErrors] = useState<RegistrationFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  if (!isLoading && isAuthenticated) return <Redirect href="/(tabs)" />;

  function update<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
    // Clear the field's inline error on re-type.
    setErrors((e) => {
      if (!e[key]) return e;
      const copy = { ...e };
      delete copy[key];
      return copy;
    });
    setServerError(null);
  }

  function validateAll(): RegistrationFieldErrors {
    return validateRegistration({ ...details, role: 'reporter' });
  }

  async function submit() {
    if (submitting || accountCreated) return;
    const all = validateAll();
    setErrors(all);
    setServerError(null);
    if (Object.keys(all).length > 0) return;

    let payload;
    try {
      payload = buildRegistrationPayload({ ...details, role: 'reporter' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('auth.registerReporter.errors.prepareForm'));
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register(payload);
      setAccountCreated(true);
      try {
        await login({ email: payload.email, password: payload.password });
      } catch {
        setServerError(t('auth.registerReporter.errors.accountCreatedButAutoSignInFailed'));
      }
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : t('auth.registerReporter.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  if (accountCreated) {
    return (
      <AuthShell>
        <Text
          className="text-[26px] leading-8 text-auth-ink"
          style={{ fontFamily: fontFamilies.headBold, letterSpacing: -0.8 }}
        >
          {t('auth.registerReporter.accountReadyTitle')}
        </Text>
        <Text className="mt-3.5 text-[12px] leading-[21px] text-auth-body">
          {serverError ?? t('auth.registerReporter.accountReadyBody')}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('auth.registerReporter.continueSignIn')}
          onPress={() => router.replace('/(auth)/login')}
          className="mt-2 self-start py-2.5 active:opacity-70"
        >
          <Text
            className="text-[11px] text-coral-link"
            style={{ fontFamily: fontFamilies.bodySemiBold }}
          >
            {t('auth.registerReporter.continueSignIn')}
          </Text>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <BackToRoles router={router} t={t} />
      <AuthHeading
        kicker={t('auth.registerReporter.kicker')}
        title={t('auth.registerReporter.title')}
        titleAccent="."
        description={t('auth.registerReporter.description')}
      />

      <Text className="mb-6 text-[11px] leading-[20px] text-auth-body">
        {t('auth.registerReporter.siteIdHelp')}
      </Text>

      <View className="flex-row gap-3">
        <AuthField
          label={t('auth.registerReporter.firstName')}
          value={details.firstName}
          onChangeText={(v) => update('firstName', v)}
          error={errors.firstName}
          autoCapitalize="words"
          textContentType="givenName"
          className="flex-1"
          placeholder={t('auth.registerReporter.firstNamePlaceholder')}
        />
        <AuthField
          label={t('auth.registerReporter.lastName')}
          value={details.lastName}
          onChangeText={(v) => update('lastName', v)}
          error={errors.lastName}
          autoCapitalize="words"
          textContentType="familyName"
          className="flex-1"
          placeholder={t('auth.registerReporter.lastNamePlaceholder')}
        />
      </View>

      <AuthField
        label={t('auth.registerReporter.email')}
        value={details.email}
        onChangeText={(v) => update('email', v)}
        error={errors.email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholder={t('auth.registerReporter.emailPlaceholder')}
      />

      <AuthField
        label={t('auth.registerReporter.password')}
        value={details.password}
        onChangeText={(v) => update('password', v)}
        error={errors.password}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        placeholder={t('auth.registerReporter.passwordPlaceholder')}
      />

      <AuthField
        label={t('auth.registerReporter.siteId')}
        value={details.siteId}
        onChangeText={(v) => update('siteId', v)}
        error={errors.siteId}
        keyboardType="number-pad"
        placeholder={t('auth.registerReporter.siteIdPlaceholder')}
      />

      <AuthField
        label={t('auth.registerReporter.phoneOptional')}
        value={details.phone}
        onChangeText={(v) => update('phone', v)}
        error={errors.phone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder={t('auth.registerReporter.phonePlaceholder')}
      />

      {serverError ? (
        <Text className="my-2 text-[12px] leading-[20px] text-auth-danger">
          {serverError}
        </Text>
      ) : null}

      <AuthButton
        label={t('auth.registerReporter.submit')}
        loading={submitting}
        onPress={submit}
      />
    </AuthShell>
  );
}

export function BackToRoles({
  router,
  t,
}: {
  router: ReturnType<typeof useRouter>;
  t: (key: string) => string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('auth.registerReporter.changeRole')}
      disabled={false}
      onPress={() => router.replace('/(auth)/register')}
      className="mb-4 min-h-[30px] flex-row items-center gap-1.5 active:opacity-60"
    >
      <ArrowLeft color={authColors.note} size={14} />
      <Text className="text-[10px] text-auth-note">{t('auth.registerReporter.changeRole')}</Text>
    </Pressable>
  );
}
