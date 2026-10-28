import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { Report, Technician, User } from '@/types';
import type { UserCapabilities } from '@/types/user';

/**
 * Checks if a user can assign a technician.
 */
export function canAssignTechnician(user: User | null | undefined): boolean {
  return user?.capabilities?.assignTechnician ?? false;
}

/**
 * Checks if a user can confirm a report.
 */
export function canConfirmReport(user: User | null | undefined): boolean {
  return user?.capabilities?.confirmReport ?? false;
}

/**
 /*
 * Checks if a user can reopen a report.
 */
export function canReopenReport(user: User | null | undefined): boolean {
  return user?.capabilities?.reopenReport ?? false;
}

// NOTE: The following endpoints are required for full functionality but may not be available yet.
// Required backend operations:
// POST /api/reports/{id}/assign
// Authorization: Staff with assignTechnician capability
// Expected behavior: Assigns a technician to a report
//
// POST /api/reports/{id}/confirm
// Authorization: Staff with confirmReport capability
// Expected behavior: Confirms a report
//
// POST /api/reports/{id}/reopen
// Authorization: Staff with reopenReport capability
// Expected behavior: Reopens a report with a reason

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