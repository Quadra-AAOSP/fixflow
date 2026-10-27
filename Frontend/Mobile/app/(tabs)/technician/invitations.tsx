import { Stack, useRouter } from 'expo-router';
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
  getTechnicianInvitations,
} from '@/services/technicians';
import type { TechnicianInvitation } from '@/types/technician';

/**
 * Technician invitations screen.
 */
export default function TechnicianInvitationsScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();

  const [invitations, setInvitations] = useState<TechnicianInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const invitations = await getTechnicianInvitations();
      setInvitations(invitations);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('technician.invitations.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const statusToLabel = useCallback((status: TechnicianInvitation['status']) => {
    switch (status) {
      case 'pending': return t('technician.invitations.status.pending');
      case 'accepted': return t('technician.invitations.status.accepted');
      case 'rejected': return t('technician.invitations.status.rejected');
      default: return status;
    }
  }, [t]);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('technician.invitations.title') }} />
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <Text
          className="mb-4 text-2xl font-bold text-ink"
          style={{ letterSpacing: -0.5 }}
        >
          {t('technician.invitations.title')}
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
              {t('technician.invitations.loading')}
            </Text>
          </Card>
        ) : (
          <>
            {invitations.length > 0 ? (
              <Card padded={false} className="mb-4">
                {invitations.map((invitation) => (
                  <View
                    key={invitation.id}
                    className="border-b border-dashboard-card-line px-4 py-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12px] text-ink">
                        {invitation.reportTitle}
                      </Text>
                      <Text
                        className={`text-[10px] font-medium`}
                        style={{ color: invitation.status === 'accepted' ? dashboardColors.statMintDeep : dashboardColors.statCitronDeep }}
                      >
                        {statusToLabel(invitation.status)}
                      </Text>
                    </View>
                    <Text className="mt-1 text-[10px] text-dashboard-subtitle">
                      {t('technician.invitations.createdAt', { date: invitation.createdAt })}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Card className="mb-4">
                <Text className="p-4 text-center text-dashboard-subtitle">
                  {t('technician.invitations.noInvitations')}
                </Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}