import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  AssignTechnicianPayload,
  CreateReportPayload,
  Report,
  ReportPage,
  ReportPhoto,
  ReportReporter,
  UpdateReportPayload,
  Urgency,
  VisionJob,
} from '@/types';

export function createReport(payload: CreateReportPayload): Promise<Report> {
  return api.post<Report>(endpoints.reports.list, payload);
}

/**
 * Lists reports for a given site with pagination. The backend returns a
 * `ReportPageResponse` with content, page, size, totalElements, totalPages.
 * Default page size is 20 (backend max 100).
 */
export function listReportsPage(opts: {
  siteId: number;
  page?: number;
  size?: number;
  category?: string;
}): Promise<ReportPage> {
  const params = new URLSearchParams();
  params.set('siteId', String(opts.siteId));
  if (opts.page !== undefined) params.set('page', String(opts.page));
  if (opts.size !== undefined) params.set('size', String(opts.size));
  if (opts.category) params.set('category', opts.category);
  return api.get<ReportPage>(`${endpoints.reports.list}?${params.toString()}`);
}

/**
 * Convenience wrapper that returns just the content array from the first page.
 * Used by dashboards that need a quick snapshot without pagination metadata.
 */
export async function listReports(opts: { siteId: number }): Promise<Report[]> {
  const page = await listReportsPage({ siteId: opts.siteId });
  return page.content ?? [];
}

export function getReport(id: number): Promise<Report> {
  return api.get<Report>(endpoints.reports.byId(id));
}

/**
 * Idempotent join. The backend short-circuits on existing membership
 * (`existsByReportIdAndUserId`), so callers do not need a separate
 * "already joined" detection step.
 */
export function joinReport(id: number): Promise<Report> {
  return api.post<Report>(endpoints.reports.join(id));
}

export function listReporters(id: number): Promise<ReportReporter[]> {
  return api.get<ReportReporter[]>(endpoints.reports.reporters(id));
}

export function assignTechnician(
  id: number,
  payload: AssignTechnicianPayload,
): Promise<Report> {
  return api.post<Report>(endpoints.reports.assign(id), payload);
}

/**
 * Technician self-assignment for an unassigned queue item. The backend
 * requires an active contract at the report's site and accepted terms.
 */
export function claimReport(id: number): Promise<Report> {
  return api.post<Report>(endpoints.reports.claim(id));
}

/** Assigned technician starts work (assigned/reopened → in_progress). */
export function startReport(id: number): Promise<Report> {
  return api.post<Report>(endpoints.reports.start(id));
}

/**
 * Two-step resolution, step 1: the assigned technician marks the work complete.
 * The report moves to `resolved_pending_confirmation` and the reporter must
 * confirm or reopen it.
 */
export function resolveReport(id: number, description: string): Promise<Report> {
  return api.post<Report>(endpoints.reports.resolve(id), { description });
}

/** Staff/admin final-urgency override with a required rationale. */
export function overrideUrgency(
  id: number,
  urgency: Urgency,
  reason: string,
): Promise<Report> {
  return api.patch<Report>(endpoints.reports.urgency(id), { urgency, reason });
}

/** Reporter/ops edit of a still-editable report. */
export function updateReport(
  id: number,
  payload: UpdateReportPayload,
): Promise<Report> {
  return api.patch<Report>(endpoints.reports.update(id), payload);
}

export function confirmReport(id: number): Promise<Report> {
  return api.post<Report>(
    endpoints.reports.confirm.replace('{id}', String(id)),
  );
}

export function reopenReport(id: number, reason: string): Promise<Report> {
  return api.post<Report>(
    endpoints.reports.reopen.replace('{id}', String(id)),
    { reason },
  );
}

/**
 * Triggers AI classification for a report.
 */
export function classifyReport(id: number): Promise<Report> {
  return api.post<Report>(endpoints.reports.classify(id));
}

/**
 * Triggers AI vision processing for a report.
 */
export function triggerVisionProcessing(reportId: number): Promise<VisionJob> {
  return api.post<VisionJob>(endpoints.reports.vision(reportId));
}

/**
 * Gets the status of a vision processing job.
 */
export function getVisionJobStatus(reportId: number, jobId: string): Promise<VisionJob> {
  return api.get<VisionJob>(endpoints.reports.visionJob(reportId, jobId));
}

/**
 * Fetches photos for a report.
 */
export function getReportPhotos(reportId: number): Promise<ReportPhoto[]> {
  return api.get<ReportPhoto[]>(
    endpoints.reports.photos.list.replace('{id}', String(reportId)),
  );
}

/*
 * Backend contract notes (verified against the controllers):
 *
 *   POST   /api/reports/{id}/start          → in_progress (assigned tech)
 *   POST   /api/reports/{id}/resolve        → resolved_pending_confirmation
 *   POST   /api/reports/{id}/confirm        → confirmed (reporter/participant)
 *   POST   /api/reports/{id}/reopen         → reopened (reporter/participant)
 *   PATCH  /api/reports/{id}/urgency        → final urgency override (staff/admin)
 *   PATCH  /api/reports/{id}                → field edit while `editable`
 *   POST   /api/reports/{id}/assign         → assign or reassign (staff/admin)
 *   POST   /api/reports/{id}/claim          → contracted technician self-claim
 *   GET/PUT /api/technicians/me/availability
 *
 * Still NOT implemented by the backend, so no screen may depend on them:
 *   PATCH /api/reports/{id}/status, POST /api/reports/{id}/reassign
 *   GET /api/reports/assigned-to-me, GET /api/reports/claimable
 *
 * Server-side concurrency: workflow transitions load the report with a
 * pessimistic write lock, so simultaneous confirm/reopen/assign/claim calls
 * cannot both commit.
 */