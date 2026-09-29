import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  AssignTechnicianPayload,
  CreateReportPayload,
  Report,
  ReportReporter,
} from '@/types';

export function createReport(payload: CreateReportPayload): Promise<Report> {
  return api.post<Report>(endpoints.reports.list, payload);
}

/**
 * Lists reports for a given site. The caller must belong to that site
 * (or be super_admin); the backend returns 403 otherwise
 * (`ReportService.resolveSiteForList`).
 */
export function listReports(opts: { siteId: number }): Promise<Report[]> {
  return api.get<Report[]>(
    `${endpoints.reports.list}?siteId=${encodeURIComponent(opts.siteId)}`,
  );
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

/*
 * Endpoints NOT exposed here yet — backend audit dependencies #1, #2, #4, #6:
 *
 *   POST   /api/reports/{id}/photos
 *   DELETE /api/reports/{id}/photos/{photoId}
 *   PATCH  /api/reports/{id}/status
 *   POST   /api/reports/{id}/confirm
 *   POST   /api/reports/{id}/reopen
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