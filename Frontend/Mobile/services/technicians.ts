import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  RankingMode,
  TechnicianPoolMember,
  TechnicianSummary,
} from '@/types';

/**
 * Lists technicians visible to the caller. Used by the technician directory
 * (staff / admin / super_admin).
 */
export function listTechnicians(): Promise<TechnicianSummary[]> {
  return api.get<TechnicianSummary[]>(endpoints.technicians.list);
}

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
  getTechnicianTermsFor,
  inviteTechniciansToReport,
  listApplicableSites,
  listTechnicianContractRequests as getTechnicianContractRequests,
  listTechnicianContracts as getTechnicianContracts,
  listTechnicianInvitations as getTechnicianInvitations,
  rankTechniciansForReport,
} from './technician';
export { listTechnicianContracts } from './technician';
export { listTechnicianContractRequests } from './technician';

/**
 * Alias used by screens written against the older name.
 */
export { listTechnicianInvitations } from './technician';

/** Alias kept for screens that import the singular ranking name. */
export { rankTechniciansForReport as rankTechnicianForReport } from './technician';

/** Fetches the eligible contracted technician pool for a site. */
export function listTechnicianPool(
  siteId: number,
): Promise<TechnicianPoolMember[]> {
  return api.get<TechnicianPoolMember[]>(endpoints.sites.technicianPool(siteId));
}

/** Resolves a rank mode for callers that need a typed helper. */
export type TechnicianRankingMode = RankingMode;
