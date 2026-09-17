import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/auth';

export default function RegisterScreen() {
  const { register, isAuthenticated, isLoading } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [siteId, setSiteId] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  async function onSubmit() {
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const parsedSiteId = Number(siteId.trim());

    if (!trimmedFirst || !trimmedLast || !trimmedEmail || !password) {
      setError('First name, last name, email, and password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!Number.isInteger(parsedSiteId) || parsedSiteId <= 0) {
      setError('Enter a valid site ID from your site administrator.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email: trimmedEmail,
        password,
        firstName: trimmedFirst,
        lastName: trimmedLast,
        phone: phone.trim() || undefined,
        role: 'reporter',
        siteId: parsedSiteId,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
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
          <Text className="mb-1 text-3xl font-bold text-ink dark:text-ink-dark">
            Create account
          </Text>
          <Text className="mb-6 text-sm text-muted dark:text-muted-dark">
            Register as a reporter for your school, hostel, or hotel site.
          </Text>

          <View className="flex-row gap-3">
            <TextField
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              textContentType="givenName"
              className="flex-1"
              placeholder="Alex"
            />
            <TextField
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              textContentType="familyName"
              className="flex-1"
              placeholder="Ng"
            />
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
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <TextField
            label="Site ID"
            value={siteId}
            onChangeText={setSiteId}
            keyboardType="number-pad"
            placeholder="e.g. 1"
          />
          <Text className="-mt-2 mb-4 text-xs text-muted dark:text-muted-dark">
            Ask your site admin for the numeric site ID. Sites are not listed
            publicly before login.
          </Text>
          <TextField
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder="+65 …"
          />

          {error ? (
            <Text className="mb-3 text-sm text-urgency-critical">{error}</Text>
          ) : null}

          <Button
            label="Create account"
            loading={submitting}
            onPress={onSubmit}
          />

          <View className="mt-6 flex-row justify-center">
            <Text className="text-sm text-muted dark:text-muted-dark">
              Already registered?{' '}
            </Text>
            <Link href="/(auth)/login">
              <Text className="text-sm font-semibold text-primary dark:text-primary-dark">
                Sign in
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
