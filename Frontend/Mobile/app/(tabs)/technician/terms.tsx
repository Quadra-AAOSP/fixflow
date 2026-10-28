import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  acceptTechnicianTerms,
  getTechnicianTerms,
} from '@/services/technicians';
import type { TechnicianTerm } from '@/types/technician';

/**
 * Technician terms screen.
 */
// Translations for Technician Terms
// Add these to your i18n common.json file
// {
//   "technician": {
//     "terms": {
//       "title": "Terms",
//       "loading": "Loading terms...",
//       "version": "Version {{version}}",
//       "status": "Status: {{status}}",
//       "accept": "Accept Terms",
//       "noTerms": "No terms found.",
//       "errors": {
//         "couldNotLoad": "Failed to load terms.",
//         "couldNotAccept": "Failed to accept terms."
//       }
//     }
//   }
// }

export default function TechnicianTermsScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();

  const [terms, setTerms] = useState<TechnicianTerm | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const loadTerms = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const terms = await getTechnicianTerms();
      setTerms(terms);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('technician.terms.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const handleAcceptTerms = useCallback(async () => {
    if (!terms) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptTechnicianTerms();
      await loadTerms();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('technician.terms.errors.couldNotAccept'),
      );
    } finally {
      setAccepting(false);
    }
  }, [terms, loadTerms, t]);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  return (
    <Screen>
      <Stack.Screen
        options={{ title: t('technician.terms.title'), headerLeft: () => (
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center"
          >
            <ArrowLeft color={dashboardColors.teal} size={18} />
          </Pressable>
        )}}
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
            <Text className="p-4 text-center text-tone-danger">
              {error}
            </Text>
          </Card>
        ) : null}

        {loading ? (
          <Card className="mb-4">
            <Text className="p-4 text-center text-dashboard-subtitle">
              {t('technician.terms.loading')}
            </Text>
          </Card>
        ) : terms ? (
          <Card padded={false} className="mb-4">
            <View className="px-4 py-3">
              <Text className="mb-2 text-[12px] text-ink">
                {t('technician.terms.version', { version: terms.version })}
              </Text>
              <Text className="mb-2 text-[12px] text-ink">
                {t('technician.terms.status', { status: terms.status })}
              </Text>
              <Text className="mb-4 text-[12px] text-ink">
                {terms.content}
              </Text>
              {terms.status === 'pending' ? (
                <View className="flex-row justify-end gap-2">
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