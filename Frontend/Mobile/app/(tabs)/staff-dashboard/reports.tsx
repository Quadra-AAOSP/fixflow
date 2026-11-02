import { Stack, useRouter } from 'expo-router';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, Pressable, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors, themeColors } from '@/constants/theme';
import { canAssignTechnician, canConfirmReport, canReopenReport } from '@/constants/access';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  assignTechnicianToReport,
  confirmReport,
  listReports,
  reopenReport,
} from '@/services/staff';
import { listTechnicians } from '@/services/technicians';
import type { Report, TechnicianSummary } from '@/types';
import { fullName } from '@/utils/format';

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
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<number | null>(null);
  const [directory, setDirectory] = useState<TechnicianSummary[]>([]);
  const [reason, setReason] = useState('');

  const loadReports = useCallback(async () => {
    if (!user?.siteId) return;
    setLoading(true);
    setError(null);
    try {
      const reports = await listReports({ siteId: user.siteId });
      setReports(reports);
      setDirectory(await listTechnicians().catch(() => []));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('staff.reports.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );

  /**
   * Same directory rule the report-detail screen uses: available technicians
   * contracted at the report's site with a skill matching its category and
   * specialty. Avoids asking staff to type a raw account ID.
   */
  const candidates = useMemo(() => {
    if (!selectedReport?.siteId) return [];
    const category = selectedReport.category.toLowerCase();
    const specialty = selectedReport.specialty?.toLowerCase() ?? null;
    return directory
      .filter(
        (person) =>
          person.availabilityStatus === 'available' &&
          person.contracts.some(
            (contract) => contract.siteId === selectedReport.siteId,
          ),
      )
      .flatMap((person) => {
        const matches = person.skills.filter(
          (skill) =>
            skill.proficiency >= 1 &&
            skill.proficiency <= 5 &&
            skill.category.toLowerCase() === category &&
            (!specialty || skill.specialty?.toLowerCase() === specialty),
        );
        if (!matches.length) return [];
        return [
          {
            technician: person,
            proficiency: Math.max(
              ...matches.map((skill) => skill.proficiency),
            ),
          },
        ];
      });
  }, [directory, selectedReport]);

  const handleAssignTechnician = useCallback(async () => {
    if (!selectedReportId || selectedTechnicianId === null) return;
    if (!candidates.some((row) => row.technician.id === selectedTechnicianId)) {
      setError(t('staff.reports.errors.selectCandidate'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await assignTechnicianToReport(selectedReportId, {
        technicianId: selectedTechnicianId,
      });
      await loadReports();
      setSelectedReportId(null);
      setSelectedTechnicianId(null);
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
  }, [selectedReportId, selectedTechnicianId, candidates, loadReports, t]);

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
                        {report.description} - {report.status}
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
                  {candidates.length > 0 ? (
                    <View className="mb-2 overflow-hidden rounded-lg border border-dashboard-card-line">
                      {candidates.map((row, index) => {
                        const active = selectedTechnicianId === row.technician.id;
                        return (
                          <Pressable
                            key={row.technician.id}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            onPress={() => setSelectedTechnicianId(row.technician.id)}
                            className={`px-3 py-2 active:opacity-80 ${
                              index > 0 ? 'border-t border-dashboard-card-line' : ''
                            }`}
                            style={{
                              backgroundColor: active
                                ? dashboardColors.statMintSoft
                                : 'transparent',
                            }}
                          >
                            <Text className="text-[12px] font-medium text-ink">
                              {fullName(row.technician.firstName, row.technician.lastName)}
                            </Text>
                            <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                              {t('staff.reports.proficiency', {
                                level: row.proficiency,
                              })}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text className="mb-2 text-[11px] leading-[1.7] text-dashboard-subtitle">
                      {t('staff.reports.noCandidates')}
                    </Text>
                  )}
                  <View className="flex-row justify-end gap-2">
                    <Button
                      variant="secondary"
                      onPress={() => {
                        setSelectedReportId(null);
                        setSelectedTechnicianId(null);
                      }}
                      disabled={selectedTechnicianId === null}
                    >
                      {t('staff.reports.cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      onPress={handleAssignTechnician}
                      loading={loading}
                      disabled={selectedTechnicianId === null || !canAssign}
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