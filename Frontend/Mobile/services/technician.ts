import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  ContractApplication,
  ContractApplicationPayload,
  ContractDecisionPayload,
  TechnicianContract,
  TechnicianContractPayload,
  TechnicianSkill,
  TechnicianSkillPayload,
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

/** A technician asks to be contracted at a site. */
export function applyForContract(
  payload: ContractApplicationPayload,
): Promise<ContractApplication> {
  return api.post<ContractApplication>(
    endpoints.contractRequests.create,
    payload,
  );
}

/**
 * Lists contract applications. Passing `siteId` scopes the list to one site,
 * which is how the admin review queue is built; omitting it returns every
 * application the caller may see.
 */
export function listContractApplications(
  siteId?: number,
): Promise<ContractApplication[]> {
  return api.get<ContractApplication[]>(
    siteId === undefined
      ? endpoints.contractRequests.list
      : endpoints.contractRequests.bySite(siteId),
  );
}

/** Approve or reject a pending application (`admin` / `super_admin`). */
export function decideContractApplication(
  id: number,
  payload: ContractDecisionPayload,
): Promise<ContractApplication> {
  return api.post<ContractApplication>(
    endpoints.contractRequests.decide(id),
    payload,
  );
}
