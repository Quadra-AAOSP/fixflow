import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Wrench } from 'lucide-react-native';

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
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  async function onSubmit() {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? 'Invalid email or password.' : err.message);
      } else {
        setError('Unable to reach the server. Check your connection and API URL.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <AuthHeading
        kicker="YOUR SPACE, TAKEN CARE OF"
        icon={Wrench}
        title="Welcome back"
        titleAccent="."
        description="A better place starts with you. Sign in to keep things flowing."
      />

      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholder="you@example.com"
      />
      <AuthField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        placeholder="••••••••"
      />

      {error ? (
        <Text className="mb-3 text-[13px] text-urgency-critical">{error}</Text>
      ) : null}

      <AuthButton label="Sign in →" loading={submitting} onPress={onSubmit} />

      <Text className="mt-6 text-center text-[13px] text-auth-body">
        New around here?{' '}
        <Text
          className="text-coral-link"
          style={{ fontFamily: fontFamilies.bodySemiBold }}
          onPress={() => router.push('/(auth)/register')}
        >
          Create an account
        </Text>
      </Text>

      <View className="mt-8 flex-row items-center gap-2.5 border-t border-auth-line pt-6">
        <Text className="text-[22px] text-auth-sage-deep">✳</Text>
        <Text className="flex-1 text-[10px] text-auth-note">
          Your report. The right people. A little peace of mind.
        </Text>
      </View>
    </AuthShell>
  );
}
