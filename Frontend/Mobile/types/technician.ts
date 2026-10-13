/**
 * Technician domain types. Each mirrors a backend DTO one-to-one — see
 * `TechnicianSkillController`, `TechnicianContractController` and
 * `ContractApplicationController`.
 */

/** Mirrors backend `TechnicianSkillResponse`. */
export type TechnicianSkill = {
  id: number;
  technicianId: number;
  category: string;
  specialty: string;
  /** 1–5; validated server-side (`TechnicianSkillRequest`). */
  proficiency: number;
};

/** Mirrors backend `TechnicianSkillRequest`. */
export type TechnicianSkillPayload = {
  technicianId: number;
  category: string;
  specialty: string;
  proficiency: number;
};

/** Mirrors backend `TechnicianContractResponse`. */
export type TechnicianContract = {
  id: number;
  technicianId: number;
  siteId: number;
  createdAt: string;
};

/** Mirrors backend `TechnicianContractRequest`. */
export type TechnicianContractPayload = {
  technicianId: number;
  siteId: number;
};

/** Mirrors backend `TechnicianContractApplication.Status`. */
export type ContractApplicationStatus = 'pending' | 'approved' | 'rejected';

/**
 * Mirrors backend `ContractApplicationResponse`. A technician requests
 * contract work at a site; an admin approves or rejects it.
 */
export type ContractApplication = {
  id: number;
  technicianId: number;
  siteId: number;
  status: ContractApplicationStatus;
  note: string | null;
  decisionReason: string | null;
  decidedByUserId: number | null;
  createdAt: string;
  decidedAt: string | null;
};

/** Mirrors backend `ContractApplicationRequest`. */
export type ContractApplicationPayload = {
  siteId: number;
  note?: string;
};

/** Mirrors backend `ContractDecisionRequest.Decision`. */
export type ContractDecision = 'approve' | 'reject';

/** Mirrors backend `ContractDecisionRequest`. */
export type ContractDecisionPayload = {
  decision: ContractDecision;
  reason?: string;
};
