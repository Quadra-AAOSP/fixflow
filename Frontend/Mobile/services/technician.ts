import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  ContractDecisionPayload,
  RankingMode,
  TechnicianAvailabilityResponse,
  TechnicianContract,
  TechnicianContractPayload,
  TechnicianContractRequest,
  TechnicianContractRequestPayload,
  TechnicianInvitationInbox,
  TechnicianInvitationsSent,
  TechnicianRanking,
  TechnicianSkill,
  TechnicianSkillPayload,
  TechnicianTermsStatus,
} from '@/types';

/** Max lengths enforced by the backend (`TechnicianSkillRequest` validation). */
export const SKILL_CATEGORY_MAX_LENGTH = 128;
export const SKILL_SPECIALTY_MAX_LENGTH = 128;
export const SKILL_PROFICIENCY_MIN = 1;
export const SKILL_PROFICIENCY_MAX = 5;

/** Declares a trade skill on a technician's profile. */
export function addTechnicianSkill(
  payload: TechnicianSkillPayload,
): Promise<TechnicianSkill> {
  return api.post<TechnicianSkill>(endpoints.technicianSkills.create, payload);
}

/**
 * Records an agreed technician ↔ site contract. Only meaningful once the
 * technician has consented; used by managers from the Contracts screen.
 */
export function createTechnicianContract(
  payload: TechnicianContractPayload,
): Promise<TechnicianContract> {
  return api.post<TechnicianContract>(
    endpoints.technicianContracts.create,
    payload,
  );
}

/**
 * Lists the technician contracts the caller is authorized to see. Admins see
 * contracts for their site; technicians see their own.
 */
export function listTechnicianContracts(): Promise<TechnicianContract[]> {
  return api.get<TechnicianContract[]>(endpoints.technicianContracts.list);
}

/** Removes an authorized technician contract. */
export function deleteTechnicianContract(id: number): Promise<void> {
  return api.del<void>(endpoints.technicianContracts.byId(id));
}

/** A technician asks to be contracted at a site. */
export function createTechnicianContractRequest(
  payload: TechnicianContractRequestPayload,
): Promise<TechnicianContractRequest> {
  return api.post<TechnicianContractRequest>(
    endpoints.contractRequests.create,
    payload,
  );
}

/**
 * Lists contract requests. Passing `siteId` scopes the list to one site
 * (the admin review queue); omitting it returns the caller's own requests.
 */
export function listTechnicianContractRequests(
  siteId?: number,
): Promise<TechnicianContractRequest[]> {
  return api.get<TechnicianContractRequest[]>(
    siteId === undefined
      ? endpoints.contractRequests.list
      : endpoints.contractRequests.bySite(siteId),
  );
}

/** Approve or reject a pending contract request (`admin` / `super_admin`). */
export function decideTechnicianContractRequest(
  id: number,
  decision: ContractDecisionPayload,
): Promise<TechnicianContractRequest> {
  return api.post<TechnicianContractRequest>(
    endpoints.contractRequests.decide(id),
    decision,
  );
}

/** The signed-in technician's current terms status. */
export function getTechnicianTerms(): Promise<TechnicianTermsStatus> {
  return api.get<TechnicianTermsStatus>(endpoints.technicianTerms.me);
}

/** Authorized admin lookup of another technician's terms status. */
export function getTechnicianTermsFor(
  technicianId: number,
): Promise<TechnicianTermsStatus> {
  return api.get<TechnicianTermsStatus>(
    endpoints.technicianTerms.byTechnician(technicianId),
  );
}

/**
 * Accepts the current terms version. The backend requires the exact version
 * being accepted so a stale screen cannot accept a superseded document.
 */
export function acceptTechnicianTerms(
  version: string,
): Promise<TechnicianTermsStatus> {
  return api.post<TechnicianTermsStatus>(endpoints.technicianTerms.accept, {
    version,
  });
}

/** The signed-in technician's paged invitation inbox. */
export function listTechnicianInvitations(
  page = 0,
): Promise<TechnicianInvitationInbox> {
  return api.get<TechnicianInvitationInbox>(
    `${endpoints.technicianInvitations.list}?page=${page}`,
  );
}

/**
 * Admins invite matching technicians who do not yet have a contract with the
 * report's site. Each call processes the next backend batch.
 */
export function inviteTechniciansToReport(
  reportId: number,
  reason: string,
  page = 0,
): Promise<TechnicianInvitationsSent> {
  return api.post<TechnicianInvitationsSent>(
    `${endpoints.reports.technicianInvitations(reportId)}?page=${page}`,
    { reason },
  );
}

/** Ranked assignment candidates (`STANDARD`, or OpenRouter-backed `AI`). */
export function rankTechniciansForReport(
  reportId: number,
  mode: RankingMode = 'STANDARD',
): Promise<TechnicianRanking> {
  return api.post<TechnicianRanking>(
    endpoints.reports.technicianRanking(reportId),
    { mode },
  );
}

/** Server-side availability of the signed-in technician (`GET`). */
export function getMyAvailability(): Promise<TechnicianAvailabilityResponse> {
  return api.get<TechnicianAvailabilityResponse>(
    endpoints.technicians.myAvailability,
  );
}

/** Toggles whether the signed-in technician can receive assignments (`PUT`). */
export function updateMyAvailability(
  available: boolean,
): Promise<TechnicianAvailabilityResponse> {
  // Backend contract: AvailabilityRequest is `{ status }` with an
  // AvailabilityStatus enum (available | unavailable). Sending
  // `{ available }` left `status` null, so the @NotNull validation rejected
  // the PUT with 400 and the optimistic toggle rolled straight back.
  return api.put<TechnicianAvailabilityResponse>(
    endpoints.technicians.myAvailability,
    { status: available ? 'available' : 'unavailable' },
  );
}
