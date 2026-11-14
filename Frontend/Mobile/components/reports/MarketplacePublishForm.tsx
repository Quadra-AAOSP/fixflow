import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/apiClient';
import { publishJob } from '@/services/marketplace';
import type { Report } from '@/types';

type MarketplacePublishFormProps = {
  report: Report;
  disabled?: boolean;
  onPublished?: () => void;
};

/**
 * Inline marketplace publish form for report details.
 * Mirrors web `MarketplacePublishPanel`.
 */
export function MarketplacePublishForm({
  report,
  disabled = false,
  onPublished,
}: MarketplacePublishFormProps) {
  const { t } = useTranslation('common');
  const [summary, setSummary] = useState('');
  const [broadLocation, setBroadLocation] = useState('');
  const [timing, setTiming] = useState('');
  const [amount, setAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSummary('');
    setBroadLocation('');
    setTiming('');
    setAmount('');
    setConfirmed(false);
    setPublished(false);
    setError(null);
  }, [report.id]);

  async function onPublish() {
    const amountMinor = Math.round(Number(amount) * 100);
    if (
      disabled ||
      busy ||
      published ||
      !confirmed ||
      !summary.trim() ||
      !broadLocation.trim() ||
      !timing.trim() ||
      !Number.isFinite(amountMinor) ||
      amountMinor <= 0
    ) {
      if (!confirmed) {
        setError(t('marketplace.publishMissingPrivacy'));
      } else if (!summary.trim() || !broadLocation.trim() || !timing.trim() || amountMinor <= 0) {
        setError(
          t('marketplace.publishMissingFields', {
            fields: [
              !summary.trim() ? t('marketplace.summary') : null,
              !broadLocation.trim() ? t('marketplace.broadLocation') : null,
              !timing.trim() ? t('marketplace.timing') : null,
              amountMinor <= 0 ? t('marketplace.payAmount') : null,
            ]
              .filter(Boolean)
              .join(', '),
          }),
        );
      }
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await publishJob(report.id, {
        summary: summary.trim(),
        broadLocation: broadLocation.trim(),
        timing: timing.trim(),
        amountMinor,
        currency: 'USD',
      });
      setPublished(true);
      onPublished?.();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('marketplace.error'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (published) {
    return (
      <View className="mt-3 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3">
        <Text className="text-[12px] leading-[1.7] text-dashboard-teal">
          {t('marketplace.published')}
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-3">
      <Text
        className="mb-1 text-[15px] font-semibold text-ink"
        style={{ letterSpacing: -0.3 }}
      >
        {t('marketplace.publishFromReport')}
      </Text>
      <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
        {t('marketplace.privacy')}
      </Text>
      <TextField
        label={t('marketplace.summary')}
        value={summary}
        onChangeText={setSummary}
        multiline
        numberOfLines={3}
        maxLength={300}
      />
      <TextField
        label={t('marketplace.broadLocation')}
        value={broadLocation}
        onChangeText={setBroadLocation}
        maxLength={160}
      />
      <TextField
        label={t('marketplace.timing')}
        value={timing}
        onChangeText={setTiming}
        maxLength={160}
      />
      <TextField
        label={t('marketplace.payAmount')}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      <View className="mb-3 mt-1 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[12px] leading-[1.6] text-ink">
          {t('marketplace.confirmPrivacy')}
        </Text>
        <Switch
          accessibilityLabel={t('marketplace.confirmPrivacy')}
          value={confirmed}
          disabled={busy || disabled}
          onValueChange={setConfirmed}
        />
      </View>
      {error ? (
        <Text className="mb-2 text-[12px] leading-[1.6] text-tone-danger">
          {error}
        </Text>
      ) : null}
      <Button
        label={busy ? t('marketplace.publishing') : t('marketplace.publish')}
        onPress={onPublish}
        loading={busy}
        disabled={disabled || busy || !confirmed}
      />
    </View>
  );
}
