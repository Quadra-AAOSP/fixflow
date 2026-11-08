import { StateView } from '@/components/ui/StateView';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  acceptTechnicianTerms,
  getTechnicianTerms,
} from '@/services/technicians';
import type { TechnicianTermsStatus } from '@/types/technician';
import { formatDate } from '@/utils/format';

/**
 * Technician terms screen. Reads `GET /api/technician-terms/me` and accepts
 * the exact current version (`POST /api/technician-terms/accept`).
 */
export default function TechnicianTermsScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();

  const [terms, setTerms] = useState<TechnicianTermsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const loadTerms = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setTerms(await getTechnicianTerms());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('technician.terms.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const handleAcceptTerms = useCallback(async () => {
    if (!terms?.currentVersion) return;
    setAccepting(true);
    setError(null);
    try {
      setTerms(await acceptTechnicianTerms(terms.currentVersion));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('technician.terms.errors.couldNotAccept'),
      );
    } finally {
      setAccepting(false);
    }
  }, [terms?.currentVersion, t]);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  const hasPublishedTerms = Boolean(terms?.currentVersion && terms?.documentUrl);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: t('technician.terms.title'),
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="flex-row items-center">
              <ArrowLeft color={dashboardColors.teal} size={18} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <Text
          className="mb-4 text-2xl font-bold text-ink"
          style={{ letterSpacing: -0.5 }}
        >
          {t('technician.terms.title')}
        </Text>

        {error ? (
          <Card className="mb-4">
            <Text className="p-4 text-center text-tone-danger">{error}</Text>
          </Card>
        ) : null}

        {loading ? (
          <Card className="mb-4">
            <StateView variant="loading" title={t('technician.terms.loading')} />
          </Card>
        ) : terms && hasPublishedTerms ? (
          <Card padded={false} className="mb-4">
            <View className="px-4 py-3">
              <Text className="mb-2 text-[12px] text-ink">
                {t('technician.terms.version', { version: terms.currentVersion })}
              </Text>
              <Text
                className="mb-2 text-[12px] font-semibold"
                style={{
                  color: terms.acceptedCurrentVersion
                    ? dashboardColors.statMintDeep
                    : dashboardColors.statCitronDeep,
                }}
              >
                {t(
                  terms.acceptedCurrentVersion
                    ? 'technician.terms.accepted'
                    : 'technician.terms.notAccepted',
                )}
              </Text>
              {terms.documentUrl ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    void Linking.openURL(terms.documentUrl as string);
                  }}
                  className="mb-4 active:opacity-70"
                >
                  <Text className="text-[12px] font-semibold" style={{ color: dashboardColors.teal }}>
                    {t('technician.terms.openDocument')}
                  </Text>
                </Pressable>
              ) : null}
              {terms.enforcementRequired && !terms.acceptedCurrentVersion ? (
                <View className="flex-row justify-end">
                  <Button
                    variant="primary"
                    onPress={handleAcceptTerms}
                    loading={accepting}
                  >
                    {t('technician.terms.accept')}
                  </Button>
                </View>
              ) : null}
            </View>

            {terms.acceptances.length > 0 ? (
              <View className="border-t border-dashboard-card-line px-4 py-3">
                <Text className="mb-2 text-[10px] font-semibold uppercase tracking-[1px] text-dashboard-caption">
                  {t('technician.terms.history')}
                </Text>
                {terms.acceptances.map((acceptance) => (
                  <Text
                    key={`${acceptance.version}-${acceptance.acceptedAt}`}
                    className="text-[11px] leading-[1.7] text-dashboard-subtitle"
                  >
                    {t('technician.terms.acceptedOn', {
                      version: acceptance.version,
                      date: formatDate(acceptance.acceptedAt, true),
                    })}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        ) : (
          <Card className="mb-4">
            <Text className="p-4 text-center text-dashboard-subtitle">
              {t('technician.terms.noTerms')}
            </Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
