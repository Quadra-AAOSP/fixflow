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
  Building2,
  ClipboardList,
  FileText,
  Users,
  Wrench,
} from 'lucide-react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listReports, assignTechnician } from '@/services/reports';
import { listTechnicians } from '@/services/technicians';
import { useCurrentSite } from '@/stores/site';
import type { Report, Technician } from '@/types';

/**
 * Staff maintenance-coordination dashboard. Mirrors `StaffDashboardView.vue`.
 *
 * Focuses on:
 * - File reports for their site
 * - View site reports and authorized details
 * - View the technician directory
 * - Assign contracted technicians to reports when backend rules permit
 * - Confirm or reopen reports when backend rules permit
 * - View the full AI assessment when authorized
 */

export default function StaffDashboardScreen() {
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const { site, sites } = useCurrentSite();

  const [reports, setReports] = useState<Report[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!site?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [reports, technicians] = await Promise.all([
        listReports({ siteId: site.id, status: 'open' }),
        listTechnicians({ siteId: site.id }),
      ]);
      setReports(reports);
      setTechnicians(technicians);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('staffDashboard.loadFail'),
      );
    } finally {
      setLoading(false);
    }
  }, [site?.id, t]);

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
          title={t('staffDashboard.errorTitle')}
          description={error}
          actionLabel={t('staffDashboard.retry')}
          onAction={loadData}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* File Report Card */}
        <Card>
          <Pressable
            onPress={() => router.push('/reports/new')}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink }}>
                {t('staffDashboard.fileReport')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 4 }}>
                {t('staffDashboard.fileReportDesc')}
              </Text>
            </View>
            <FileText color={palette.tabIconSelected} size={24} />
          </Pressable>
        </Card>

        {/* Site Reports Card */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink }}>
                {t('staffDashboard.siteReports')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 4 }}>
                {t('staffDashboard.siteReportsDesc')}
              </Text>
            </View>
            <ClipboardList color={palette.tabIconSelected} size={24} />
          </View>
          {reports.length > 0 ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              {reports.slice(0, 3).map((report) => (
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
                      {report.subsiteName}
                    </Text>
                  </View>
                  <ArrowRight color={palette.subtitle} size={16} />
                </Pressable>
              ))}
              {reports.length > 3 && (
                <Pressable
                  onPress={() => router.push('/reports')}
                  style={{ padding: 12, backgroundColor: palette.card, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, color: palette.tabIconSelected }}>
                    {t('staffDashboard.viewAllReports')}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={{ marginTop: 16, fontSize: 14, color: palette.subtitle }}>
              {t('staffDashboard.noReports')}
            </Text>
          )}
        </Card>

        {/* Technician Directory Card */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink }}>
                {t('staffDashboard.technicianDirectory')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 4 }}>
                {t('staffDashboard.technicianDirectoryDesc')}
              </Text>
            </View>
            <Users color={palette.tabIconSelected} size={24} />
          </View>
          {technicians.length > 0 ? (
            <View style={{ marginTop: 16, gap: 8 }}>
              {technicians.slice(0, 3).map((technician) => (
                <View
                  key={technician.id}
                  style={{ padding: 12, backgroundColor: palette.card, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: palette.ink }}>
                      {technician.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: palette.subtitle, marginTop: 4 }}>
                      {technician.trade}
                    </Text>
                  </View>
                  <StatusBadge status={technician.contractStatus} />
                </View>
              ))}
              {technicians.length > 3 && (
                <Pressable
                  onPress={() => router.push('/more/technicians')}
                  style={{ padding: 12, backgroundColor: palette.card, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, color: palette.tabIconSelected }}>
                    {t('staffDashboard.viewAllTechnicians')}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={{ marginTop: 16, fontSize: 14, color: palette.subtitle }}>
              {t('staffDashboard.noTechnicians')}
            </Text>
          )}
        </Card>

        {/* Assign Technicians Card */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink }}>
                {t('staffDashboard.assignTechnicians')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 4 }}>
                {t('staffDashboard.assignTechniciansDesc')}
              </Text>
            </View>
            <Wrench color={palette.tabIconSelected} size={24} />
          </View>
          <Text style={{ marginTop: 16, fontSize: 14, color: palette.subtitle }}>
            {t('staffDashboard.assignTechniciansInfo')}
          </Text>
        </Card>

        {/* Confirm/Reopen Reports Card */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink }}>
                {t('staffDashboard.confirmReopen')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 4 }}>
                {t('staffDashboard.confirmReopenDesc')}
              </Text>
            </View>
            <ClipboardList color={palette.tabIconSelected} size={24} />
          </View>
          <Text style={{ marginTop: 16, fontSize: 14, color: palette.subtitle }}>
            {t('staffDashboard.confirmReopenInfo')}
          </Text>
        </Card>

        {/* AI Assessment Card */}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink }}>
                {t('staffDashboard.aiAssessment')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, marginTop: 4 }}>
                {t('staffDashboard.aiAssessmentDesc')}
              </Text>
            </View>
            <Wrench color={palette.tabIconSelected} size={24} />
          </View>
          <Text style={{ marginTop: 16, fontSize: 14, color: palette.subtitle }}>
            {t('staffDashboard.aiAssessmentInfo')}
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}