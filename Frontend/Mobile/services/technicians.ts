import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  TechnicianContract,
  TechnicianInvitation,
  TechnicianPool,
  TechnicianSummary,
  User,
} from '@/types';

/**
 * Lists technicians visible to the caller. Used by the technician directory
 * (staff / admin / super_admin).
 */
export function listTechnicians(): Promise<TechnicianSummary[]> {
  return api.get<TechnicianSummary[]>(endpoints.technicians.list);
}

/**
 * Fetches the technician's current invitations (reports they've been
 * invited to join).
 */
export function listTechnicianInvitations(): Promise<TechnicianInvitation[]> {
  return api.get<TechnicianInvitation[]>(endpoints.technicianInvitations.list);
}

/**
 * Fetches the technician's current contracts. Re-exported here for screens
 * that import from the technicians service; the canonical implementation
 * lives in `services/technician`.
 */
export { listTechnicianContracts } from './technician';

/**
 * Backwards-compatible aliases. Screens written against older service names
 * import these from `services/technicians`; the canonical definitions live in
 * `services/technician`.
 */
export {
  acceptTechnicianTerms,
  createTechnicianContractRequest,
  decideTechnicianContractRequest,
  getTechnicianTerms,
} from './technician';
export { listTechnicianContractRequests as getTechnicianContractRequests } from './technician';
export { listTechnicianContracts as getTechnicianContracts } from './technician';

/**
 * Fetches the eligible contracted technician pool for a site.
 */
export function listTechnicianPool(siteId: number): Promise<TechnicianPool> {
  return api.get<TechnicianPool>(endpoints.sites.technicianPool(siteId));
}

/**
 * Ranks technicians for a report (returns ranked candidates and active-case
 * counts).
 */
export function rankTechniciansForReport(
  reportId: number,
): Promise<unknown> {
  return api.post<unknown>(endpoints.reports.technicianRanking(reportId), {});
}

/** Alias used by some screens. */
export const rankTechnicianForReport = rankTechniciansForReport;

/** Alias used by screens written against the older name. */
export const getTechnicianInvitations = listTechnicianInvitations;
