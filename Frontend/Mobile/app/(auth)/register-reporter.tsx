import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

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
      setServerError(err instanceof Error ? err.message : 'Unable to prepare your form.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register(payload);
      setAccountCreated(true);
      try {
        await login({ email: payload.email, password: payload.password });
      } catch {
        setServerError(
          'Your account was created, but automatic sign-in did not finish. Sign in with your new account.',
        );
      }
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
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
          Your reporter account is ready
        </Text>
        <Text className="mt-3.5 text-[12px] leading-[21px] text-auth-body">
          {serverError ?? 'Sign in with the email and password you just chose.'}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/(auth)/login')}
          className="mt-2 self-start py-2.5 active:opacity-70"
        >
          <Text
            className="text-[11px] text-coral-link"
            style={{ fontFamily: fontFamilies.bodySemiBold }}
          >
            Continue to sign in →
          </Text>
        </Pressable>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <BackToRoles router={router} />
      <AuthHeading
        kicker="REPORTER SIGN-UP"
        title="Create your reporter account"
        titleAccent="."
        description="You'll be the person who files issues at your site."
      />

      <Text className="mb-6 text-[11px] leading-[20px] text-auth-body">
        Your site administrator will provide the site ID to use here. Contact
        them if you don't have it yet.
      </Text>

      <View className="flex-row gap-3">
        <AuthField
          label="First name"
          value={details.firstName}
          onChangeText={(v) => update('firstName', v)}
          error={errors.firstName}
          autoCapitalize="words"
          textContentType="givenName"
          className="flex-1"
          placeholder="Alex"
        />
        <AuthField
          label="Last name"
          value={details.lastName}
          onChangeText={(v) => update('lastName', v)}
          error={errors.lastName}
          autoCapitalize="words"
          textContentType="familyName"
          className="flex-1"
          placeholder="Ng"
        />
      </View>

      <AuthField
        label="Email"
        value={details.email}
        onChangeText={(v) => update('email', v)}
        error={errors.email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholder="you@example.com"
      />

      <AuthField
        label="Password"
        value={details.password}
        onChangeText={(v) => update('password', v)}
        error={errors.password}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        placeholder="At least 15 characters"
      />

      <AuthField
        label="Site ID"
        value={details.siteId}
        onChangeText={(v) => update('siteId', v)}
        error={errors.siteId}
        keyboardType="number-pad"
        placeholder="e.g. 1"
      />

      <AuthField
        label="Phone (optional)"
        value={details.phone}
        onChangeText={(v) => update('phone', v)}
        error={errors.phone}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder="+65 …"
      />

      {serverError ? (
        <Text className="my-2 text-[12px] leading-[20px] text-auth-danger">
          {serverError}
        </Text>
      ) : null}

      <AuthButton
        label="Create reporter account →"
        loading={submitting}
        onPress={submit}
      />
    </AuthShell>
  );
}

export function BackToRoles({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={false}
      onPress={() => router.replace('/(auth)/register')}
      className="mb-4 min-h-[30px] flex-row items-center gap-1.5 active:opacity-60"
    >
      <ArrowLeft color={authColors.note} size={14} />
      <Text className="text-[10px] text-auth-note">Change role</Text>
    </Pressable>
  );
}
