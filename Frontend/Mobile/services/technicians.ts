import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  TechnicianContract,
  TechnicianContractRequest,
  TechnicianContractRequestDecision,
  TechnicianInvitation,
  TechnicianPool,
  TechnicianTerm,
} from '@/types';

/**
 * Fetches the technician's current contract requests.
 */
export function getTechnicianContractRequests(): Promise<TechnicianContractRequest[]> {
  return api.get<TechnicianContractRequest[]>(endpoints.technician.contractRequests);
}

/**
 * Submits a new contract request.
 */
export function createTechnicianContractRequest(
  payload: Omit<TechnicianContractRequest, 'id'>,
): Promise<TechnicianContractRequest> {
  return api.post<TechnicianContractRequest>(endpoints.technician.contractRequests, payload);
}

/**
 * Decides on a contract request (approve/reject).
 */
export function decideTechnicianContractRequest(
  id: number,
  decision: TechnicianContractRequestDecision,
): Promise<TechnicianContractRequest> {
  return api.post<TechnicianContractRequest>(
    endpoints.technician.contractRequestDecision(id),
    { decision },
  );
}

/**
 * Fetches the technician's current contracts.
 */
export function getTechnicianContracts(): Promise<TechnicianContract[]> {
  return api.get<TechnicianContract[]>(endpoints.technician.contracts);
}

/**
 * Removes a technician contract.
 */
export function deleteTechnicianContract(id: number): Promise<void> {
  return api.del<void>(endpoints.technician.contract(id));
}

/**
 * Fetches the technician's current terms.
 */
export function getTechnicianTerms(): Promise<TechnicianTerm> {
  return api.get<TechnicianTerm>(endpoints.technician.terms.me);
}

/**
 * Accepts the technician's current terms.
 */
export function acceptTechnicianTerms(): Promise<TechnicianTerm> {
  return api.post<TechnicianTerm>(endpoints.technician.terms.accept);
}

/**
 * Fetches the technician's current invitations.
 */
export function getTechnicianInvitations(): Promise<TechnicianInvitation[]> {
  return api.get<TechnicianInvitation[]>(endpoints.technician.invitations);
}

/**
 * Fetches the technician pool for a site.
 */
export function listTechnicianPool(siteId: number): Promise<TechnicianPool> {
  return api.get<TechnicianPool>(endpoints.sites.technicianPool(siteId));
}

/**
 * Ranks technicians for a report.
 */
export function rankTechniciansForReport(
  reportId: number,
  payload: { technicianIds: number[] },
): Promise<void> {
  return api.post<void>(endpoints.reports.technicianRanking(reportId), payload);
}