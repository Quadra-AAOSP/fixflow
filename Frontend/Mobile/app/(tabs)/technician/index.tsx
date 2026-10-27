import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react-native';

// Translations for Technician Dashboard
// Add these to your i18n common.json file
// {
//   "technician": {
//     "dashboard": {
//       "title": "Technician Dashboard",
//       "loading": "Loading data...",
//       "contracts": "Contracts",
//       "noContracts": "No contracts found.",
//       "invitations": "Invitations",
//       "noInvitations": "No invitations found.",
//       "terms": "Terms",
//       "noTerms": "No terms found.",
//       "errors": {
//         "couldNotLoad": "Failed to load data."
//       }
//     }
//   },
//   "tabs": {
//     "workspace": "Workspace",
//     "assignments": "Assignments",
//     "shop": "Shop"
//   }
// }

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  getTechnicianContracts,
  getTechnicianInvitations,
  getTechnicianTerms,
  listTechnicianPool,
} from '@/services/technicians';
import type { TechnicianContract, TechnicianInvitation, TechnicianTerm } from '@/types';

/**
 * Technician dashboard. Mirrors `TechnicianDashboardView.vue`:
 * - Eligible assignment discovery
 * - Invitations
 * - Contract-request status
 * - Technician terms
 * - Authorized contract information
 * - Active work and report details
 */

export default function TechnicianDashboardScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();

  const [contracts, setContracts] = useState<TechnicianContract[]>([]);
  const [invitations, setInvitations] = useState<TechnicianInvitation[]>([]);
  const [terms, setTerms] = useState<TechnicianTerm | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Load contracts
      const contracts = await getTechnicianContracts();
      setContracts(contracts);

      // Load invitations
      const invitations = await getTechnicianInvitations();
      setInvitations(invitations);

      // Load terms
      const terms = await getTechnicianTerms();
      setTerms(terms);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('technician.dashboard.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('technician.dashboard.title') }} />
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <Text
          className="mb-4 text-2xl font-bold text-ink"
          style={{ letterSpacing: -0.5 }}
        >
          {t('technician.dashboard.title')}
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
              {t('technician.dashboard.loading')}
            </Text>
          </Card>
        ) : (
          <>
            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('technician.dashboard.contracts')}
            </Text>
            {contracts.length > 0 ? (
              <Card padded={false} className="mb-4">
                {contracts.map((contract) => (
                  <View
                    key={contract.id}
                    className="border-b border-dashboard-card-line px-4 py-3"
                  >
                    <Text className="text-[12px] text-ink">
                      {contract.siteName} - {contract.status}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Card className="mb-4">
                <Text className="p-4 text-center text-dashboard-subtitle">
                  {t('technician.dashboard.noContracts')}
                </Text>
              </Card>
            )}

            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('technician.dashboard.invitations')}
            </Text>
            {invitations.length > 0 ? (
              <Card padded={false} className="mb-4">
                {invitations.map((invitation) => (
                  <View
                    key={invitation.id}
                    className="border-b border-dashboard-card-line px-4 py-3"
                  >
                    <Text className="text-[12px] text-ink">
                      {invitation.reportTitle} - {invitation.status}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Card className="mb-4">
                <Text className="p-4 text-center text-dashboard-subtitle">
                  {t('technician.dashboard.noInvitations')}
                </Text>
              </Card>
            )}

            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('technician.dashboard.terms')}
            </Text>
            {terms ? (
              <Card padded={false} className="mb-4">
                <Pressable
                  onPress={() => router.push('/technician/terms')}
                  className="border-b border-dashboard-card-line px-4 py-3"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[12px] text-ink">
                      {terms.version} - {terms.status}
                    </Text>
                    <ArrowRight color={dashboardColors.subtitle} size={16} />
                  </View>
                </Pressable>
              </Card>
            ) : (
              <Card className="mb-4">
                <Text className="p-4 text-center text-dashboard-subtitle">
                  {t('technician.dashboard.noTerms')}
                </Text>
              </Card>
            )}

            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('technician.dashboard.contractRequests')}
            </Text>
            <Pressable
              onPress={() => router.push('/technician/contract-requests')}
              className="mb-4 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg px-4 py-3"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-[12px] text-ink">
                  {t('technician.dashboard.manageContractRequests')}
                </Text>
                <ArrowRight color={dashboardColors.subtitle} size={16} />
              </View>
            </Pressable>

            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('technician.dashboard.invitations')}
            </Text>
            <Pressable
              onPress={() => router.push('/technician/invitations')}
              className="mb-4 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg px-4 py-3"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-[12px] text-ink">
                  {t('technician.dashboard.viewInvitations')}
                </Text>
                <ArrowRight color={dashboardColors.subtitle} size={16} />
              </View>
            </Pressable>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}