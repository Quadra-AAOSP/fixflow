import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Wrench } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/auth';

export default function LoginScreen() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const palette = themeColors();

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
        setError(
          err.status === 401
            ? 'Invalid email or password.'
            : err.message,
        );
      } else {
        setError('Unable to reach the server. Check your connection and API URL.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-5 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8 items-center">
            <View className="mb-4 rounded-2xl bg-primary/15 p-4">
              <Wrench color={palette.primary} size={36} />
            </View>
            <Text className="text-3xl font-bold text-ink">FixFlow</Text>
            <Text className="mt-2 text-center text-sm text-muted">
              Sign in to report and track site maintenance
            </Text>
          </View>

          <TextField
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
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            placeholder="••••••••"
          />

          {error ? (
            <Text className="mb-3 text-sm text-tone-danger">{error}</Text>
          ) : null}

          <Button label="Sign in" loading={submitting} onPress={onSubmit} />

          <View className="mt-6 flex-row justify-center">
            <Text className="text-sm text-muted">No account?{' '}</Text>
            <Link href="/(auth)/register">
              <Text className="text-sm font-semibold text-primary">
                Register
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}