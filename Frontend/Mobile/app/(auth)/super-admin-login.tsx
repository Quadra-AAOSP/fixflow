import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import * as authApi from '@/services/auth';
import { ApiError } from '@/services/auth';

/**
 * Super admin gate.
 *
 * Two properties distinguish this from the normal sign-in:
 *   1. The email field is locked to admin@fixflow.local — a user cannot
 *      accidentally type their own credentials and end up confused.
 *   2. After the backend accepts the credentials we double-check the
 *      returned user.role === 'super_admin' client-side before letting
 *      them into the dashboard. If it's not, we log them out again and
 *      show an error — no privilege escalation through a mis-seeded
 *      backend record.
 *
 * Regular staff, site admins, technicians and reporters use the normal
 * sign-in form at /(auth)/login. They will never arrive here unless they
 * know the admin email and click the gate.
 */
const SUPER_ADMIN_EMAIL = 'admin@fixflow.local';

export default function SuperAdminLoginScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login, logout, user, isAuthenticated, isLoading } = useAuth();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  if (!isLoading && isAuthenticated && user?.role === 'super_admin') {
    return <Redirect href="/(tabs)" />;
  }

  async function onSubmit() {
    setError(null);
    if (!password) {
      setError(t('auth.superAdminLogin.errors.passwordRequired'));
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: SUPER_ADMIN_EMAIL, password });
      // login() populates the store, but we can't read it synchronously
      // in this callback. Hit getMe() to verify the backend returned a
      // super_admin record — the account may have been mis-seeded.
      const me = await authApi.getMe();
      if (me.role !== 'super_admin') {
        await logout().catch(() => {});
        setError(t('auth.superAdminLogin.errors.notSuperAdmin'));
        return;
      }
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? t('auth.superAdminLogin.errors.invalidPassword')
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
        kicker={t('auth.superAdminLogin.kicker')}
        icon={ShieldAlert}
        title={t('auth.superAdminLogin.title')}
        titleAccent="."
        description={t('auth.superAdminLogin.description')}
      />

      {/* Locked email — read-only, no interaction. */}
      <View className="mb-2">
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-auth-note">
          {t('auth.superAdminLogin.emailLabel')}
        </Text>
        <View className="h-12 justify-center rounded-[11px] border border-auth-line bg-auth-card-bg px-3.5">
          <Text
            className="text-[14px] text-auth-ghost-ink"
            style={{ fontFamily: fontFamilies.bodyMedium }}
          >
            {SUPER_ADMIN_EMAIL}
          </Text>
        </View>
      </View>

      <AuthField
        label={t('auth.superAdminLogin.passwordLabel')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        placeholder={t('auth.superAdminLogin.passwordPlaceholder')}
        inputRef={passwordRef}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />

      {error ? (
        <Text className="mb-3 text-[13px] text-auth-danger">{error}</Text>
      ) : null}

      <AuthButton
        label={t('auth.superAdminLogin.submit')}
        loading={submitting}
        onPress={onSubmit}
      />

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('auth.superAdminLogin.backToSignIn')}
        onPress={() => router.replace('/(auth)/login')}
        className="mt-3 min-h-[44px] items-center justify-center active:opacity-70"
      >
        <Text className="text-center text-[12px] text-auth-body">
          {t('auth.superAdminLogin.backToSignIn')}
        </Text>
      </Pressable>

      <View className="mt-4 flex-row items-center gap-2.5 border-t border-auth-line pt-5">
        <ShieldCheck color="#7caa70" size={14} />
        <Text className="flex-1 text-[10px] text-auth-note">
          {t('auth.superAdminLogin.disclaimer')}
        </Text>
      </View>
    </AuthShell>
  );
}
