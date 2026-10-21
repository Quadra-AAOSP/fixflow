import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import * as authApi from '@/services/auth';
import { ApiError } from '@/services/auth';
import { buildRegistrationPayload, validateRegistration } from '@/utils/registration';
import type { RegistrationFieldErrors } from '@/utils/registration';
import { BackToRoles } from './register-reporter';

type Details = {
  firstName: string; lastName: string; email: string;
  password: string; phone: string; address: string;
};

/**
 * Dedicated technician registration form. Distinct from the reporter form —
 * technicians skip site ID (independent by default), add a business/correspondence
 * address, and use "Legal first/last name" labels so identity documents can
 * be matched later.
 */
export default function RegisterTechnicianScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [details, setDetails] = useState<Details>({
    firstName: '', lastName: '', email: '', password: '', phone: '', address: '',
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
    return validateRegistration({ ...details, role: 'technician', siteId: '' });
  }

  async function submit() {
    if (submitting || accountCreated) return;
    const all = validateAll();
    setErrors(all);
    setServerError(null);
    if (Object.keys(all).length > 0) return;

    let payload;
    try {
      payload = buildRegistrationPayload({ ...details, role: 'technician', siteId: '' });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('auth.registerTechnician.errors.prepareForm'));
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register(payload);
      setAccountCreated(true);
      try {
        await login({ email: payload.email, password: payload.password });
      } catch {
        setServerError(t('auth.registerTechnician.errors.accountCreatedButAutoSignInFailed'));
      }
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : t('auth.registerTechnician.errors.generic'));
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
          {t('auth.registerTechnician.accountReadyTitle')}
        </Text>
        <Text className="mt-3.5 text-[12px] leading-[21px] text-auth-body">
          {serverError ?? t('auth.registerTechnician.accountReadyBody')}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('auth.registerTechnician.continueSignIn')}
          onPress={() => router.replace('/(auth)/login')}
          className="mt-2 self-start py-2.5 active:opacity-70"
        >
          <Text
            className="text-[11px] text-coral-link"
            style={{ fontFamily: fontFamilies.bodySemiBold }}
          >
            {t('auth.registerTechnician.continueSignIn')}
          </Text>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <BackToRoles router={router} t={t} />
      <AuthHeading
        kicker={t('auth.registerTechnician.kicker')}
        title={t('auth.registerTechnician.title')}
        titleAccent="."
        description={t('auth.registerTechnician.description')}
      />

      <Text className="mb-6 text-[11px] leading-[20px] text-auth-body">
        {t('auth.registerTechnician.independentNote')}
      </Text>

      <View className="flex-row gap-3">
        <AuthField
          label={t('auth.registerTechnician.firstName')}
          value={details.firstName}
          onChangeText={(v) => update('firstName', v)}
          error={errors.firstName}
          autoCapitalize="words"
          textContentType="givenName"
          className="flex-1"
          placeholder={t('auth.registerTechnician.firstNamePlaceholder')}
        />
        <AuthField
          label={t('auth.registerTechnician.lastName')}
          value={details.lastName}
          onChangeText={(v) => update('lastName', v)}
          error={errors.lastName}
          autoCapitalize="words"
          textContentType="familyName"
          className="flex-1"
          placeholder={t('auth.registerTechnician.lastNamePlaceholder')}
        />
      </View>

      <AuthField
        label={t('auth.registerTechnician.email')}
        value={details.email}
        onChangeText={(v) => update('email', v)}
        error={errors.email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholder={t('auth.registerTechnician.emailPlaceholder')}
      />

      <AuthField
        label={t('auth.registerTechnician.password')}
        value={details.password}
        onChangeText={(v) => update('password', v)}
        error={errors.password}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        placeholder={t('auth.registerTechnician.passwordPlaceholder')}
      />

      <AuthField
        label={t('auth.registerTechnician.contactPhone')}
        value={details.phone}
        onChangeText={(v) => update('phone', v)}
        error={errors.phone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder={t('auth.registerTechnician.phonePlaceholder')}
      />

      <AuthField
        label={t('auth.registerTechnician.address')}
        value={details.address}
        onChangeText={(v) => update('address', v)}
        error={errors.address}
        autoCapitalize="sentences"
        textContentType="fullStreetAddress"
        autoComplete="street-address"
        placeholder={t('auth.registerTechnician.addressPlaceholder')}
      />
      <Text className="-mt-3 mb-4 text-[10px] leading-[17px] text-auth-body">
        {t('auth.registerTechnician.qualificationNotice')}
      </Text>

      {serverError ? (
        <Text className="my-2 text-[12px] leading-[20px] text-auth-danger">
          {serverError}
        </Text>
      ) : null}

      <AuthButton
        label={t('auth.registerTechnician.submit')}
        loading={submitting}
        onPress={submit}
      />
    </AuthShell>
  );
}
