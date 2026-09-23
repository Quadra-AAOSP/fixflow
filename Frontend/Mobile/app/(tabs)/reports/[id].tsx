import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ClipboardList } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextField } from '@/components/ui/TextField';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, toErrorMessage } from '@/lib/apiClient';
import {
  assignTechnician,
  getReport,
  joinReport,
  listReporters,
} from '@/services/reports';
import type { Report, ReportReporter, Urgency } from '@/types';

/**
 * Report detail.
 *
 * Privacy model (mirrors `ReportService.canSeeSensitive`): the backend nulls
 * `createdByUserId`, `createdByName`, `address`, and `reporterReason` as a
 * block when the viewer is not a participant. `createdByUserId === null` is
 * therefore the single authoritative "this viewer sees the masked view"
 * signal, used here to gate the Join affordance and the hidden-details note.
 *
 * `listReporters` throws 403 for non-participants, so it is only requested
 * once we know the viewer is sensitive-eligible.
 */
export default function ReportDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const reportId = rawId ? Number(rawId) : Number.NaN;
  const { user } = useAuth();

  const [report, setReport] = useState<Report | null>(null);
  const [reporters, setReporters] = useState<ReportReporter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [technicianId, setTechnicianId] = useState('');

  const load = useCallback(async () => {
    if (!Number.isInteger(reportId) || reportId <= 0) {
      setLoadError('This report link is not valid.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const next = await getReport(reportId);
      setReport(next);

      if (next.createdByUserId !== null) {
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
        setLoadError('You do not have access to this report.');
      } else if (err instanceof ApiError && err.status === 404) {
        setLoadError('This report no longer exists.');
      } else {
        setLoadError(
          toErrorMessage(err, { fallback: 'Could not load this report.' }),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onJoin() {
    setActionError(null);
    setJoining(true);
    try {
      const updated = await joinReport(reportId);
      setReport(updated);
      try {
        setReporters(await listReporters(reportId));
      } catch {
        setReporters(null);
      }
    } catch (err) {
      setActionError(
        toErrorMessage(err, { fallback: 'Could not join this report.' }),
      );
    } finally {
      setJoining(false);
    }
  }

  async function onAssign() {
    setActionError(null);
    const parsed = Number(technicianId.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setActionError('Enter a valid technician ID.');
      return;
    }

    setAssigning(true);
    try {
      const updated = await assignTechnician(reportId, {
        technicianId: parsed,
      });
      setReport(updated);
      setTechnicianId('');
    } catch (err) {
      setActionError(
        toErrorMessage(err, { fallback: 'Could not assign the technician.' }),
      );
    } finally {
      setAssigning(false);
    }
  }

  if (loading && !report) {
    return (
      <Screen>
        <StateView variant="loading" title="Loading report…" />
      </Screen>
    );
  }

  if (loadError && !report) {
    return (
      <Screen>
        <StateView
          variant="error"
          title="Could not load report"
          description={loadError}
          actionLabel="Retry"
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
          title="Report unavailable"
        />
      </Screen>
    );
  }

  const isParticipant = report.createdByUserId !== null;
  const isCreator = user != null && report.createdByUserId === user.id;
  const canAssign =
    user?.role === 'staff' ||
    user?.role === 'admin' ||
    user?.role === 'super_admin';
  // Backend permits any same-site actor to join, but the concept is only
  // meaningful for reporters who did not file the report themselves.
  const canJoin = user?.role === 'reporter' && !isParticipant;

  return (
    <Screen>
      <Stack.Screen options={{ title: `Report #${report.id}` }} />
      <ScrollView contentContainerClassName="px-5 py-5">
        <View className="mb-3 flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {report.category}
          </Text>
          <StatusBadge status={report.status} />
        </View>

        <Text className="mb-5 text-base leading-6 text-foreground">
          {report.description}
        </Text>

        <View className="mb-4 rounded-xl border border-border bg-surface p-4">
          <Text className="mb-3 text-sm font-medium text-muted-foreground">Urgency</Text>
          <UrgencyRow label="Reporter" level={report.reporterUrgency} />
          {report.aiUrgency ? (
            <UrgencyRow label="AI" level={report.aiUrgency} />
          ) : null}
          {report.finalUrgency ? (
            <UrgencyRow label="Final" level={report.finalUrgency} />
          ) : null}
          {report.reporterReason ? (
            <Text className="mt-2 text-xs italic text-muted-foreground">
              “{report.reporterReason}”
            </Text>
          ) : null}
        </View>

        <View className="mb-4 rounded-xl border border-border bg-surface p-4">
          {report.specialty ? (
            <MetaRow label="Specialty" value={report.specialty} />
          ) : null}
          <MetaRow
            label="Reported"
            value={new Date(report.createdAt).toLocaleString()}
          />
          <MetaRow
            label="Updated"
            value={new Date(report.updatedAt).toLocaleString()}
          />
          {report.assignedTechnicianId !== null ? (
            <MetaRow
              label="Technician"
              value={`#${report.assignedTechnicianId}`}
            />
          ) : null}
          {report.reopenCount > 0 ? (
            <MetaRow label="Reopened" value={`${report.reopenCount}×`} />
          ) : null}
          {report.createdByName ? (
            <MetaRow label="Submitted by" value={report.createdByName} />
          ) : null}
          {report.address ? (
            <MetaRow label="Location" value={report.address} />
          ) : null}
        </View>

        {!isParticipant ? (
          <View className="mb-4 rounded-xl border border-border bg-surface p-4">
            <Text className="text-xs text-muted-foreground">
              Some details (location and submitter) are hidden for reports you
              did not file. Join the report if you are affected by the same
              issue.
            </Text>
          </View>
        ) : null}

        {canJoin ? (
          <Button
            label="I'm affected too — join this report"
            onPress={onJoin}
            loading={joining}
            className="mb-4"
          />
        ) : null}

        {isParticipant && reporters ? (
          <View className="mb-4 rounded-xl border border-border bg-surface p-4">
            <Text className="mb-2 text-sm font-medium text-muted-foreground">
              Reporters ({reporters.length})
            </Text>
            {reporters.map((row) => (
              <View
                key={row.userId}
                className="flex-row items-center justify-between py-1"
              >
                <Text className="text-sm text-foreground">
                  User #{row.userId}
                  {user != null && row.userId === user.id ? ' (you)' : ''}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {new Date(row.joinedAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {canAssign ? (
          <View className="mb-4 rounded-xl border border-border bg-surface p-4">
            <Text className="mb-3 text-sm font-medium text-muted-foreground">
              Assign technician
            </Text>
            <TextField
              label="Technician ID"
              value={technicianId}
              onChangeText={setTechnicianId}
              keyboardType="number-pad"
              placeholder={
                report.assignedTechnicianId !== null
                  ? `Currently #${report.assignedTechnicianId}`
                  : 'e.g. 12'
              }
            />
            <Text className="-mt-2 mb-3 text-xs text-muted-foreground">
              The technician directory is not exposed by the backend yet, so
              this takes a numeric user ID. A picker replaces this field once
              the endpoint lands.
            </Text>
            <Button
              label={
                report.assignedTechnicianId !== null
                  ? 'Reassign'
                  : 'Assign technician'
              }
              variant="secondary"
              onPress={onAssign}
              loading={assigning}
            />
          </View>
        ) : null}

        {actionError ? (
          <Text className="mb-3 text-sm text-error">{actionError}</Text>
        ) : null}

        {isCreator ? (
          <Text className="text-center text-xs text-muted-foreground">
            Filed by you
          </Text>
        ) : null}

        <View className="h-12" />
      </ScrollView>
    </Screen>
  );
}

function UrgencyRow({ label, level }: { label: string; level: Urgency }) {
  return (
    <View className="mb-2 flex-row items-center justify-between">
      <Text className="text-sm text-foreground">{label}</Text>
      <UrgencyChip level={level} />
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mb-2 flex-row items-start justify-between gap-4">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm text-foreground">{value}</Text>
    </View>
  );
}