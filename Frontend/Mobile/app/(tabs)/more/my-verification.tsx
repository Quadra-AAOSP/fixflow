import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  ownVerification,
  submitVerification,
  type VerificationInput,
} from '@/services/onboarding';
import { getTechnicianTerms } from '@/services/technicians';
import type { TechnicianTermsStatus } from '@/types/technician';

const empty: VerificationInput = {
  email: '',
  phone: '',
  trades: '',
  experience: '',
  qualifications: '',
};

const FIELDS: (keyof VerificationInput)[] = [
  'email',
  'phone',
  'trades',
  'experience',
  'qualifications',
];

const MULTILINE: (keyof VerificationInput)[] = [
  'trades',
  'experience',
  'qualifications',
];

/** Hint copy per backend status (`unverified` … `suspended`). */
const STATUS_HINTS: Record<string, string> = {
  unverified: 'review.hints.unverified',
  pending: 'review.hints.pending',
  verified: 'review.hints.verified',
  rejected: 'review.hints.rejected',
  suspended: 'review.hints.suspended',
};

export default function MyVerification() {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<VerificationInput>(empty);
  // `null` = not loaded yet; the backend returns `unverified` for a new record.
  const [status, setStatus] = useState<string | null>(null);
  const [terms, setTerms] = useState<TechnicianTermsStatus | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      // Terms are needed to explain why an approval may be blocked, so they
      // load alongside the submission without failing the whole screen.
      const [value, termsStatus] = await Promise.all([
        ownVerification(),
        getTechnicianTerms().catch(() => null),
      ]);
      setTerms(termsStatus);
      setStatus(value.status ?? 'unverified');
      setReason(value.reason ?? '');
      setData({
        email: value.email ?? '',
        phone: value.phone ?? '',
        trades: value.trades ?? '',
        experience: value.experience ?? '',
        qualifications: value.qualifications ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('review.error'));
    } finally {
      setBusy(false);
    }
  }, [t]);

  // Re-read on focus so the terms banner clears right after accepting them.
  useFocusEffect(
    useCallback(() => {
      if (user?.role === 'technician') void load();
    }, [user?.role, load]),
  );

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await submitVerification(data);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('review.error'));
    } finally {
      setBusy(false);
    }
  }

  if (user?.role !== 'technician') {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('review.myVerification') }} />
        <View className="p-5">
          <Text className="text-sm text-ink">{t('review.denied')}</Text>
        </View>
      </Screen>
    );
  }

  const loaded = status !== null;
  const editable = loaded && ['unverified', 'rejected'].includes(status);
  const canSubmit = editable && !busy && FIELDS.every(key => data[key].trim());

  return (
    <Screen>
      <Stack.Screen options={{ title: t('review.myVerification') }} />
      <ScrollView
        contentContainerClassName="p-5 pb-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4 flex-row items-center gap-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <ShieldCheck color={dashboardColors.statMintDeep} size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('review.myVerification')}
            </Text>
            <Text className="mt-0.5 text-[11px] leading-[1.5] text-dashboard-subtitle">
              {t('review.verificationIntro')}
            </Text>
          </View>
        </View>

        <Card className="mb-4">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="text-[12.5px] font-semibold text-ink">
              {t('review.status')}
            </Text>
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: dashboardColors.statMintSoft }}
            >
              <Text
                className="text-[10px] font-semibold uppercase"
                style={{ color: dashboardColors.statMintDeep, letterSpacing: 0.6 }}
              >
                {loaded
                  ? t(`review.statuses.${status}`)
                  : busy
                    ? t('review.loading')
                    : t('review.statusUnknown')}
              </Text>
            </View>
          </View>
          {loaded ? (
            <Text className="mt-2 text-[11.5px] leading-[1.7] text-dashboard-subtitle">
              {t(STATUS_HINTS[status] ?? 'review.hints.unverified')}
            </Text>
          ) : null}
          {reason ? (
            <View className="mt-2 rounded-lg border border-dashboard-card-line bg-dashboard-banner-bg p-3">
              <Text className="text-[10px] font-semibold uppercase text-dashboard-subtitle" style={{ letterSpacing: 0.6 }}>
                {t('review.reason')}
              </Text>
              <Text className="mt-1 text-[11.5px] leading-[1.7] text-ink">{reason}</Text>
            </View>
          ) : null}
        </Card>

        {/* Terms gate: an approval is impossible until the current version is
            accepted, so surface that here instead of only at approval time. */}
        {terms?.currentVersion ? (
          terms.acceptedCurrentVersion ? (
            <View className="mb-4 flex-row items-center gap-2.5 rounded-xl border border-dashboard-card-line px-3.5 py-3">
              <ShieldCheck color={dashboardColors.statMintDeep} size={15} />
              <Text className="flex-1 text-[11.5px] leading-[1.6] text-dashboard-subtitle">
                {t('review.termsAccepted', { version: terms.currentVersion })}
              </Text>
            </View>
          ) : (
            <Card className="mb-4">
              <View className="flex-row items-start gap-2.5">
                <AlertTriangle color={dashboardColors.statCitronDeep} size={16} />
                <View className="flex-1">
                  <Text className="text-[12.5px] font-semibold text-ink">
                    {t('review.termsTitle')}
                  </Text>
                  <Text className="mt-1 text-[11px] leading-[1.65] text-dashboard-subtitle">
                    {t('review.termsBody')}
                  </Text>
                </View>
              </View>
              <Button
                variant="secondary"
                label={t('review.acceptTerms')}
                className="mt-3"
                onPress={() => router.push('/technician/terms')}
              />
            </Card>
          )
        ) : null}

        {error ? (
          <View className="mb-4 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3">
            <Text accessibilityRole="alert" className="mb-2 text-[11.5px] leading-[1.6] text-tone-danger">
              {error}
            </Text>
            <Button
              variant="secondary"
              className="min-h-0 py-2"
              label={t('review.retry')}
              onPress={() => void load()}
            />
          </View>
        ) : null}

        {!loaded && !error ? (
          <StateView variant="loading" title={t('review.loading')} />
        ) : null}

        {editable ? (
          <Card className="mb-4">
            <Text className="mb-1 text-[12.5px] font-semibold text-ink">
              {t('review.formTitle')}
            </Text>
            <Text className="mb-3 text-[11px] leading-[1.6] text-dashboard-caption">
              {t('review.formHint')}
            </Text>
            {FIELDS.map(key => (
              <TextField
                key={key}
                label={t(`review.${key}`)}
                value={data[key]}
                onChangeText={value => setData(prev => ({ ...prev, [key]: value }))}
                multiline={MULTILINE.includes(key)}
                autoCapitalize="none"
                className="mb-3"
              />
            ))}
            <Button
              label={busy ? t('review.submitting') : t('review.submit')}
              loading={busy}
              disabled={!canSubmit}
              onPress={() => void submit()}
            />
          </Card>
        ) : null}

        <Button
          variant="secondary"
          label={t('review.refresh')}
          disabled={busy}
          onPress={() => void load()}
        />

        <Text className="mt-4 text-[10.5px] leading-[1.7] text-dashboard-caption">
          {t('review.reviewedBy')}
        </Text>
      </ScrollView>
    </Screen>
  );
}
