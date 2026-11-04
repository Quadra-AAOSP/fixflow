import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  ClipboardList,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { authColors, fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/auth';

/**
 * Sign-in. Primary flow for every role — reporter, technician, site admin,
 * staff. Super admins land here too if they know the credentials, but we
 * offer a gated shield entry below that routes them through the dedicated
 * super-admin gate (locked email + role check before entering the dashboard).
 *
 * Below the form we show three role tiles that mirror register.tsx so a
 * returning user can quickly jump into the signup path that matches them
 * — this prevents the "I logged in as a reporter but see staff content"
 * confusion that was the origin of this whole session.
 */
export default function LoginScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
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

      {/* Role path tiles — visible on login so users confirm their role
          before creating an account. Each tile jumps to the matching
          register screen. Site admin routes to the apply screen. */}
      <View className="mt-5">
        <Text className="mb-2 text-[10px] font-semibold uppercase tracking-[1.2px] text-auth-note">
          {t('auth.login.pickPath')}
        </Text>
        <View className="gap-2">
          <RoleTile
            icon={ClipboardList}
            color={authColors.roseDeep}
            bg={authColors.roseSoft}
            title={t('auth.register.reporterTitle')}
            subtitle={t('auth.register.reporterSubtitle')}
            onPress={() => router.push('/(auth)/register-reporter')}
          />
          <RoleTile
            icon={Wrench}
            color={authColors.mintDeep}
            bg={authColors.mintSoft}
            title={t('auth.register.technicianTitle')}
            subtitle={t('auth.register.technicianSubtitle')}
            onPress={() => router.push('/(auth)/register-technician')}
          />
          <RoleTile
            icon={ShieldCheck}
            color={authColors.mintDeep}
            bg={authColors.mintSoft}
            title={t('auth.register.adminTitle')}
            subtitle={t('auth.register.adminSubtitle')}
            onPress={() => router.push('/(auth)/register-admin-apply')}
          />
        </View>
      </View>

      {/* Super admin gate — tiny footer row, intentionally subtle. Non-super
          admins will never reach this unless they know the admin email and
          deliberately click it. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.login.superAdminCta')}
        onPress={() => router.push('/(auth)/super-admin-login')}
        className="mt-5 flex-row items-center justify-center gap-1.5 rounded-md border border-auth-line px-3 py-2 active:opacity-70"
      >
        <ShieldAlert color={authColors.note} size={12} />
        <Text className="text-[11px] text-auth-note">
          {t('auth.login.superAdminCta')}
        </Text>
      </Pressable>

      <Text className="mt-4 text-center text-[10px] leading-[1.6] text-auth-note">
        {t('auth.login.tagline')}
      </Text>
    </AuthShell>
  );
}

type RoleTileProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  color: string;
  bg: string;
};

function RoleTile({ icon: Icon, title, subtitle, onPress, color, bg }: RoleTileProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      className="w-full flex-row items-center gap-3 rounded-[10px] border border-auth-card-line bg-auth-card-bg px-3.5 py-3 active:opacity-70"
    >
      <View
        className="h-[34px] w-[34px] items-center justify-center rounded-[9px]"
        style={{ backgroundColor: bg }}
      >
        <Icon color={color} size={18} />
      </View>
      <View className="flex-1">
        <Text
          className="text-[12px] text-auth-ink"
          style={{ fontFamily: fontFamilies.bodySemiBold }}
        >
          {title}
        </Text>
        <Text className="mt-0.5 text-[10px] leading-[1.4] text-auth-body">
          {subtitle}
        </Text>
      </View>
      <Text className="text-[12px] text-auth-ink">→</Text>
    </Pressable>
  );
}
