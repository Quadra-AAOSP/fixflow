import { Redirect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AuthButton } from '@/components/auth/AuthButton';
import { AuthField } from '@/components/auth/AuthField';
import { AuthHeading } from '@/components/auth/AuthHeading';
import { AuthShell } from '@/components/auth/AuthShell';
import { fontFamilies } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/auth';

/**
 * Sign-in. Mirrors `Frontend/Web/src/views/auth/LoginView.vue` — same kicker,
 * symbol, headline, supporting line, field labels/placeholders, button copy,
 * secondary link and reassurance strip.
 */
export default function LoginScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Lets the keyboard's "next" key move from email straight into the password
  // field instead of dismissing the keyboard.
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
        setError(err.status === 401 ? t('auth.login.errors.invalidCredentials') : err.message);
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
        icon={Wrench}
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
        // Submits from the keyboard's "go" key, so signing in never needs a
        // tap on the button after typing.
        onSubmitEditing={onSubmit}
      />

      {error ? (
        <Text className="mb-3 text-[13px] text-auth-danger">{error}</Text>
      ) : null}

      <AuthButton label={t('auth.login.submit')} loading={submitting} onPress={onSubmit} />

      {/* A full-width row rather than a bare text link: the inline text was an
          ~18px tap target, well under the 44pt minimum, and it sits right below
          the CTA where a thumb expects it. */}
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

      <View className="mt-4 flex-row items-center gap-2.5 border-t border-auth-line pt-5">
        <Text className="text-[22px] text-auth-sage-deep">✳</Text>
        <Text className="flex-1 text-[10px] text-auth-note">
          {t('auth.login.tagline')}
        </Text>
      </View>
    </AuthShell>
  );
}
