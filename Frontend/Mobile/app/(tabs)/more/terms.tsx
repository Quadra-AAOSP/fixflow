import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Check, FileText, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { getTechnicianTerms, acceptTechnicianTerms } from '@/services/technician';
import type { TechnicianTerms } from '@/types';

/**
 * Technician terms and conditions. Mirrors `TermsView.vue`.
 *
 * Technicians must accept the current terms to work. The backend
 * enforces this by rejecting assignments when the terms are not
 * accepted.
 */
export default function TermsScreen() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const router = useRouter();
  const palette = themeColors();

  const [terms, setTerms] = useState<TechnicianTerms | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadTerms = async () => {
      setLoading(true);
      setError(null);
      try {
        const terms = await getTechnicianTerms();
        setTerms(terms);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : t('terms.loadFail'),
        );
      } finally {
        setLoading(false);
      }
    };

    void loadTerms();
  }, [t]);

  const handleAccept = async () => {
    if (!terms) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptTechnicianTerms(terms.version);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('terms.acceptFail'),
      );
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <StateView variant="loading" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <StateView
          variant="error"
          title={t('terms.errorTitle')}
          description={error}
          actionLabel={t('terms.retry')}
          onAction={() => {
            setError(null);
            setLoading(true);
          }}
        />
      </Screen>
    );
  }

  if (success) {
    return (
      <Screen>
        <StateView
          variant="success"
          title={t('terms.acceptedTitle')}
          description={t('terms.acceptedDesc')}
          actionLabel={t('terms.continue')}
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: palette.ink }}>
              {t('terms.title')}
            </Text>
            <ShieldCheck color={palette.tabIconSelected} size={24} />
          </View>
          <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 8 }}>
            {t('terms.version', { version: terms?.version || '' })}
          </Text>
          <Text style={{ fontSize: 14, color: palette.ink, marginTop: 16, lineHeight: 22 }}>
            {terms?.content || t('terms.noContent')}
          </Text>
        </Card>

        {terms?.acceptedAt ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Check color={palette.statMintDeep} size={20} />
              <Text style={{ fontSize: 14, color: palette.ink }}>
                {t('terms.acceptedOn', { date: new Date(terms.acceptedAt).toLocaleDateString() })}
              </Text>
            </View>
          </Card>
        ) : (
          <Button
            variant="primary"
            onPress={handleAccept}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator color={palette.card} />
            ) : (
              t('terms.accept')
            )}
          </Button>
        )}
      </ScrollView>
    </Screen>
  );
}