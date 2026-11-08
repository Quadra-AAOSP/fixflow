import type { Report, ReportStatus } from '@/types';

/**
 * Statuses a technician may (re)start work from. Mirrors
 * `ReportWorkflowService.start`; `resolve` is deliberately narrower.
 */
const STARTABLE: ReportStatus[] = ['assigned', 'reopened', 'escalated'];

/** Statuses an edit is still allowed in (mirrors `ReportService.update`). */
const EDITABLE: ReportStatus[] = ['open', 'routed', 'reopened', 'escalated'];

export function isAssignedToMe(
  report: Report,
  userId: number | null | undefined,
): boolean {
  return userId != null && report.assignedTechnicianId === userId;
}

export function canTechnicianStart(
  report: Report,
  userId: number | null | undefined,
): boolean {
  return isAssignedToMe(report, userId) && STARTABLE.includes(report.status);
}

export function canTechnicianResolve(
  report: Report,
  userId: number | null | undefined,
): boolean {
  return isAssignedToMe(report, userId) && report.status === 'in_progress';
}

export function canReporterConfirm(report: Report): boolean {
  return (
    report.status === 'resolved_pending_confirmation' &&
    (report.policy.participant || report.policy.canAssign)
  );
}

export function canReporterReopen(report: Report): boolean {
  return (
    (report.policy.participant || report.policy.canAssign) &&
    (report.status === 'confirmed' ||
      report.status === 'resolved_pending_confirmation')
  );
}

/**
 * Editing is creator-only (or site operations), matching the backend gate —
 * a joined participant may confirm/reopen but not rewrite someone else's text.
 */
export function canEditReport(
  report: Report,
  userId: number | null | undefined,
): boolean {
  if (!report.editable || !EDITABLE.includes(report.status)) return false;
  if (report.policy.canAssign) return true;
  return report.policy.participant && report.createdByUserId === userId;
}
