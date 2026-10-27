import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Handshake,
  UserRound,
  Wrench,
  FileText,
  Calendar,
  CheckCircle,
  ClipboardList,
} from 'lucide-react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listTechnicianInvitations, listTechnicianContracts } from '@/services/technicians';
import { listReports } from '@/services/reports';
import type { Report, TechnicianContract, TechnicianInvitation } from '@/types';

/**
 * Technician-focused dashboard centered on:
 * - Eligible assignment discovery
 * - Invitations
 * - Contract-request status
 * - Technician terms
 * - Authorized contract information
 * - Active work and report details
 */

export default function TechnicianDashboardScreen() {
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation('common');

  const [invitations, setInvitations] = useState<TechnicianInvitation[]>([]);
  const [contracts, setContracts] = useState<TechnicianContract[]>([]);
  const [activeReports, setActiveReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invitations, contracts, reports] = await Promise.all([
        listTechnicianInvitations(),
        listTechnicianContracts(),
        listReports({ status: 'assigned', assignedTo: user?.id }),
      ]);
      setInvitations(invitations);
      setContracts(contracts);
      setActiveReports(reports);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('technicianDashboard.loadFail'),
      );
    } finally {
      setLoading(false);
    }
  }, [t, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

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
          title={t('technicianDashboard.errorTitle')}
          description={error}
          actionLabel={t('technicianDashboard.retry')}
          onAction={loadData}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Invitations Card */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink }}>
                {t('technicianDashboard.invitations')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 4 }}>
                {t('technicianDashboard.invitationsDesc')}
              </Text>
            </View>
            <ClipboardList color={palette.tabIconSelected} size={24} />
          </View>
          {invitations.length > 0 ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              {invitations.map((invitation) => (
                <Pressable
                  key={invitation.id}
                  onPress={() => router.push(`/reports/${invitation.reportId}`)}
                  style={{ padding: 12, backgroundColor: palette.card, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: palette.ink }}>
                      {invitation.reportTitle}
                    </Text>
                    <Text style={{ fontSize: 12, color: palette.subtitle, marginTop: 4 }}>
                      {invitation.siteName}
                    </Text>
                  </View>
                  <ArrowRight color={palette.subtitle} size={16} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={{ marginTop: 16, fontSize: 14, color: palette.subtitle }}>
              {t('technicianDashboard.noInvitations')}
            </Text>
          )}
        </Card>

        {/* Contracts Card */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink }}>
                {t('technicianDashboard.contracts')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 4 }}>
                {t('technicianDashboard.contractsDesc')}
              </Text>
            </View>
            <Handshake color={palette.tabIconSelected} size={24} />
          </View>
          {contracts.length > 0 ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              {contracts.map((contract) => (
                <View
                  key={contract.id}
                  style={{ padding: 12, backgroundColor: palette.card, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: palette.ink }}>
                      {contract.siteName}
                    </Text>
                    <Text style={{ fontSize: 12, color: palette.subtitle, marginTop: 4 }}>
                      {t('technicianDashboard.contractStatus', { status: contract.status })}
                    </Text>
                  </View>
                  <StatusBadge status={contract.status} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ marginTop: 16, fontSize: 14, color: palette.subtitle }}>
              {t('technicianDashboard.noContracts')}
            </Text>
          )}
        </Card>

        {/* Active Work Card */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink }}>
                {t('technicianDashboard.activeWork')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 4 }}>
                {t('technicianDashboard.activeWorkDesc')}
              </Text>
            </View>
            <Wrench color={palette.tabIconSelected} size={24} />
          </View>
          {activeReports.length > 0 ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              {activeReports.map((report) => (
                <Pressable
                  key={report.id}
                  onPress={() => router.push(`/reports/${report.id}`)}
                  style={{ padding: 12, backgroundColor: palette.card, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: palette.ink }}>
                      {report.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: palette.subtitle, marginTop: 4 }}>
                      {report.siteName}
                    </Text>
                  </View>
                  <ArrowRight color={palette.subtitle} size={16} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={{ marginTop: 16, fontSize: 14, color: palette.subtitle }}>
              {t('technicianDashboard.noActiveWork')}
            </Text>
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}