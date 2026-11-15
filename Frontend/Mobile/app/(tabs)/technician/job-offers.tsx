import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/useToastContext';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, toErrorMessage } from '@/lib/apiClient';
import {
  acceptJobOffer,
  counterJobOffer,
  listMyJobOffers,
  rejectJobOffer,
  type JobOffer,
} from '@/services/jobOffers';
import { humanize } from '@/utils/format';
import { parseOfferAmountMinor } from '@/utils/jobOfferAmount';

function money(amountMinor: number, currency: string) {
  return (amountMinor / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  });
}

/**
 * Technician inbox for contracted paid job offers (not marketplace listings).
 */
export default function JobOffersScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [offers, setOffers] = useState<JobOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [counterDrafts, setCounterDrafts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (user?.role !== 'technician') return;
    setError(null);
    try {
      setOffers(await listMyJobOffers());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('jobOffers.error'),
      );
    }
  }, [t, user?.role]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function run(
    offer: JobOffer,
    operation: () => Promise<unknown>,
    successKey: string,
  ) {
    setBusyId(offer.id);
    setError(null);
    try {
      await operation();
      showToast(t(successKey), 'success');
      await load();
    } catch (err) {
      setError(toErrorMessage(err, { fallback: t('jobOffers.error') }));
    } finally {
      setBusyId(null);
    }
  }

  if (user?.role !== 'technician') {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('jobOffers.title') }} />
        <StateView variant="empty" title={t('review.denied')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('jobOffers.title') }} />
      <ScrollView contentContainerClassName="p-5 pb-10" keyboardShouldPersistTaps="handled">
        <Text className="mb-2 text-xl font-bold text-ink">{t('jobOffers.title')}</Text>
        <Text className="mb-3 text-ink">{t('jobOffers.intro')}</Text>
        <Button
          label={t('review.refresh')}
          variant="secondary"
          onPress={() => void load()}
          disabled={busyId !== null}
          className="mb-3"
        />
        {error ? (
          <Text accessibilityRole="alert" className="mb-3 text-red-700">
            {error}
          </Text>
        ) : null}
        {offers === null ? (
          <StateView variant="loading" title={t('jobOffers.loading')} />
        ) : offers.length === 0 ? (
          <Text className="text-ink">{t('jobOffers.empty')}</Text>
        ) : (
          offers.map((offer) => {
            const open = offer.status === 'pending' || offer.status === 'countered';
            const counterAmount = parseOfferAmountMinor(counterDrafts[offer.id] ?? '');
            return (
              <View
                key={offer.id}
                className="mb-3 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4"
              >
                <Pressable
                  accessibilityRole="link"
                  onPress={() =>
                    router.push({
                      pathname: '/reports/[id]',
                      params: { id: String(offer.reportId) },
                    })
                  }
                >
                  <Text className="mb-1 text-lg font-bold text-ink">
                    {t('jobOffers.report', { id: offer.reportId })}
                  </Text>
                </Pressable>
                <Text className="text-ink">
                  {t('jobOffers.status', {
                    status: t(`reports.detail.offerStatus.${offer.status}`, {
                      defaultValue: humanize(offer.status),
                    }),
                  })}
                </Text>
                <Text className="mt-1 text-ink">
                  {t('jobOffers.amount', {
                    amount: money(offer.amountMinor, offer.currency),
                  })}
                </Text>
                {offer.counterAmountMinor != null ? (
                  <Text className="text-ink">
                    {t('jobOffers.counterAmount', {
                      amount: money(offer.counterAmountMinor, offer.currency),
                    })}
                  </Text>
                ) : null}
                {offer.note ? (
                  <Text className="mt-2 text-ink">{offer.note}</Text>
                ) : null}
                {open ? (
                  <View className="mt-3 gap-2">
                    <Button
                      label={t('jobOffers.accept')}
                      onPress={() =>
                        void run(offer, () => acceptJobOffer(offer.reportId, offer.id), 'jobOffers.accepted')
                      }
                      loading={busyId === offer.id}
                      disabled={busyId !== null}
                    />
                    <Button
                      label={t('jobOffers.reject')}
                      variant="secondary"
                      onPress={() =>
                        void run(offer, () => rejectJobOffer(offer.reportId, offer.id), 'jobOffers.rejected')
                      }
                      disabled={busyId !== null}
                    />
                    <TextField
                      label={t('jobOffers.counterLabel')}
                      value={counterDrafts[offer.id] ?? ''}
                      onChangeText={(value) =>
                        setCounterDrafts((previous) => ({
                          ...previous,
                          [offer.id]: value,
                        }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                    <Button
                      label={t('jobOffers.counter')}
                      variant="secondary"
                      disabled={busyId !== null || counterAmount == null}
                      onPress={() => {
                        if (counterAmount == null) return;
                        void run(
                          offer,
                          () =>
                            counterJobOffer(
                              offer.reportId,
                              offer.id,
                              counterAmount,
                            ),
                          'jobOffers.countered',
                        );
                      }}
                    />
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
