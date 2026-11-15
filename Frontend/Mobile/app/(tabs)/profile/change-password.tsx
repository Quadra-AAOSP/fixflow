import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/useToastContext';
import { ApiError, changePassword } from '@/services/auth';

const MIN_LENGTH = 15;

/**
 * Change the signed-in account password. Requires the current password;
 * new password must meet AccountPolicy (15–100 characters).
 */
export default function ChangePasswordScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canSubmit =
    currentPassword.length > 0 &&
    nextPassword.length >= MIN_LENGTH &&
    nextPassword === confirmPassword &&
    !busy;

  async function onSubmit() {
    if (!canSubmit) return;
    if (nextPassword !== confirmPassword) {
      setError(t('profile.password.mismatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await changePassword(currentPassword, nextPassword);
      showToast(t('profile.password.success'), 'success');
      router.back();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('profile.password.failed'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('profile.password.title') }} />
      <ScrollView
        contentContainerClassName="px-5 pb-10 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        <Text
          className="mb-2 text-2xl font-bold text-ink"
          style={{ letterSpacing: -0.6 }}
        >
          {t('profile.password.title')}
        </Text>
        <Text className="mb-6 text-[12px] leading-[1.7] text-dashboard-subtitle">
          {t('profile.password.hint', { min: MIN_LENGTH })}
        </Text>

        <TextField
          label={t('profile.password.current')}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          className="mb-3"
        />
        <TextField
          label={t('profile.password.next')}
          value={nextPassword}
          onChangeText={setNextPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          className="mb-3"
        />
        <TextField
          label={t('profile.password.confirm')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          className="mb-4"
        />

        {error ? (
          <Text accessibilityRole="alert" className="mb-3 text-[12px] text-tone-danger">
            {error}
          </Text>
        ) : null}

        <Button
          label={t('profile.password.submit')}
          loading={busy}
          disabled={!canSubmit}
          onPress={() => void onSubmit()}
        />
      </ScrollView>
    </Screen>
  );
}
