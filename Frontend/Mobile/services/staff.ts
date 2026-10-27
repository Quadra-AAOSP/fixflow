import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { Report, Technician, User } from '@/types';

/**
 * Lists reports for a given site.
 */
export function listReports(opts: { siteId: number }): Promise<Report[]> {
  return api.get<Report[]>(endpoints.reports.list, { params: { siteId: opts.siteId } });
}

/**
 * Lists technicians.
 */
export function listTechnicians(): Promise<Technician[]> {
  return api.get<Technician[]>(endpoints.technicians.list);
}

/**
 * Assigns a technician to a report.
 */
export function assignTechnicianToReport(
  reportId: number,
  technicianId: number,
): Promise<Report> {
  return api.post<Report>(endpoints.reports.assign(reportId), { technicianId });
}

/**
 * Confirms a report.
 */
export function confirmReport(reportId: number): Promise<Report> {
  return api.post<Report>(endpoints.reports.confirm(reportId));
}

/**
 * Reopens a report.
 */
export function reopenReport(reportId: number, reason: string): Promise<Report> {
  return api.post<Report>(endpoints.reports.reopen(reportId), { reason });
}