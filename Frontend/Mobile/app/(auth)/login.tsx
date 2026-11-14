import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ClipboardList, ShieldAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { fontFamilies, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/auth';

/**
 * Sign-in. Standard functional-app pattern: form first, tiny link below
 * to the register screen where role picker lives. Super admin entry is a
 * subtle shield footer — not a big button, so regular users never see it
 * by accident.
 */
export default function LoginScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login, isAuthenticated, isLoading, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  if (!isLoading && isAuthenticated) {
    return <Redirect href={user?.applicationOnly ? '/application-access' : '/(tabs)'} />;
  }

  async function onSubmit() {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(t('auth.login.errors.required'));
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? t('auth.login.errors.invalidCredentials')
            : err.message,
        );
      } else {
        setError(t('auth.login.errors.noConnection'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeading
        kicker={t('auth.login.kicker')}
        icon={ClipboardList}
        title={t('auth.login.title')}
        titleAccent="."
        description={t('auth.login.description')}
      />

      <AuthField
        label={t('auth.login.emailLabel')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholder={t('auth.login.emailPlaceholder')}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <AuthField
        label={t('auth.login.passwordLabel')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        placeholder={t('auth.login.passwordPlaceholder')}
        inputRef={passwordRef}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />

      {error ? (
        <Text className="mb-3 text-[13px] text-auth-danger">{error}</Text>
      ) : null}

      <AuthButton label={t('auth.login.submit')} loading={submitting} onPress={onSubmit} />

      {/* Standard "New here? Create account" link — full-width row so the
          tap target is 44pt instead of ~18pt inline text. Jumps straight
          to /register where the role picker lives. */}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('auth.login.createAccount')}
        onPress={() => router.push('/(auth)/register')}
        className="mt-3 min-h-[44px] items-center justify-center active:opacity-70"
      >
        <Text className="text-center text-[13px] text-auth-body">
          {t('auth.login.newHere')}{' '}
          <Text
            className="text-coral-link"
            style={{ fontFamily: fontFamilies.bodySemiBold }}
          >
            {t('auth.login.createAccount')}
          </Text>
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('auth.login.trackSiteApplication')}
        onPress={() => router.push('/(auth)/track-site')}
        className="min-h-[44px] items-center justify-center active:opacity-70"
      >
        <Text
          className="text-center text-[13px] text-coral-link"
          style={{ fontFamily: fontFamilies.bodySemiBold }}
        >
          {t('auth.login.trackSiteApplication')}
        </Text>
      </Pressable>

      {/* Super admin gate — tiny footer row with a shield icon. Intentionally
          subtle so non-super-admins never reach it unless they know it's
          there. Routes to the dedicated locked-email screen. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.login.superAdminCta')}
        onPress={() => router.push('/(auth)/super-admin-login')}
        className="mt-2 flex-row items-center justify-center gap-1.5 rounded-md border border-auth-line px-3 py-2 active:opacity-70"
      >
        <ShieldAlert color={themeColors().muted} size={11} />
        <Text className="text-[10px] text-auth-note">
          {t('auth.login.superAdminCta')}
        </Text>
      </Pressable>

      <Text className="mt-4 text-center text-[10px] leading-[1.6] text-auth-note">
        {t('auth.login.tagline')}
      </Text>
    </AuthShell>
  );
}
