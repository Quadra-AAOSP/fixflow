import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ClipboardList,
  Lock,
  RefreshCw,
  UserPlus,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextField } from '@/components/ui/TextField';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, toErrorMessage } from '@/lib/apiClient';
import {
  assignTechnician,
  getReport,
  joinReport,
  listReporters,
} from '@/services/reports';
import { useCurrentSite } from '@/stores/site';
import type { Report, ReportReporter, Urgency } from '@/types';
import { formatDate, humanize } from '@/utils/format';
import { urgencyLabels } from '@/utils/maintenance';

/**
 * Report detail. Mirrors `ReportDetailView.vue`:
 */
export default function ReportDetailScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const reportId = rawId ? Number(rawId) : Number.NaN;
  const { user } = useAuth();
  const { sites } = useCurrentSite();

  const [report, setReport] = useState<Report | null>(null);
  const [reporters, setReporters] = useState<ReportReporter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [technicianId, setTechnicianId] = useState('');

  const load = useCallback(async () => {
    if (!Number.isInteger(reportId) || reportId <= 0) {
      setLoadError(t('reports.detail.noAccess'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const next = await getReport(reportId);
      setReport(next);

      if (next.policy.canSeeSensitive) {
        try {
          setReporters(await listReporters(reportId));
        } catch {
          // Non-fatal: the report body already loaded. Reporters is a bonus.
          setReporters(null);
        }
      } else {
        setReporters(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setLoadError(t('reports.detail.noAccess'));
      } else if (err instanceof ApiError && err.status === 404) {
        setLoadError(t('reports.detail.gone'));
      } else {
        setLoadError(
          toErrorMessage(err, { fallback: t('reports.detail.couldNotLoad') }),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [reportId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onJoin() {
    setActionError(null);
    setActionMessage(null);
    setJoining(true);
    try {
      const updated = await joinReport(reportId);
      setReport(updated);
      setActionMessage(t('reports.detail.joinedSuccess'));
      try {
        setReporters(await listReporters(reportId));
      } catch {
        setReporters(null);
      }
    } catch (err) {
      setActionError(
        toErrorMessage(err, { fallback: t('reports.detail.couldNotJoin') }),
      );
    } finally {
      setJoining(false);
    }
  }

  async function onAssign() {
    setActionError(null);
    setActionMessage(null);
    const parsed = Number(technicianId.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setActionError(t('reports.detail.assignEnterValid'));
      return;
    }

    setAssigning(true);
    try {
      const updated = await assignTechnician(reportId, {
        technicianId: parsed,
      });
      setReport(updated);
      setTechnicianId('');
      setActionMessage(t('reports.detail.assignSaved'));
    } catch (err) {
      setActionError(
        toErrorMessage(err, { fallback: t('reports.detail.couldNotAssign') }),
      );
    } finally {
      setAssigning(false);
    }
  }

  if (loading && !report) {
    return (
      <Screen>
        <StateView variant="loading" title={t('reports.detail.loading')} />
      </Screen>
    );
  }

  if (loadError && !report) {
    return (
      <Screen>
        <StateView
          variant="error"
          title={t('reports.detail.couldNotLoadTitle')}
          description={loadError}
          actionLabel={t('reports.detail.retry')}
          onAction={() => {
            void load();
          }}
        />
      </Screen>
    );
  }

  if (!report) {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={ClipboardList}
          title={t('reports.detail.notFoundTitle')}
        />
      </Screen>
    );
  }

  const canSeeSensitive = report.policy.canSeeSensitive;
  const canAssign = report.policy.canAssign;
  // Backend permits any same-site actor to join, but the concept is only
  // meaningful for reporters who did not file the report themselves.
  const canJoin = report.policy.canJoin;
  const joined =
    report.policy.participant;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('reports.detail.title', { id: report.id }) }} />
      <ScrollView contentContainerClassName="px-5 py-4">
        {/* Card heading — matches the web's `.card-heading` with a
            left-aligned "All reports" link and a right-aligned reload
            button. */}
        <View className="mb-3 flex-row items-center justify-between">
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('reports.detail.allReports')}
            onPress={() => router.push('/reports')}
            className="flex-row items-center gap-1 active:opacity-70"
          >
            <ArrowLeft color={dashboardColors.teal} size={15} />
            <Text
              className="text-[11px] font-semibold"
              style={{ color: dashboardColors.teal }}
            >
              {t('reports.detail.allReports')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reload report"
            disabled={loading}
            onPress={() => {
              void load();
            }}
            className="h-8 w-8 items-center justify-center rounded-md active:opacity-70"
          >
            <RefreshCw color={dashboardColors.subtitle} size={15} />
          </Pressable>
        </View>

        <View className="mb-3 flex-row items-center justify-between">
          <Text
            className="text-2xl font-bold text-ink"
            style={{ letterSpacing: -0.5 }}
          >
            {t('reports.detail.title', { id: report.id })}
          </Text>
          <StatusBadge status={report.status} />
          {report.visibility === 'private' ? (
            <View
              className="flex-row items-center gap-1 rounded-full px-2 py-1"
              style={{ backgroundColor: dashboardColors.statCitronSoft }}
            >
              <Lock color={dashboardColors.statCitronDeep} size={11} />
              <Text
                className="text-[9px] font-semibold"
                style={{ color: dashboardColors.statCitronDeep }}
              >
                {t('reports.detail.private')}
              </Text>
            </View>
          ) : null}
        </View>

        <Text className="mb-4 text-[14px] leading-[1.8] text-ink">
          {report.description}
        </Text>

        {/* Definition list — mirrors the web's `.report-detail-grid` (3-col
            on desktop, stacked on mobile). Field labels and the
            "Not shared or not provided" / "Not classified" / "Unassigned"
            fallback copy match the web exactly. */}
        <Card className="mb-4">
          <DefinitionRow
            label={t('reports.detail.definition.site')}
            value={
              report.siteId == null
                ? t('reports.detail.definition.notShared')
                : (sites.find((entry) => entry.id === report.siteId)?.name ??
                  `Site #${report.siteId}`)
            }
          />
          <DefinitionRow
            label={t('reports.detail.definition.location')}
            value={report.address ?? t('reports.detail.definition.notSharedOrNotProvided')}
          />
          <DefinitionRow label={t('reports.detail.definition.category')} value={humanize(report.category)} />
          <DefinitionRow
            label={t('reports.detail.definition.visibility')}
            value={
              report.visibility === 'private'
                ? t('reports.detail.definition.visibilityPrivate')
                : t('reports.detail.definition.visibilityPublic')
            }
          />
          <DefinitionRow
            label={t('reports.detail.definition.specialty')}
            value={
              report.specialty ? humanize(report.specialty) : t('reports.detail.definition.notSpecified')
            }
          />
          <DefinitionRow
            label={t('reports.detail.definition.reportedBy')}
            value={report.createdByName ?? t('reports.detail.definition.notShared')}
          />
          <DefinitionRow
            label={t('reports.detail.definition.technician')}
            value={
              report.assignedTechnicianId == null
                ? t('reports.detail.definition.unassigned')
                : t('reports.detail.definition.technicianId', { id: report.assignedTechnicianId })
            }
          />
          <DefinitionRow
            label={t('reports.detail.definition.reporterUrgency')}
            value={urgencyLabels[report.reporterUrgency]}
          />
          <DefinitionRow
            label={t('reports.detail.definition.aiUrgency')}
            value={
              report.aiUrgency ? urgencyLabels[report.aiUrgency] : t('reports.detail.definition.notClassified')
            }
          />
          <DefinitionRow
            label={t('reports.detail.definition.finalUrgency')}
            value={
              report.finalUrgency
                ? urgencyLabels[report.finalUrgency]
                : t('reports.detail.definition.notDetermined')
            }
          />
          <DefinitionRow
            label={t('reports.detail.definition.urgencyReason')}
            value={report.reporterReason ?? t('reports.detail.definition.notSharedOrNotProvided')}
          />
          <DefinitionRow
            label={t('reports.detail.definition.created')}
            value={formatDate(report.createdAt, true)}
          />
          <DefinitionRow
            label={t('reports.detail.definition.updated')}
            value={formatDate(report.updatedAt, true)}
          />
          <DefinitionRow
            label={t('reports.detail.definition.timesReopened')}
            value={String(report.reopenCount)}
          />
        </Card>

        {actionMessage ? (
          <View className="mb-3 rounded-md px-3 py-2" style={{ backgroundColor: dashboardColors.statMintSoft }}>
            <Text
              className="text-[11px] font-medium"
              style={{ color: dashboardColors.statMintDeep }}
            >
              {actionMessage}
            </Text>
          </View>
        ) : null}
        {actionError ? (
          <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
            <Text className="text-[11px] leading-[1.7] text-dashboard-error-text">
              {actionError}
            </Text>
          </View>
        ) : null}

        {/* "People attached to this report" — mirrors the web's
            `.reporter-list` section. Non-participants see the privacy
            note instead; participants see the joined list. */}
        {!canSeeSensitive ? (
          <Card className="mb-4">
            <Text className="text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('reports.detail.peopleBlocked')}
            </Text>
          </Card>
        ) : reporters && reporters.length > 0 ? (
          <Card padded={false} className="mb-4">
            <View className="border-b border-dashboard-card-line px-4 py-3">
              <Text
                className="text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                {t('reports.detail.peopleTitle')}
              </Text>
            </View>
            {reporters.map((row, index) => (
              <View
                key={row.userId}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  index > 0 ? 'border-t border-dashboard-card-line' : ''
                }`}
              >
                <Text className="text-sm font-medium text-ink">
                  {row.userId === user?.id ? t('reports.detail.you') : t('reports.detail.userId', { id: row.userId })}
                </Text>
                <Text className="text-[10px] text-dashboard-caption">
                  {t('reports.detail.joinedOn', { time: formatDate(row.joinedAt, true) })}
                </Text>
              </View>
            ))}
          </Card>
        ) : canSeeSensitive ? (
          <Card className="mb-4">
            <Text className="text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('reports.detail.peopleBlockedEmpty')}
            </Text>
          </Card>
        ) : null}

        {canJoin ? (
          <Card className="mb-4">
            <View className="mb-2 flex-row items-center gap-2">
              <UserPlus color={dashboardColors.teal} size={18} />
              <Text
                className="text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                {t('reports.detail.joinTitle')}
              </Text>
            </View>
            <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('reports.detail.joinBody')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reports.detail.joinButton')}
              accessibilityState={{ disabled: joining, busy: joining }}
              disabled={joining}
              onPress={onJoin}
              className="flex-row items-center justify-center gap-2 rounded-[11px] border px-4 py-3 active:opacity-90"
              style={{
                backgroundColor: dashboardColors.ctaBg,
                borderColor: dashboardColors.ctaBorder,
                opacity: joining ? 0.55 : 1,
              }}
            >
              <Text
                className="text-[13px] font-semibold"
                style={{ color: dashboardColors.ctaText }}
              >
                {joining ? t('reports.detail.joining') : t('reports.detail.joinButton')}
              </Text>
            </Pressable>
          </Card>
        ) : null}

        {canAssign ? (
          <Card className="mb-4">
            <Text
              className="mb-1 text-[15px] font-semibold text-ink"
              style={{ letterSpacing: -0.3 }}
            >
              {report.assignedTechnicianId
                ? t('reports.detail.assignTitleReassign')
                : t('reports.detail.assignTitleAssign')}
            </Text>
            <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('reports.detail.assignBody')}
            </Text>
            <TextField
              label={t('reports.detail.assignLabel')}
              value={technicianId}
              onChangeText={setTechnicianId}
              keyboardType="number-pad"
              placeholder={
                report.assignedTechnicianId !== null
                  ? t('reports.detail.assignPlaceholderCurrent', { id: report.assignedTechnicianId })
                  : t('reports.detail.assignPlaceholderExample')
              }
            />
            <Text className="-mt-2 mb-3 text-[10px] leading-[1.7] text-dashboard-caption">
              {t('reports.detail.assignHelper')}
            </Text>
            <Button
              label={
                report.assignedTechnicianId !== null
                  ? t('reports.detail.assignReassign')
                  : t('reports.detail.assignSave')
              }
              variant="secondary"
              onPress={onAssign}
              loading={assigning}
            />
          </Card>
        ) : null}

        {joined && user ? (
          <View className="mb-3 flex-row items-center gap-1.5">
            <View
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: dashboardColors.statMintDeep }}
            />
            <Text className="text-[10px] text-dashboard-caption">
              {t('reports.detail.attachedIndicator')}
            </Text>
          </View>
        ) : null}

        <View className="h-12" />
      </ScrollView>
    </Screen>
  );
}

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

function DefinitionRow({
  label, value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View className="mb-2 flex-row items-start justify-between gap-4 last:mb-0">
      <Text className="text-[11px] uppercase tracking-wide text-dashboard-subtitle">
        {label}
      </Text>
      <Text
        className="flex-1 text-right text-sm text-ink"
      >
        {value}
      </Text>
    </View>
  );
}
