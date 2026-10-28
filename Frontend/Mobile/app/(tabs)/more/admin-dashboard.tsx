import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Building2, Plus } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { useCurrentSite } from '@/stores/site';
import {
  listSubsites,
} from '@/services/sites';

/**
 * Admin dashboard for site setup and management.
 */
export default function AdminDashboardScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { site, loading: siteLoading, error: siteError, refresh: refreshSite } = useCurrentSite();

  const [subsites, setSubsites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSubsites = useCallback(async () => {
    if (!site) return;
    setLoading(true);
    setError(null);
    try {
      const subsites = await listSubsites(site.id);
      setSubsites(subsites);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('adminDashboard.errors.couldNotLoadSubsites'),
      );
    } finally {
      setLoading(false);
    }
  }, [site, t]);

  useEffect(() => {
    void loadSubsites();
  }, [loadSubsites]);

  const hasActiveSubsites = subsites.some(subsite => !subsite.archived);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('adminDashboard.title') }} />
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <Text
          className="mb-4 text-2xl font-bold text-ink"
          style={{ letterSpacing: -0.5 }}
        >
          {t('adminDashboard.title')}
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
              {t('adminDashboard.loading')}
            </Text>
          </Card>
        ) : (
          <>
            {!hasActiveSubsites && (
              <Card padded={false} className="mb-4">
                <View className="border-b border-dashboard-card-line px-4 py-3">
                  <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
                    {t('adminDashboard.noActiveSubsites')}
                  </Text>
                </View>
                <View className="px-4 py-3">
                  <Text className="mb-2 text-[12px] text-dashboard-subtitle">
                    {t('adminDashboard.setupRequired')}
                  </Text>
                  <Button
                    variant="primary"
                    onPress={() => router.push('/more/site-setup')}
                    className="w-full"
                  >
                    {t('adminDashboard.setupSite')}
                  </Button>
                </View>
              </Card>
            )}

            <Card padded={false} className="mb-4">
              <View className="border-b border-dashboard-card-line px-4 py-3">
                <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
                  {t('adminDashboard.subsites')}
                </Text>
              </View>
              {subsites.length > 0 ? (
                subsites.map((subsite) => (
                  <View
                    key={subsite.id}
                    className="border-b border-dashboard-card-line px-4 py-3"
                  >
                    <Text className="text-[12px] text-ink">
                      {subsite.label} - {subsite.name}
                    </Text>
                  </View>
                ))
              ) : (
                <View className="px-4 py-3">
                  <Text className="text-[12px] text-dashboard-subtitle">
                    {t('adminDashboard.noSubsites')}
                  </Text>
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}