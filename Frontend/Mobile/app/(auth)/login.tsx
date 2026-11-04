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
 * Sign-in. Two flows, one screen:
 *
 *   1. NEW USER — arrives with no account. Sees three role picker tiles
 *      first, picks how they'll help (reporter / technician / site admin),
 *      lands on the matching register form. Site admin applications are
 *      demoted by the backend and filed as pending super-admin approvals.
 *
 *   2. RETURNING USER — scrolls past the role tiles, signs in with
 *      email + password. Super admins use the gated shield footer instead.
 *
 * Role routing after login (handled by tabAccess.ts / (tabs)/_layout.tsx):
 *   reporter   → /(tabs)
 *   technician → /(tabs)/workspace + assignments
 *   admin      → /(tabs)/more (admin dashboard)
 *   super_admin → /(tabs) (platform console) — but must enter through
 *                 the dedicated gate at /(auth)/super-admin-login
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

      {/* ── NEW USER FLOW (on top) ────────────────────────────────────────── */}
      <View className="gap-2">
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-auth-note">
          {t('auth.login.pickPath')}
        </Text>

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

      {/* Thin divider before the returning-user form. */}
      <View className="my-5 flex-row items-center gap-2 border-t border-auth-line pt-5">
        <Text className="text-[10px] font-semibold uppercase tracking-[1.2px] text-auth-note">
          {t('auth.login.returningHeading')}
        </Text>
      </View>

      {/* ── RETURNING USER FLOW ──────────────────────────────────────────── */}
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

      {/* Super admin gate — subtle footer row, intentionally easy to miss
          unless you're looking for it. No one stumbles into super admin. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('auth.login.superAdminCta')}
        onPress={() => router.push('/(auth)/super-admin-login')}
        className="mt-4 flex-row items-center justify-center gap-1.5 rounded-md border border-auth-line px-3 py-2 active:opacity-70"
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
