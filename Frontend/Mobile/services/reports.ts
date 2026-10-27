import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  AssignTechnicianPayload,
  CreateReportPayload,
  Report,
  ReportPage,
  ReportReporter,
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

/*
 * Endpoints NOT exposed here yet — backend audit dependencies #1, #2, #4, #6:
 *
 *   PATCH  /api/reports/{id}/status
 *   PATCH  /api/reports/{id}/urgency
 *   POST   /api/reports/{id}/reassign
 *   GET    /api/technicians/me/availability
 *   PUT    /api/technicians/me/availability
 *   GET    /api/reports/assigned-to-me
 *   GET    /api/reports/claimable
 *   GET    /api/technicians
 *   GET    /api/technician-skills
 *   GET    /api/technician-contracts
 *
 * Each is added to this file only after the backend lands and the
 * backend team confirms the request/response shape.
 */