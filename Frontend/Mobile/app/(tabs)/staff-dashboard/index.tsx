import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react-native';

// Translations for Staff Dashboard
// Add these to your i18n common.json file
// {
//   "staff": {
//     "dashboard": {
//       "title": "Staff Dashboard",
//       "loading": "Loading data...",
//       "reports": "Reports",
//       "noReports": "No reports found.",
//       "technicians": "Technicians",
//       "noTechnicians": "No technicians found.",
//       "errors": {
//         "couldNotLoad": "Failed to load data."
//       }
//     }
//   },
//   "tabs": {
//     "staffDashboard": "Staff"
//   }
// }

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  assignTechnicianToReport,
  confirmReport,
  listReports,
  listTechnicians,
  reopenReport,
} from '@/services/staff';
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
  const { t } = useTranslation('common');
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Load reports
      const reports = await listReports({ siteId: user.siteId });
      setReports(reports);

      // Load technicians
      const technicians = await listTechnicians();
      setTechnicians(technicians);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('staff.dashboard.errors.couldNotLoad'),
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
      <Stack.Screen options={{ title: t('staff.dashboard.title') }} />
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <Text
          className="mb-4 text-2xl font-bold text-ink"
          style={{ letterSpacing: -0.5 }}
        >
          {t('staff.dashboard.title')}
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
              {t('staff.dashboard.loading')}
            </Text>
          </Card>
        ) : (
          <>
            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('staff.dashboard.reports')}
            </Text>
            {reports.length > 0 ? (
              <Card padded={false} className="mb-4">
                {reports.map((report) => (
                  <View
                    key={report.id}
                    className="border-b border-dashboard-card-line px-4 py-3"
                  >
                    <Text className="text-[12px] text-ink">
                      {report.title} - {report.status}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Card className="mb-4">
                <Text className="p-4 text-center text-dashboard-subtitle">
                  {t('staff.dashboard.noReports')}
                </Text>
              </Card>
            )}

            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('staff.dashboard.technicians')}
            </Text>
            {technicians.length > 0 ? (
              <Card padded={false} className="mb-4">
                {technicians.map((technician) => (
                  <View
                    key={technician.id}
                    className="border-b border-dashboard-card-line px-4 py-3"
                  >
                    <Text className="text-[12px] text-ink">
                      {technician.name} - {technician.status}
                    </Text>
                  </View>
                ))}
              </Card>
            ) : (
              <Card className="mb-4">
                <Text className="p-4 text-center text-dashboard-subtitle">
                  {t('staff.dashboard.noTechnicians')}
                </Text>
              </Card>
            )}

            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('staff.dashboard.actions')}
            </Text>
            <Pressable
              onPress={() => router.push('/staff-dashboard/reports')}
              className="mb-4 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg px-4 py-3"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-[12px] text-ink">
                  {t('staff.dashboard.manageReports')}
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