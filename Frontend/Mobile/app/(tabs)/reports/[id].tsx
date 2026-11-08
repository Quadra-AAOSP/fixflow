import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Lock,
  Pencil,
  Play,
  RefreshCw,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ReportAssistantChat } from '@/components/chat/ReportAssistantChat';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextField } from '@/components/ui/TextField';
import { dashboardColors } from '@/constants/theme';
import { canTriggerManualAIClassification } from '@/constants/access';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, toErrorMessage } from '@/lib/apiClient';
import {
  assignTechnician,
  classifyReport,
  confirmReport,
  getReport,
  getVisionJobStatus,
  joinReport,
  listReporters,
  overrideUrgency,
  reopenReport,
  resolveReport,
  startReport,
  triggerVisionProcessing,
  getReportPhotos,
  updateReport,
} from '@/services/reports';

// NOTE: The backend does not currently have a dedicated 'leaveReport' endpoint.
// Required backend operation:
// DELETE /api/reports/{id}/reporters/{reporterId}
// Authorization: Only the reporter themselves or a site admin/super admin
// Expected behavior: Removes the reporter from the report's reporter list
// If implemented, add a leaveReport function to the reports service and implement the UI for it.
import { useCurrentSite } from '@/stores/site';
import { getPhotoSignedUrl } from '@/services/photos';
import {
  inviteTechniciansToReport,
  listTechnicians,
  rankTechniciansForReport,
} from '@/services/technicians';
import type {
  RankingMode,
  Report,
  ReportPhoto,
  ReportReporter,
  TechnicianInvitationsSent,
  TechnicianRanking,
  TechnicianSummary,
  Urgency,
  VisionJob,
} from '@/types';
import { formatDate, humanize } from '@/utils/format';
import { urgencyLabels } from '@/utils/maintenance';
import {
  canEditReport,
  canTechnicianResolve,
  canTechnicianStart,
  isAssignedToMe,
} from '@/utils/reportActions';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';

/** A selectable assignment candidate (server ranking or directory-derived). */
type AssignmentCandidate = {
  technicianId: number;
  proficiency: number;
  specialtyMatch: boolean;
  activeCases: number | null;
};

/**
 * Report detail. Mirrors `ReportDetailView.vue`:
 */
export default function ReportDetailScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const reportId = rawId ? Number(rawId) : Number.NaN;
  const { user, logout } = useAuth();
  const { sites } = useCurrentSite();

  const [report, setReport] = useState<Report | null>(null);
  const [reporters, setReporters] = useState<ReportReporter[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAssessment, setAiAssessment] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [ranking, setRanking] = useState<TechnicianRanking | null>(null);
  const [rankingMode, setRankingMode] = useState<RankingMode>('STANDARD');
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [directory, setDirectory] = useState<TechnicianSummary[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<number | null>(null);
  const [inviteReason, setInviteReason] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState<TechnicianInvitationsSent | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenModalVisible, setReopenModalVisible] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  // Signed photo URLs expire; keep refreshed replacements keyed by photo id.
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [visionJob, setVisionJob] = useState<VisionJob | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [visionError, setVisionError] = useState<string | null>(null);
  const visionPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const visionAttempts = useRef(0);

  // Two-step resolution (technician) + triage override (staff/admin).
  const [starting, setStarting] = useState(false);
  const [resolveVisible, setResolveVisible] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [urgencyVisible, setUrgencyVisible] = useState(false);
  const [urgencyDraft, setUrgencyDraft] = useState<Urgency>('medium');
  const [urgencyReason, setUrgencyReason] = useState('');
  const [urgencyError, setUrgencyError] = useState<string | null>(null);
  const [urgencySaving, setUrgencySaving] = useState(false);

  // Field edit.
  const [editVisible, setEditVisible] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editUrgency, setEditUrgency] = useState<Urgency>('medium');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('public');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setSelectedTechnicianId(null);
      setPhotoUrls({});
      setVisionJob(null);
      setVisionError(null);

      if (next.policy.canSeeSensitive) {
        const photos = await getReportPhotos(reportId);
        setReport({ ...next, photos });
        if (user) {
          setReporters(await listReporters(reportId));
        } else {
          setReporters(null);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      } else if (err instanceof ApiError && err.status === 403) {
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

  const triggerAiAssessment = useCallback(async () => {
    if (!report || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const updatedReport = await classifyReport(reportId);
      setAiAssessment(updatedReport);
      setReport(updatedReport);
    } catch (err) {
      setAiError(
        err instanceof ApiError ? err.message : t('reports.detail.aiAssessmentError'),
      );
    } finally {
      setAiLoading(false);
    }
  }, [report, reportId, aiLoading, t]);

  const renewPhotoUrl = useCallback(
    async (photo: ReportPhoto) => {
      try {
        const fresh = await getPhotoSignedUrl(reportId, photo.id);
        setPhotoUrls((previous) => ({ ...previous, [photo.id]: fresh.url }));
      } catch {
        // Keep the existing URL; the thumbnail simply stays unavailable.
      }
    },
    [reportId],
  );

  const stopVisionPolling = useCallback(() => {
    if (visionPollTimer.current !== null) {
      clearInterval(visionPollTimer.current);
      visionPollTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopVisionPolling(), [stopVisionPolling]);

  /**
   * Non-blocking photo analysis: the trigger request returns immediately and
   * the job is polled in the background while the badge reflects its state.
   * The technician/reporter can keep using the screen meanwhile.
   */
  const pollVisionJob = useCallback(
    async (jobId: string) => {
      try {
        const next = await getVisionJobStatus(reportId, jobId);
        setVisionJob(next);
        if (next.status === 'completed') {
          stopVisionPolling();
          await load();
        } else if (next.status === 'failed') {
          stopVisionPolling();
          setVisionError(t('reports.detail.vision.failed'));
        } else {
          visionAttempts.current += 1;
          if (visionAttempts.current >= 30) {
            stopVisionPolling();
            setVisionError(t('reports.detail.vision.timedOut'));
          }
        }
      } catch {
        stopVisionPolling();
        setVisionError(t('reports.detail.vision.failed'));
      }
    },
    [reportId, load, stopVisionPolling, t],
  );

  const analyzePhotos = useCallback(async () => {
    if (visionLoading) return;
    setVisionLoading(true);
    setVisionError(null);
    try {
      const job = await triggerVisionProcessing(reportId);
      setVisionJob(job);
      visionAttempts.current = 0;
      stopVisionPolling();
      if (job.status === 'completed') {
        await load();
      } else if (job.status !== 'failed') {
        visionPollTimer.current = setInterval(() => {
          void pollVisionJob(job.id);
        }, 2000);
      } else {
        setVisionError(t('reports.detail.vision.failed'));
      }
    } catch (err) {
      // 404/501/503 mean the vision service is not configured on this server:
      // that is an "unavailable" state, not a transient failure.
      const unavailable =
        err instanceof ApiError &&
        (err.status === 404 || err.status === 501 || err.status === 503);
      setVisionError(
        unavailable
          ? t('reports.detail.vision.unavailable')
          : err instanceof ApiError
            ? err.message
            : t('reports.detail.vision.failed'),
      );
    } finally {
      setVisionLoading(false);
    }
  }, [reportId, visionLoading, load, stopVisionPolling, pollVisionJob, t]);

  const confirmAnalyzePhotos = useCallback(() => {
    if (visionLoading) return;
    Alert.alert(
      t('reports.detail.vision.consentTitle'),
      t('reports.detail.vision.consentMessage'),
      [
        { text: t('reports.detail.vision.cancel'), style: 'cancel' },
        {
          text: t('reports.detail.vision.continue'),
          onPress: () => {
            void analyzePhotos();
          },
        },
      ],
    );
  }, [analyzePhotos, visionLoading, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Live status/assignment events: the detail reloads within ~400 ms of a
  // server commit. Falls back to polling when the socket is unavailable.
  const onRealtimeSignal = useCallback(() => {
    if (realtimeTimer.current !== null) clearTimeout(realtimeTimer.current);
    realtimeTimer.current = setTimeout(() => {
      realtimeTimer.current = null;
      void load();
    }, 400);
  }, [load]);

  useRealtimeEvents(
    Number.isInteger(reportId) && reportId > 0 ? `/reports/${reportId}/events` : null,
    onRealtimeSignal,
    { enabled: user !== null },
  );

  useEffect(
    () => () => {
      if (realtimeTimer.current !== null) clearTimeout(realtimeTimer.current);
    },
    [],
  );

  const isReportManager =
    user?.role === 'admin' || user?.role === 'super_admin';

  /**
   * Admins/super admins rank through the backend (STANDARD or AI/OpenRouter);
   * staff fall back to the directory filters the web uses. Ranking is only
   * permitted for admins, so never call it for staff.
   */
  const loadCandidates = useCallback(
    async (mode: RankingMode) => {
      if (!report || !report.policy.canAssign) return;
      setRankingLoading(true);
      setRankingError(null);
      setDirectoryError(null);
      const results = await Promise.allSettled([
        listTechnicians(),
        isReportManager
          ? rankTechniciansForReport(report.id, mode)
          : Promise.resolve(null),
      ]);
      if (results[0].status === 'fulfilled') {
        setDirectory(results[0].value);
      } else {
        setDirectoryError(
          toErrorMessage(results[0].reason, {
            fallback: t('reports.detail.assignDirectoryError'),
          }),
        );
      }
      if (results[1].status === 'fulfilled') {
        setRanking(results[1].value);
      } else if (isReportManager) {
        setRankingError(
          toErrorMessage(results[1].reason, {
            fallback: t('reports.detail.assignRankingError'),
          }),
        );
      }
      setRankingLoading(false);
    },
    [report, isReportManager, t],
  );

  useEffect(() => {
    if (!report) return;
    void loadCandidates(rankingMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    report?.id,
    report?.siteId,
    report?.category,
    report?.specialty,
    report?.policy.canAssign,
    rankingMode,
  ]);

  const assignmentCandidates = useMemo<AssignmentCandidate[]>(() => {
    if (!report) return [];
    if (isReportManager) {
      return (ranking?.candidates ?? []).map((candidate) => ({
        technicianId: candidate.technicianId,
        proficiency: candidate.proficiency,
        specialtyMatch: candidate.specialtyMatch,
        activeCases: candidate.activeCases,
      }));
    }
    if (!report.siteId) return [];
    const category = report.category.toLowerCase();
    const specialty = report.specialty?.toLowerCase() ?? null;
    return directory
      .filter(
        (person) =>
          person.availabilityStatus === 'available' &&
          person.contracts.some((contract) => contract.siteId === report.siteId),
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
            technicianId: person.id,
            proficiency: Math.max(...matches.map((skill) => skill.proficiency)),
            specialtyMatch: specialty !== null,
            activeCases: null,
          },
        ];
      });
  }, [report, isReportManager, ranking, directory]);

  const technicianName = useCallback(
    (id: number) => {
      const person = directory.find((row) => row.id === id);
      return person
        ? `${person.firstName} ${person.lastName}`.trim()
        : t('reports.detail.assignAccount', { id });
    },
    [directory, t],
  );

  async function onInviteTechnicians() {
    const reason = inviteReason.trim();
    if (reason.length === 0) {
      setInviteError(t('reports.detail.inviteReasonRequired'));
      return;
    }
    if (reason.length > 1000) {
      setInviteError(t('reports.detail.inviteReasonTooLong'));
      return;
    }
    setInviting(true);
    setInviteError(null);
    try {
      const result = await inviteTechniciansToReport(
        reportId,
        reason,
        inviteSent ? inviteSent.page + 1 : 0,
      );
      setInviteSent(result);
    } catch (err) {
      setInviteError(
        toErrorMessage(err, { fallback: t('reports.detail.inviteError') }),
      );
    } finally {
      setInviting(false);
    }
  }

  function resetInvitePass() {
    setInviteSent(null);
    setInviteReason('');
    setInviteError(null);
  }

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
    if (selectedTechnicianId === null) {
      setActionError(t('reports.detail.assignSelectFirst'));
      return;
    }
    if (!assignmentCandidates.some((row) => row.technicianId === selectedTechnicianId)) {
      setActionError(t('reports.detail.assignSelectFirst'));
      return;
    }

    setAssigning(true);
    try {
      const updated = await assignTechnician(reportId, {
        technicianId: selectedTechnicianId,
      });
      setReport(updated);
      setSelectedTechnicianId(null);
      setActionMessage(t('reports.detail.assignSaved'));
      void loadCandidates(rankingMode);
    } catch (err) {
      setActionError(
        toErrorMessage(err, { fallback: t('reports.detail.couldNotAssign') }),
      );
    } finally {
      setAssigning(false);
    }
  }

  /**
   * Reassignment is the same server action as assignment, but it moves a job
   * away from a technician — require an explicit confirmation.
   */
  function requestAssign() {
    if (selectedTechnicianId === null) {
      setActionError(t('reports.detail.assignSelectFirst'));
      return;
    }
    if (!assignmentCandidates.some((row) => row.technicianId === selectedTechnicianId)) {
      setActionError(t('reports.detail.assignSelectFirst'));
      return;
    }
    if (
      report &&
      report.assignedTechnicianId !== null &&
      report.assignedTechnicianId === selectedTechnicianId
    ) {
      setActionError(t('reports.detail.assignSameTechnician'));
      return;
    }
    if (report && report.assignedTechnicianId !== null) {
      Alert.alert(
        t('reports.detail.assignReassignConfirmTitle'),
        t('reports.detail.assignReassignConfirmBody', {
          from: technicianName(report.assignedTechnicianId),
          to: technicianName(selectedTechnicianId),
        }),
        [
          { text: t('reports.detail.reopen.cancel'), style: 'cancel' },
          {
            text: t('reports.detail.assignReassignConfirmAction'),
            style: 'destructive',
            onPress: () => {
              void onAssign();
            },
          },
        ],
      );
      return;
    }
    void onAssign();
  }

  /** Technician: begin work. */
  async function onStartWork() {
    setActionError(null);
    setActionMessage(null);
    setStarting(true);
    try {
      const updated = await startReport(reportId);
      setReport(updated);
      setActionMessage(t('reports.detail.tech.started'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setActionError(t('reports.detail.tech.startWrongStatus'));
      } else {
        setActionError(
          toErrorMessage(err, { fallback: t('reports.detail.tech.startFailed') }),
        );
      }
    } finally {
      setStarting(false);
    }
  }

  function openResolveModal() {
    setActionError(null);
    setActionMessage(null);
    setResolveNote('');
    setResolveError(null);
    setResolveVisible(true);
  }

  async function performResolve(note: string) {
    setResolving(true);
    try {
      const updated = await resolveReport(reportId, note);
      setReport(updated);
      setResolveVisible(false);
      setResolveNote('');
      setActionMessage(t('reports.detail.tech.resolved'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setResolveError(t('reports.detail.tech.resolveWrongStatus'));
      } else if (err instanceof ApiError && err.status === 400) {
        setResolveError(t('reports.detail.tech.noteRequired'));
      } else {
        setResolveError(
          toErrorMessage(err, { fallback: t('reports.detail.tech.resolveFailed') }),
        );
      }
    } finally {
      setResolving(false);
    }
  }

  /** Marking work complete is irreversible from the technician's side. */
  function submitResolve() {
    const trimmed = resolveNote.trim();
    if (trimmed.length === 0) {
      setResolveError(t('reports.detail.tech.noteRequired'));
      return;
    }
    if (trimmed.length > 10000) {
      setResolveError(t('reports.detail.tech.noteTooLong'));
      return;
    }
    setResolveError(null);
    Alert.alert(
      t('reports.detail.tech.resolveConfirmTitle'),
      t('reports.detail.tech.resolveConfirmBody'),
      [
        { text: t('reports.detail.reopen.cancel'), style: 'cancel' },
        {
          text: t('reports.detail.tech.resolveConfirmAction'),
          onPress: () => {
            void performResolve(trimmed);
          },
        },
      ],
    );
  }

  function performConfirm() {
    void onConfirm();
  }

  /** A confirmation closes the loop for the reporter — never on a stray tap. */
  function confirmWithGuard() {
    Alert.alert(
      t('reports.detail.confirm.confirmTitle'),
      t('reports.detail.confirm.confirmBody'),
      [
        { text: t('reports.detail.reopen.cancel'), style: 'cancel' },
        {
          text: t('reports.detail.confirm.confirmAction'),
          onPress: performConfirm,
        },
      ],
    );
  }

  function openUrgencyModal() {
    if (!report) return;
    setActionError(null);
    setActionMessage(null);
    setUrgencyDraft(report.finalUrgency ?? report.aiUrgency ?? report.reporterUrgency);
    setUrgencyReason('');
    setUrgencyError(null);
    setUrgencyVisible(true);
  }

  async function submitUrgencyOverride() {
    const reason = urgencyReason.trim();
    if (reason.length === 0) {
      setUrgencyError(t('reports.detail.triage.reasonRequired'));
      return;
    }
    if (reason.length > 2000) {
      setUrgencyError(t('reports.detail.triage.reasonTooLong'));
      return;
    }
    setUrgencyError(null);
    setUrgencySaving(true);
    try {
      const updated = await overrideUrgency(reportId, urgencyDraft, reason);
      setReport(updated);
      setUrgencyVisible(false);
      setActionMessage(t('reports.detail.triage.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      setUrgencyError(
        toErrorMessage(err, { fallback: t('reports.detail.triage.failed') }),
      );
    } finally {
      setUrgencySaving(false);
    }
  }

  function openEditModal() {
    if (!report) return;
    setActionError(null);
    setActionMessage(null);
    setEditDescription(report.description);
    setEditAddress(report.address ?? '');
    setEditCategory(report.category);
    setEditSpecialty(report.specialty ?? '');
    setEditUrgency(report.reporterUrgency);
    setEditVisibility(report.visibility);
    setEditError(null);
    setEditVisible(true);
  }

  async function submitEdit() {
    if (!report) return;
    const description = editDescription.trim();
    if (description.length === 0) {
      setEditError(t('reports.detail.edit.descriptionRequired'));
      return;
    }
    if (description.length > 10000) {
      setEditError(t('reports.detail.edit.descriptionTooLong'));
      return;
    }
    const category = editCategory.trim();
    if (category.length === 0) {
      setEditError(t('reports.detail.edit.categoryRequired'));
      return;
    }
    setEditError(null);
    setEditSaving(true);
    try {
      const updated = await updateReport(reportId, {
        description,
        address: editAddress.trim(),
        category,
        specialty: editSpecialty.trim(),
        reporterUrgency: editUrgency,
        visibility: editVisibility,
      });
      setReport(updated);
      setEditVisible(false);
      setActionMessage(t('reports.detail.edit.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      if (
        err instanceof ApiError &&
        (err.status === 404 || err.status === 405 || err.status === 501)
      ) {
        setEditError(t('reports.detail.edit.unavailable'));
      } else if (err instanceof ApiError && err.status === 409) {
        setEditError(t('reports.detail.edit.wrongStatus'));
      } else if (err instanceof ApiError && err.status === 403) {
        setEditError(t('reports.detail.edit.forbidden'));
      } else {
        setEditError(
          toErrorMessage(err, { fallback: t('reports.detail.edit.failed') }),
        );
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function onConfirm() {
    setActionError(null);
    setActionMessage(null);
    setConfirming(true);
    try {
      const updated = await confirmReport(reportId);
      setReport(updated);
      setActionMessage(t('reports.detail.confirm.success'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setActionError(t('reports.detail.confirm.wrongStatus'));
      } else {
        setActionError(
          toErrorMessage(err, { fallback: t('reports.detail.confirm.failed') }),
        );
      }
    } finally {
      setConfirming(false);
    }
  }

  function openReopenModal() {
    setActionError(null);
    setActionMessage(null);
    setReopenReason('');
    setReopenError(null);
    setReopenModalVisible(true);
  }

  async function onSubmitReopen() {
    const trimmed = reopenReason.trim();
    if (trimmed.length === 0) {
      setReopenError(t('reports.detail.reopen.reasonRequired'));
      return;
    }
    if (trimmed.length > 500) {
      setReopenError(t('reports.detail.reopen.reasonTooLong'));
      return;
    }

    setReopenError(null);
    setReopening(true);
    try {
      const updated = await reopenReport(reportId, trimmed);
      setReport(updated);
      setReopenModalVisible(false);
      setReopenReason('');
      setActionMessage(t('reports.detail.reopen.success'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      if (err instanceof ApiError && err.status === 409) {
        setReopenError(t('reports.detail.reopen.wrongStatus'));
      } else if (err instanceof ApiError && err.status === 400) {
        setReopenError(t('reports.detail.reopen.reasonRequired'));
      } else {
        setReopenError(
          toErrorMessage(err, { fallback: t('reports.detail.reopen.failed') }),
        );
      }
    } finally {
      setReopening(false);
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
  // Report creator, joined participants, and staff/admin/super_admin may
  // confirm or reopen. Technicians, shop managers, and non-participant
  // reporters cannot — the server enforces this as 403.
  const canConfirmReopen = report.policy.participant || report.policy.canAssign;

  const awaitingConfirmation = report.status === 'resolved_pending_confirmation';
  const reopenable =
    report.status === 'confirmed' || report.status === 'resolved_pending_confirmation';

  const canEdit = canEditReport(report, user?.id);
  const assignedToMe = isAssignedToMe(report, user?.id);
  const canStartWork = canTechnicianStart(report, user?.id);
  const canResolveWork = canTechnicianResolve(report, user?.id);

  const urgencyOptions: { value: Urgency; label: string }[] = (
    ['low', 'medium', 'high', 'critical'] as Urgency[]
  ).map((value) => ({ value, label: t(urgencyLabels[value]) }));

  const visionStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable' | null =
    visionJob?.status === 'pending' ||
    visionJob?.status === 'processing' ||
    visionJob?.status === 'completed' ||
    visionJob?.status === 'failed'
      ? visionJob.status
      : visionError
        ? 'unavailable'
        : null;

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
            onPress={() => router.back()}
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
            accessibilityLabel={t('reports.detail.reloadReport')}
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

        <View className="mb-4">
          <Text className="mb-2 text-[14px] leading-[1.8] text-ink">
            {report.description}
          </Text>
          {canEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reports.detail.edit.button')}
              accessibilityState={{ disabled: editSaving }}
              onPress={openEditModal}
              disabled={editSaving}
              className="mb-2 flex-row items-center gap-1 self-start rounded-md border px-3 py-2 active:opacity-70"
              style={{ borderColor: dashboardColors.cardLine }}
            >
              <Pencil color={dashboardColors.subtitle} size={12} />
              <Text className="text-[11px] font-semibold text-dashboard-subtitle">
                {t('reports.detail.edit.button')}
              </Text>
            </Pressable>
          ) : null}
          {reporters && reporters.some(r => r.userId === user?.id) && (
            <Card className="mb-4">
              <View className="flex-row items-center justify-between px-4 py-3">
                <Text className="text-[12px] text-ink">
                  {t('reports.detail.youAreJoined')}
                </Text>
                <Text className="text-[10px] text-tone-danger">
                  {t('reports.detail.leaveReportNotAvailable')}
                </Text>
              </View>
            </Card>
          )}
        </View>

        {/* AI Assessment Section */}
        {report.aiReport && (
          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <Text
                className="text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                {t('reports.detail.aiAssessment.title')}
              </Text>
              {canTriggerManualAIClassification(user) && (
                <Pressable
                  onPress={triggerAiAssessment}
                  disabled={aiLoading}
                  accessibilityRole="button"
                  className="flex-row items-center gap-1 active:opacity-70"
                >
                  <Sparkles color={dashboardColors.teal} size={16} />
                  <Text className="text-[11px] font-medium text-dashboard-teal">
                    {aiLoading ? t('reports.detail.aiAssessment.loading') : t('reports.detail.aiAssessment.trigger')}
                  </Text>
                </Pressable>
              )}
            </View>
            {aiError && (
              <Text className="mt-2 text-[10px] text-tone-danger">
                {aiError}
              </Text>
            )}
            <View className="mt-2">
              <Text className="text-[12px] text-dashboard-subtitle">
                {t('reports.detail.aiAssessment.urgency')}: {report.aiReport.urgency ? urgencyLabels[report.aiReport.urgency] : '—'}
              </Text>
              {report.aiReport.description && (
                <Text className="mt-1 text-[12px] text-ink">
                  {report.aiReport.description}
                </Text>
              )}
              {canSeeSensitive && report.aiReport.confidence != null && (
                <Text className="mt-1 text-[11px] text-dashboard-caption">
                  {t('reports.detail.aiAssessment.confidence')}:{' '}
                  {Math.round(report.aiReport.confidence * 100)}%
                </Text>
              )}
            </View>
          </Card>
        )}

        {/* Photos gallery — fullscreen preview via Modal */}
        <Card className="mb-4">
          <Text
            className="mb-2 text-[15px] font-semibold text-ink"
            style={{ letterSpacing: -0.3 }}
          >
            {t('reports.detail.photos.title')}
          </Text>
          {report.photos && report.photos.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {report.photos.map((photo) => {
                const uri = photoUrls[photo.id] ?? photo.url;
                return (
                  <Pressable
                    key={photo.id}
                    accessibilityRole="image"
                    accessibilityLabel={`Photo ${photo.id}`}
                    onPress={() => setPreviewPhoto(uri)}
                    className="active:opacity-80"
                  >
                    <Image
                      source={{ uri }}
                      className="h-24 w-24 rounded-md"
                      onError={() => {
                        void renewPhotoUrl(photo);
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text className="text-[12px] text-dashboard-subtitle">
              {t('reports.detail.photos.noPhotos')}
            </Text>
          )}
          {canSeeSensitive && report.photos && report.photos.length > 0 ? (
            <View className="mt-3">
              <Pressable
                onPress={confirmAnalyzePhotos}
                disabled={visionLoading}
                accessibilityRole="button"
                className="flex-row items-center gap-1 self-start active:opacity-70"
              >
                <Sparkles color={dashboardColors.teal} size={15} />
                <Text className="text-[11px] font-medium text-dashboard-teal">
                  {visionLoading
                    ? t('reports.detail.vision.running')
                    : t('reports.detail.vision.analyze')}
                </Text>
              </Pressable>
              {visionStatus ? (
                <View
                  className="mt-2 flex-row items-center gap-1 self-start rounded-full px-2 py-1"
                  style={{ backgroundColor: visionStatusBackground(visionStatus) }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{ color: visionStatusInk(visionStatus) }}
                  >
                    {t(`reports.detail.vision.status.${visionStatus}`)}
                  </Text>
                </View>
              ) : null}
              {visionError ? (
                <Text className="mt-1 text-[10px] text-tone-danger">
                  {visionError}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Card>

        {/* Assistant chat — replaces the Phase 5 analysis placeholder.
            The backend allows the same audience as `canSeeSensitive`
            (participants, assigned technicians, staff/admin); everyone
            else gets a static pointer to join first. */}
        {canSeeSensitive ? (
          <ReportAssistantChat reportId={report.id} />
        ) : (
          <Card className="mb-4">
            <View className="flex-row items-center gap-2">
              <View
                className="rounded-full p-1.5"
                style={{ backgroundColor: dashboardColors.statMintSoft }}
              >
                <Sparkles color={dashboardColors.statMintDeep} size={13} />
              </View>
              <Text
                className="text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                {t('reports.detail.analysis.title')}
              </Text>
            </View>
            <Text className="mt-2 text-[12px] text-dashboard-subtitle">
              {t('reports.detail.analysis.joinToAsk')}
            </Text>
          </Card>
        )}

        {/* Triage: reporter vs AI vs final urgency, with the staff/admin
            override. Mirrors the web's urgency comparison panel. */}
        {canAssign ? (
          <Card className="mb-4">
            <Text
              className="mb-1 text-[15px] font-semibold text-ink"
              style={{ letterSpacing: -0.3 }}
            >
              {t('reports.detail.triage.title')}
            </Text>
            <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('reports.detail.triage.body')}
            </Text>
            <View className="mb-3 flex-row gap-2">
              {[
                {
                  label: t('reports.detail.definition.reporterUrgency'),
                  value: t(urgencyLabels[report.reporterUrgency]),
                },
                {
                  label: t('reports.detail.definition.aiUrgency'),
                  value: report.aiUrgency
                    ? t(urgencyLabels[report.aiUrgency])
                    : t('reports.detail.definition.notClassified'),
                },
                {
                  label: t('reports.detail.definition.finalUrgency'),
                  value: report.finalUrgency
                    ? t(urgencyLabels[report.finalUrgency])
                    : t('reports.detail.definition.notDetermined'),
                },
              ].map((cell) => (
                <View
                  key={cell.label}
                  className="flex-1 rounded-md border px-2.5 py-2"
                  style={{ borderColor: dashboardColors.cardLine }}
                >
                  <Text className="text-[9px] uppercase tracking-[0.5px] text-dashboard-subtitle">
                    {cell.label}
                  </Text>
                  <Text className="mt-1 text-[12px] font-semibold text-ink">
                    {cell.value}
                  </Text>
                </View>
              ))}
            </View>
            <Button
              label={t('reports.detail.triage.override')}
              variant="secondary"
              onPress={openUrgencyModal}
            />
          </Card>
        ) : null}

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
                  t('reports.detail.definition.notShared'))
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
                : t('reports.detail.definition.assigned')
            }
          />
          <DefinitionRow
            label={t('reports.detail.definition.reporterUrgency')}
            value={t(urgencyLabels[report.reporterUrgency])}
          />
          <DefinitionRow
            label={t('reports.detail.definition.aiUrgency')}
            value={
              report.aiUrgency ? t(urgencyLabels[report.aiUrgency]) : t('reports.detail.definition.notClassified')
            }
          />
          <DefinitionRow
            label={t('reports.detail.definition.finalUrgency')}
            value={
              report.finalUrgency
                ? t(urgencyLabels[report.finalUrgency])
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
            {isReportManager ? (
              <View className="mb-3">
                <Text className="mb-1 text-[10px] font-semibold uppercase tracking-[1px] text-dashboard-caption">
                  {t('reports.detail.assignCandidatesTitle')}
                </Text>
                <View className="flex-row gap-2">
                  {(['STANDARD', 'AI'] as RankingMode[]).map((mode) => {
                    const active = rankingMode === mode;
                    return (
                      <Pressable
                        key={mode}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => setRankingMode(mode)}
                        className="flex-row items-center gap-1 rounded-full border px-3 py-1.5 active:opacity-80"
                        style={{
                          backgroundColor: active
                            ? dashboardColors.statMintSoft
                            : dashboardColors.cardBg,
                          borderColor: active
                            ? dashboardColors.statMintDeep
                            : dashboardColors.cardLine,
                        }}
                      >
                        {mode === 'AI' ? (
                          <Sparkles
                            color={
                              active
                                ? dashboardColors.statMintDeep
                                : dashboardColors.subtitle
                            }
                            size={12}
                          />
                        ) : null}
                        <Text
                          className="text-[11px] font-semibold"
                          style={{
                            color: active
                              ? dashboardColors.statMintDeep
                              : dashboardColors.subtitle,
                          }}
                        >
                          {t(
                            mode === 'AI'
                              ? 'reports.detail.assignModeAI'
                              : 'reports.detail.assignModeStandard',
                          )}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {isReportManager && ranking ? (
              <Text className="mb-2 text-[10px] leading-[1.7] text-dashboard-caption">
                {t('reports.detail.assignRankingUsed', {
                  mode: humanize(ranking.methodUsed),
                })}
                {ranking.fallbackReason
                  ? ` · ${t('reports.detail.assignRankingFallback', {
                      reason: ranking.fallbackReason,
                    })}`
                  : ''}
              </Text>
            ) : null}

            {rankingLoading ? (
              <View className="mb-3 flex-row items-center gap-2">
                <ActivityIndicator color={dashboardColors.teal} size="small" />
                <Text className="text-[11px] text-dashboard-subtitle">
                  {t('reports.detail.assignLoadingCandidates')}
                </Text>
              </View>
            ) : null}

            {rankingError ? (
              <Text className="mb-2 text-[10px] leading-[1.7] text-tone-danger">
                {rankingError}
              </Text>
            ) : null}
            {directoryError ? (
              <Text className="mb-2 text-[10px] leading-[1.7] text-tone-danger">
                {directoryError}
              </Text>
            ) : null}

            {assignmentCandidates.length > 0 ? (
              <View className="mb-3 overflow-hidden rounded-md border border-dashboard-card-line">
                {assignmentCandidates.map((candidate, index) => {
                  const active =
                    selectedTechnicianId === candidate.technicianId;
                  return (
                    <Pressable
                      key={candidate.technicianId}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() =>
                        setSelectedTechnicianId(candidate.technicianId)
                      }
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
                        {technicianName(candidate.technicianId)}
                      </Text>
                      <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                        {t('reports.detail.assignProficiency', {
                          level: candidate.proficiency,
                        })}
                        {' · '}
                        {t(
                          candidate.specialtyMatch
                            ? 'reports.detail.assignSpecialtyMatch'
                            : 'reports.detail.assignSpecialtyMismatch',
                        )}
                        {candidate.activeCases !== null
                          ? ` · ${t('reports.detail.assignActiveCases', {
                              count: candidate.activeCases,
                            })}`
                          : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : !rankingLoading ? (
              <Text className="mb-3 text-[11px] leading-[1.7] text-dashboard-subtitle">
                {t('reports.detail.assignNoCandidates')}
              </Text>
            ) : null}
            <View className="flex-row items-center gap-2">
              <Button
                label={
                  report.assignedTechnicianId !== null
                    ? t('reports.detail.assignReassign')
                    : t('reports.detail.assignSave')
                }
                variant="secondary"
                onPress={requestAssign}
                loading={assigning}
                disabled={selectedTechnicianId === null || rankingLoading}
                className="flex-1"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('reports.detail.assignRefresh')}
                disabled={rankingLoading}
                onPress={() => {
                  void loadCandidates(rankingMode);
                }}
                className="h-11 w-11 items-center justify-center rounded-md active:opacity-70"
                style={{ opacity: rankingLoading ? 0.4 : 1 }}
              >
                <RefreshCw color={dashboardColors.subtitle} size={15} />
              </Pressable>
            </View>
          </Card>
        ) : null}

        {isReportManager ? (
          <Card className="mb-4">
            <View className="mb-2 flex-row items-center gap-2">
              <UserPlus color={dashboardColors.teal} size={18} />
              <Text
                className="text-[15px] font-semibold text-ink"
                style={{ letterSpacing: -0.3 }}
              >
                {t('reports.detail.inviteTitle')}
              </Text>
            </View>
            <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('reports.detail.inviteBody')}
            </Text>
            <TextField
              label={t('reports.detail.inviteReasonLabel')}
              value={inviteReason}
              onChangeText={(text) => {
                setInviteReason(text);
                if (inviteError) setInviteError(null);
              }}
              placeholder={t('reports.detail.inviteReasonPlaceholder')}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!inviting}
              maxLength={1000}
            />
            {inviteError ? (
              <Text className="mb-2 text-[10px] leading-[1.7] text-tone-danger">
                {inviteError}
              </Text>
            ) : null}
            {inviteSent ? (
              <View className="mb-3">
                <Text
                  className="text-[11px] font-medium"
                  style={{ color: dashboardColors.statMintDeep }}
                >
                  {t('reports.detail.inviteCreated', {
                    count: inviteSent.created,
                    page: inviteSent.page + 1,
                  })}
                </Text>
                <Text className="mt-0.5 text-[10px] leading-[1.7] text-dashboard-caption">
                  {inviteSent.hasNext
                    ? t('reports.detail.inviteMoreBatches')
                    : t('reports.detail.inviteNoMoreBatches')}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-2">
              <Button
                label={
                  inviting
                    ? t('reports.detail.inviteSending')
                    : inviteSent?.hasNext
                      ? t('reports.detail.inviteNextBatch')
                      : t('reports.detail.inviteSend')
                }
                variant="secondary"
                onPress={onInviteTechnicians}
                loading={inviting}
                disabled={
                  inviting || (inviteSent !== null && !inviteSent.hasNext)
                }
                className="flex-1"
              />
              {inviteSent ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('reports.detail.inviteNewPass')}
                  disabled={inviting}
                  onPress={resetInvitePass}
                  className="h-11 items-center justify-center rounded-md px-3 active:opacity-70"
                  style={{ opacity: inviting ? 0.4 : 1 }}
                >
                  <Text className="text-[11px] font-semibold text-dashboard-subtitle">
                    {t('reports.detail.inviteNewPass')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
        ) : null}

        {report.confirmedAt !== null ? (
          <Card className="mb-4">
            <Text
              className="mb-2 text-[15px] font-semibold text-ink"
              style={{ letterSpacing: -0.3 }}
            >
              {t('reports.detail.confirmedSection')}
            </Text>
            <DefinitionRow
              label={t('reports.detail.confirmedBy')}
              value={
                report.confirmedByName ?? t('reports.detail.definition.notShared')
              }
            />
            <DefinitionRow
              label={t('reports.detail.confirmedAt')}
              value={formatDate(report.confirmedAt, true)}
            />
          </Card>
        ) : null}

        {report.reopenReason !== null ? (
          <Card className="mb-4">
            <Text
              className="mb-2 text-[15px] font-semibold text-ink"
              style={{ letterSpacing: -0.3 }}
            >
              {t('reports.detail.reopenSection')}
            </Text>
            <Text className="text-[12px] leading-[1.8] text-ink">
              {report.reopenReason}
            </Text>
          </Card>
        ) : null}

        {/* Technician two-step resolution. The technician marks the job done;
            the reporter then confirms or reopens it. */}
        {assignedToMe ? (
          <Card className="mb-4">
            <Text
              className="mb-1 text-[15px] font-semibold text-ink"
              style={{ letterSpacing: -0.3 }}
            >
              {t('reports.detail.tech.title')}
            </Text>
            <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('reports.detail.tech.body')}
            </Text>
            {canStartWork ? (
              <Button
                label={starting ? t('reports.detail.tech.starting') : t('reports.detail.tech.start')}
                variant="secondary"
                loading={starting}
                onPress={() => {
                  void onStartWork();
                }}
                className="mb-2 min-h-[44px]"
              />
            ) : null}
            {canResolveWork ? (
              <Button
                label={t('reports.detail.tech.resolve')}
                variant="cta"
                onPress={openResolveModal}
                className="min-h-[44px]"
              />
            ) : null}
            {!canStartWork && !canResolveWork ? (
              <View className="flex-row items-center gap-1.5">
                <Play color={dashboardColors.subtitle} size={12} />
                <Text className="text-[11px] leading-[1.7] text-dashboard-subtitle">
                  {t('reports.detail.tech.noAction')}
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Pending-resolution panel: the reporter (or site operations) sees
            what the technician reported and chooses confirm vs reopen. */}
        {canConfirmReopen && awaitingConfirmation ? (
          <Card className="mb-4">
            <Text
              className="mb-1 text-[15px] font-semibold text-ink"
              style={{ letterSpacing: -0.3 }}
            >
              {t('reports.detail.confirm.title')}
            </Text>
            <Text className="mb-2 text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('reports.detail.confirm.body')}
            </Text>
            <DefinitionRow
              label={t('reports.detail.confirm.technician')}
              value={
                report.assignedTechnicianId === null
                  ? t('reports.detail.definition.unassigned')
                  : technicianName(report.assignedTechnicianId)
              }
            />
            <DefinitionRow
              label={t('reports.detail.confirm.updated')}
              value={formatDate(report.updatedAt, true)}
            />
            <Text className="mb-3 mt-1 text-[10px] leading-[1.6] text-dashboard-caption">
              {t('reports.detail.confirm.guardHint')}
            </Text>
            <View className="flex-row gap-2">
              <Button
                label={t('reports.detail.confirm.button')}
                variant="cta"
                onPress={confirmWithGuard}
                loading={confirming}
                className="flex-1 min-h-[44px]"
              />
              <Button
                label={t('reports.detail.reopen.buttonLabel')}
                variant="secondary"
                onPress={openReopenModal}
                className="flex-1 min-h-[44px]"
              />
            </View>
          </Card>
        ) : null}

        {canConfirmReopen && report.status === 'confirmed' ? (
          <Card className="mb-4">
            <Text
              className="mb-1 text-[15px] font-semibold text-ink"
              style={{ letterSpacing: -0.3 }}
            >
              {t('reports.detail.reopen.buttonLabel')}
            </Text>
            <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
              {t('reports.detail.reopen.buttonBody')}
            </Text>
            <Button
              label={t('reports.detail.reopen.buttonLabel')}
              variant="secondary"
              onPress={openReopenModal}
              className="min-h-[44px]"
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

      <ModalSheet
        visible={reopenModalVisible}
        title={t('reports.detail.reopen.modalTitle')}
        onClose={() => {
          if (!reopening) setReopenModalVisible(false);
        }}
        busy={reopening}
        footer={
          <View className="flex-row gap-2">
            <Button
              label={t('reports.detail.reopen.cancel')}
              variant="secondary"
              onPress={() => setReopenModalVisible(false)}
              disabled={reopening}
            />
            <Button
              label={t('reports.detail.reopen.submit')}
              variant="cta"
              onPress={onSubmitReopen}
              loading={reopening}
              className="flex-1"
            />
          </View>
        }
      >
        <TextField
          label={t('reports.detail.reopen.reasonLabel')}
          value={reopenReason}
          onChangeText={(text) => {
            setReopenReason(text);
            if (reopenError) setReopenError(null);
          }}
          placeholder={t('reports.detail.reopen.reasonPlaceholder')}
          error={reopenError ?? undefined}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </ModalSheet>

      <ModalSheet
        visible={resolveVisible}
        title={t('reports.detail.tech.resolveModalTitle')}
        onClose={() => {
          if (!resolving) setResolveVisible(false);
        }}
        busy={resolving}
        footer={
          <View className="flex-row gap-2">
            <Button
              label={t('reports.detail.reopen.cancel')}
              variant="secondary"
              onPress={() => setResolveVisible(false)}
              disabled={resolving}
            />
            <Button
              label={t('reports.detail.tech.resolveSubmit')}
              variant="cta"
              onPress={submitResolve}
              loading={resolving}
              className="flex-1 min-h-[44px]"
            />
          </View>
        }
      >
        <Text className="mb-2 text-[12px] leading-[1.8] text-dashboard-subtitle">
          {t('reports.detail.tech.resolveModalBody')}
        </Text>
        <TextField
          label={t('reports.detail.tech.noteLabel')}
          value={resolveNote}
          onChangeText={(text) => {
            setResolveNote(text);
            if (resolveError) setResolveError(null);
          }}
          placeholder={t('reports.detail.tech.notePlaceholder')}
          error={resolveError ?? undefined}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={10000}
        />
        <Text className="mt-1 self-end text-[10px] text-dashboard-caption">
          {resolveNote.length}/10000
        </Text>
      </ModalSheet>

      <ModalSheet
        visible={urgencyVisible}
        title={t('reports.detail.triage.modalTitle')}
        onClose={() => {
          if (!urgencySaving) setUrgencyVisible(false);
        }}
        busy={urgencySaving}
        footer={
          <View className="flex-row gap-2">
            <Button
              label={t('reports.detail.reopen.cancel')}
              variant="secondary"
              onPress={() => setUrgencyVisible(false)}
              disabled={urgencySaving}
            />
            <Button
              label={t('reports.detail.triage.save')}
              variant="cta"
              onPress={() => {
                void submitUrgencyOverride();
              }}
              loading={urgencySaving}
              className="flex-1 min-h-[44px]"
            />
          </View>
        }
      >
        <Text className="mb-2 text-[12px] font-semibold text-ink">
          {t('reports.detail.triage.urgencyLabel')}
        </Text>
        <SegmentedControl
          options={urgencyOptions}
          value={urgencyDraft}
          onChange={(value) => setUrgencyDraft(value)}
          disabled={urgencySaving}
          className="mb-4"
        />
        <TextField
          label={t('reports.detail.triage.reasonLabel')}
          value={urgencyReason}
          onChangeText={(text) => {
            setUrgencyReason(text);
            if (urgencyError) setUrgencyError(null);
          }}
          placeholder={t('reports.detail.triage.reasonPlaceholder')}
          error={urgencyError ?? undefined}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          maxLength={2000}
        />
      </ModalSheet>

      <ModalSheet
        visible={editVisible}
        title={t('reports.detail.edit.modalTitle')}
        onClose={() => {
          if (!editSaving) setEditVisible(false);
        }}
        busy={editSaving}
        footer={
          <View className="flex-row gap-2">
            <Button
              label={t('reports.detail.reopen.cancel')}
              variant="secondary"
              onPress={() => setEditVisible(false)}
              disabled={editSaving}
            />
            <Button
              label={t('reports.detail.edit.save')}
              variant="cta"
              onPress={() => {
                void submitEdit();
              }}
              loading={editSaving}
              className="flex-1 min-h-[44px]"
            />
          </View>
        }
      >
        <TextField
          label={t('reports.detail.edit.descriptionLabel')}
          value={editDescription}
          onChangeText={(text) => {
            setEditDescription(text);
            if (editError) setEditError(null);
          }}
          placeholder={t('reports.detail.edit.descriptionPlaceholder')}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={10000}
        />
        <View className="h-3" />
        <TextField
          label={t('reports.detail.edit.addressLabel')}
          value={editAddress}
          onChangeText={setEditAddress}
          placeholder={t('reports.detail.edit.addressPlaceholder')}
          maxLength={512}
        />
        <View className="h-3" />
        <TextField
          label={t('reports.detail.edit.categoryLabel')}
          value={editCategory}
          onChangeText={setEditCategory}
          placeholder={t('reports.detail.edit.categoryPlaceholder')}
          maxLength={128}
        />
        <View className="h-3" />
        <TextField
          label={t('reports.detail.edit.specialtyLabel')}
          value={editSpecialty}
          onChangeText={setEditSpecialty}
          placeholder={t('reports.detail.edit.specialtyPlaceholder')}
          maxLength={128}
        />
        <Text className="mb-2 mt-4 text-[12px] font-semibold text-ink">
          {t('reports.detail.edit.urgencyLabel')}
        </Text>
        <SegmentedControl
          options={urgencyOptions}
          value={editUrgency}
          onChange={(value) => setEditUrgency(value)}
          disabled={editSaving}
          className="mb-4"
        />
        <Text className="mb-2 text-[12px] font-semibold text-ink">
          {t('reports.detail.edit.visibilityLabel')}
        </Text>
        <SegmentedControl
          options={[
            { value: 'public', label: t('reports.detail.edit.visibilityPublic') },
            { value: 'private', label: t('reports.detail.edit.visibilityPrivate') },
          ]}
          value={editVisibility}
          onChange={(value) => setEditVisibility(value)}
          disabled={editSaving}
        />
        {editError ? (
          <Text className="mt-3 text-[11px] leading-[1.6] text-tone-danger">
            {editError}
          </Text>
        ) : null}
      </ModalSheet>

      <Modal
        visible={previewPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <Pressable
          onPress={() => setPreviewPhoto(null)}
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
        >
          <Pressable
            onPress={() => setPreviewPhoto(null)}
            className="absolute right-4 top-4 z-10 h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            <X color="#fff" size={18} />
          </Pressable>
          {previewPhoto ? (
            <Image
              source={{ uri: previewPhoto }}
              className="w-full"
              style={{ resizeMode: 'contain', aspectRatio: 1 }}
            />
          ) : null}
        </Pressable>
      </Modal>
    </Screen>
  );
}

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

const VISION_TONE: Record<
  'pending' | 'processing' | 'completed' | 'failed' | 'unavailable',
  { background: string; ink: string }
> = {
  pending: {
    background: dashboardColors.statCitronSoft,
    ink: dashboardColors.statCitronDeep,
  },
  processing: {
    background: dashboardColors.statMintSoft,
    ink: dashboardColors.statMintDeep,
  },
  completed: {
    background: dashboardColors.statMintSoft,
    ink: dashboardColors.statMintDeep,
  },
  failed: {
    background: dashboardColors.statCoralSoft,
    ink: dashboardColors.statCoralDeep,
  },
  unavailable: {
    background: dashboardColors.cardLine,
    ink: dashboardColors.subtitle,
  },
};

function visionStatusBackground(
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable',
): string {
  return VISION_TONE[status].background;
}

function visionStatusInk(
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'unavailable',
): string {
  return VISION_TONE[status].ink;
}

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
