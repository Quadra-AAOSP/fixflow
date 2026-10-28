import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { canAssignTechnician, canConfirmReport, canReopenReport } from '@/constants/access';
import { ApiError } from '@/lib/apiClient';
import {
  assignTechnicianToReport,
  canAssignTechnician,
  canConfirmReport,
  canReopenReport,
  confirmReport,
  listReports,
  reopenReport,
} from '@/services/staff';
import type { Report } from '@/types';

/**
 * Staff reports management screen.
 */
// Translations for Staff Reports
// Add these to your i18n common.json file
// {
//   "staff": {
//     "reports": {
//       "title": "Manage Reports",
//       "loading": "Loading reports...",
//       "noReports": "No reports found.",
//       "assignTechnician": "Assign Technician",
//       "enterTechnicianId": "Enter technician ID",
//       "assign": "Assign",
//       "cancel": "Cancel",
//       "confirmReport": "Confirm Report",
//       "confirm": "Confirm",
//       "reopenReport": "Reopen Report",
//       "enterReason": "Enter reason",
//       "reopen": "Reopen",
//       "errors": {
//         "couldNotLoad": "Failed to load reports.",
//         "couldNotAssign": "Failed to assign technician.",
//         "couldNotConfirm": "Failed to confirm report.",
//         "couldNotReopen": "Failed to reopen report.",
//         "notAuthorized": "You are not authorized to perform this action.",
//         "endpointNotFound": "The requested endpoint is not available."
//       }
//     }
//   }
// }

export default function StaffReportsScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const canAssign = canAssignTechnician(user);
  const canConfirm = canConfirmReport(user);
  const canReopen = canReopenReport(user);

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [technicianId, setTechnicianId] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const loadReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const reports = await listReports({ siteId: user.siteId });
      setReports(reports);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('staff.reports.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const handleAssignTechnician = useCallback(async () => {
    if (!selectedReportId || !technicianId) return;
    setLoading(true);
    setError(null);
    try {
      await assignTechnicianToReport(selectedReportId, technicianId);
      await loadReports();
      setSelectedReportId(null);
      setTechnicianId(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t('staff.reports.errors.notAuthorized'));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t('staff.reports.errors.endpointNotFound'));
      } else {
        setError(
          err instanceof ApiError ? err.message : t('staff.reports.errors.couldNotAssign'),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [selectedReportId, technicianId, loadReports, t]);

  const handleConfirmReport = useCallback(async () => {
    if (!selectedReportId) return;
    setLoading(true);
    setError(null);
    try {
      await confirmReport(selectedReportId);
      await loadReports();
      setSelectedReportId(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t('staff.reports.errors.notAuthorized'));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t('staff.reports.errors.endpointNotFound'));
      } else {
        setError(
          err instanceof ApiError ? err.message : t('staff.reports.errors.couldNotConfirm'),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [selectedReportId, loadReports, t]);

  const handleReopenReport = useCallback(async () => {
    if (!selectedReportId || !reason) return;
    setLoading(true);
    setError(null);
    try {
      await reopenReport(selectedReportId, reason);
      await loadReports();
      setSelectedReportId(null);
      setReason('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(t('staff.reports.errors.notAuthorized'));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t('staff.reports.errors.endpointNotFound'));
      } else {
        setError(
          err instanceof ApiError ? err.message : t('staff.reports.errors.couldNotReopen'),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [selectedReportId, reason, loadReports, t]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  return (
    <Screen>
      <Stack.Screen
        options={{ title: t('staff.reports.title'), headerLeft: () => (
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
          {t('staff.reports.title')}
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
              {t('staff.reports.loading')}
            </Text>
          </Card>
        ) : (
          <>
            {reports.length > 0 ? (
              <Card padded={false} className="mb-4">
                {reports.map((report) => (
                  <Pressable
                    key={report.id}
                    onPress={() => setSelectedReportId(report.id)}
                    className="border-b border-dashboard-card-line px-4 py-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12px] text-ink">
                        {report.title} - {report.status}
                      </Text>
                      {selectedReportId === report.id ? (
                        <Check color={dashboardColors.statMintDeep} size={16} />
                      ) : (
                        <ArrowRight color={dashboardColors.subtitle} size={16} />
                      )}
                    </View>
                  </Pressable>
                ))}
              </Card>
            ) : (
              <Card className="mb-4">
                <Text className="p-4 text-center text-dashboard-subtitle">
                  {t('staff.reports.noReports')}
                </Text>
              </Card>
            )}

            {selectedReportId && (
              <Card padded={false} className="mb-4">
                <View className="px-4 py-3">
                  <Text className="mb-2 text-[12px] text-ink">
                    {t('staff.reports.assignTechnician')}
                  </Text>
                  <TextInput
                    placeholder={t('staff.reports.enterTechnicianId')}
                    placeholderTextColor={dashboardColors.subtitle}
                    className="mb-2 rounded-lg border border-dashboard-card-line bg-card px-3 py-2 text-[12px] text-ink"
                    value={technicianId ? String(technicianId) : ''}
                    onChangeText={(text) => setTechnicianId(text ? Number(text) : null)}
                    keyboardType="numeric"
                  />
                  <View className="flex-row justify-end gap-2">
                    <Button
                      variant="secondary"
                      onPress={() => {
                        setSelectedReportId(null);
                        setTechnicianId(null);
                      }}
                      disabled={!technicianId}
                    >
                      {t('staff.reports.cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      onPress={handleAssignTechnician}
                      loading={loading}
                      disabled={!technicianId || !canAssign}
                    >
                      {t('staff.reports.assign')}
                    </Button>
                  </View>
                </View>

                <View className="px-4 py-3 border-t border-dashboard-card-line">
                  <Text className="mb-2 text-[12px] text-ink">
                    {t('staff.reports.confirmReport')}
                  </Text>
                  <Button
                    variant="primary"
                    onPress={handleConfirmReport}
                    loading={loading}
                    disabled={!canConfirm}
                  >
                    {t('staff.reports.confirm')}
                  </Button>
                </View>

                <View className="px-4 py-3 border-t border-dashboard-card-line">
                  <Text className="mb-2 text-[12px] text-ink">
                    {t('staff.reports.reopenReport')}
                  </Text>
                  <TextInput
                    placeholder={t('staff.reports.enterReason')}
                    placeholderTextColor={dashboardColors.subtitle}
                    className="mb-2 rounded-lg border border-dashboard-card-line bg-card px-3 py-2 text-[12px] text-ink"
                    value={reason}
                    onChangeText={setReason}
                    multiline
                  />
                  <View className="flex-row justify-end gap-2">
                    <Button
                      variant="secondary"
                      onPress={() => setReason('')}
                      disabled={!reason}
                    >
                      {t('staff.reports.cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      onPress={handleReopenReport}
                      loading={loading}
                      disabled={!reason || !canReopen}
                    >
                      {t('staff.reports.reopen')}
                    </Button>
                  </View>
                </View>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}