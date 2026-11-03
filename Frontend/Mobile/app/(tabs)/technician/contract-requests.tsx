import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Check, X } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { ActivityIndicator } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors, themeColors } from '@/constants/theme';
import { canDecideContracts } from '@/constants/access';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  createTechnicianContractRequest,
  decideTechnicianContractRequest,
  getTechnicianContractRequests,
} from '@/services/technicians';
import { listSites } from '@/services/sites';
import type { Site } from '@/types';
import type { TechnicianContractRequest, TechnicianContractRequestStatus } from '@/types/technician';

/**
 * Technician contract requests screen.
 */
export default function TechnicianContractRequestsScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const canDecide = canDecideContracts(user);

  const [requests, setRequests] = useState<TechnicianContractRequest[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newRequestSiteId, setNewRequestSiteId] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [requests, sites] = await Promise.all([
        getTechnicianContractRequests(),
        listSites(),
      ]);
      setRequests(requests);
      setSites(sites);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('technician.contractRequests.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const submitContractRequest = useCallback(async () => {
    if (!newRequestSiteId) return;
    setLoading(true);
    setError(null);
    try {
      await createTechnicianContractRequest({
        siteId: newRequestSiteId,
      });
      await loadRequests();
      setNewRequestSiteId(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('technician.contractRequests.errors.couldNotSubmit'),
      );
    } finally {
      setLoading(false);
    }
  }, [newRequestSiteId, loadRequests, t]);

  const handleDecision = useCallback(async (requestId: number, decision: 'approve' | 'reject') => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await decideTechnicianContractRequest(requestId, { decision });
      await loadRequests();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('technician.contractRequests.errors.couldNotDecide'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, loadRequests, t]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const statusToLabel = useCallback((status: TechnicianContractRequestStatus) => {
    switch (status) {
      case 'pending': return t('technician.contractRequests.status.pending');
      case 'approved': return t('technician.contractRequests.status.approved');
      case 'rejected': return t('technician.contractRequests.status.rejected');
      default: return status;
    }
  }, [t]);

  return (
    <Screen>
      <Stack.Screen
        options={{ title: t('technician.contractRequests.title'), headerLeft: () => (
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
          {t('technician.contractRequests.title')}
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
              {t('technician.contractRequests.loading')}
            </Text>
          </Card>
        ) : (
          <>
            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('technician.contractRequests.existing')}
            </Text>

            {requests.length > 0 ? (
              <Card padded={false} className="mb-4">
                {requests.map((request) => (
                  <View
                    key={request.id}
                    className="border-b border-dashboard-card-line px-4 py-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12px] text-ink">
                        {sites.find((site) => site.id === request.siteId)?.name ??
                          t('technician.contractRequests.siteFallback', { id: request.siteId })}
                      </Text>
                      <Text
                        className={`text-[10px] font-medium`}
                        style={{ color: request.status === 'approved' ? dashboardColors.statMintDeep : dashboardColors.statCitronDeep }}
                      >
                        {statusToLabel(request.status)}
                      </Text>
                    </View>
                    <Text className="mt-1 text-[10px] text-dashboard-subtitle">
                      {t('technician.contractRequests.createdAt', { date: request.createdAt })}
                    </Text>
                    {canDecide && request.status === 'pending' && (
                      <View className="mt-2 flex-row justify-end gap-2">
                        <Button
                          variant="secondary"
                          onPress={() => handleDecision(request.id, 'reject')}
                          loading={loading}
                          style={{ minWidth: 100 }}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color={palette.ink} />
                          ) : (
                            <Text className="text-[11px] font-medium">
                              {t('technician.contractRequests.reject')}
                            </Text>
                          )}
                        </Button>
                        <Button
                          variant="primary"
                          onPress={() => handleDecision(request.id, 'approve')}
                          loading={loading}
                          style={{ minWidth: 100 }}
                          disabled={loading}
                        >
                          {loading ? (
                            <ActivityIndicator color={palette.card} />
                          ) : (
                            <Text className="text-[11px] font-medium">
                              {t('technician.contractRequests.approve')}
                            </Text>
                          )}
                        </Button>
                      </View>
                    )}
                  </View>
                ))}
              </Card>
            ) : (
              <Card className="mb-4">
                <Text className="p-4 text-center text-dashboard-subtitle">
                  {t('technician.contractRequests.noRequests')}
                </Text>
              </Card>
            )}

            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('technician.contractRequests.new')}
            </Text>

            <Card padded={false} className="mb-4">
              <View className="px-4 py-3">
                <Picker
                  label={t('technician.contractRequests.newSite')}
                  value={newRequestSiteId !== null ? String(newRequestSiteId) : null}
                  onChange={(value) => setNewRequestSiteId(value ? Number(value) : null)}
                  options={sites.map((site) => ({
                    value: String(site.id),
                    label: site.name,
                  }))}
                  placeholder={t('technician.contractRequests.chooseSite')}
                />
                <View className="mt-3 flex-row justify-end gap-2">
                  <Button
                    variant="secondary"
                    onPress={() => setNewRequestSiteId(null)}
                    disabled={!newRequestSiteId}
                  >
                    {t('technician.contractRequests.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    onPress={submitContractRequest}
                    loading={loading}
                    disabled={!newRequestSiteId}
                  >
                    {t('technician.contractRequests.submit')}
                  </Button>
                </View>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}