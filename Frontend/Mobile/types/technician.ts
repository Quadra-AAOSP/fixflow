import type { User } from './user';

/** Status of a technician contract request (`ContractApplicationResponse`). */
export type TechnicianContractRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected';

/** Decision for a technician contract request */
export type TechnicianContractRequestDecision = 'approve' | 'reject';

/**
 * Technician contract request, matching `ContractApplicationResponse`.
 * `siteName` is not returned by the backend — resolve it from `sites`.
 */
export type TechnicianContractRequest = {
  id: number;
  technicianId: number;
  siteId: number;
  status: TechnicianContractRequestStatus;
  note: string | null;
  decisionReason: string | null;
  decidedByUserId: number | null;
  siteFlatFeeMinor: number | null;
  siteFeeCurrency: string;
  createdAt: string;
  decidedAt: string | null;
};

/** Technician contract, matching `TechnicianContractResponse`. */
export type TechnicianContract = {
  id: number;
  technicianId: number;
  siteId: number;
  flatFeeMinor: number;
  feeCurrency: string;
  createdAt: string;
  /** Site name, so technicians (who have no account site) can label jobs. */
  siteName: string;
};

/** Ranking strategy for `POST /api/reports/{id}/technician-ranking`. */
export type RankingMode = 'STANDARD' | 'AI';

export type TechnicianRankingCandidate = {
  technicianId: number;
  proficiency: number;
  specialtyMatch: boolean;
  activeCases: number;
  score: number;
};

/** `TechnicianRankingService.Result` — AI mode may fall back to STANDARD. */
export type TechnicianRanking = {
  reportId: number;
  requestedMode: RankingMode;
  methodUsed: RankingMode;
  fallbackReason: string | null;
  candidates: TechnicianRankingCandidate[];
};

/** Eligible site technician pool member (`TechnicianPoolMemberResponse`). */
export type TechnicianPoolMember = {
  technicianId: number;
  firstName: string;
  lastName: string;
  email: string;
  availability: 'available' | 'unavailable';
  contracted: boolean;
};

export type TechnicianPool = TechnicianPoolMember[];

export type TechnicianTermsAcceptance = {
  version: string;
  documentUrl: string;
  acceptedAt: string;
};

/** `GET /api/technician-terms/me` and `/{technicianId}`. */
export type TechnicianTermsStatus = {
  technicianId: number;
  currentVersion: string | null;
  documentUrl: string | null;
  enforcementRequired: boolean;
  acceptedCurrentVersion: boolean;
  acceptances: TechnicianTermsAcceptance[];
};

/** Alias kept for screens written against the older name. */
export type TechnicianTerm = TechnicianTermsStatus;

/** A trade skill declared on a technician's profile. */
export type TechnicianSkill = {
  id: number;
  technicianId: number;
  category: string;
  specialty: string | null;
  proficiency: number;
};

export type TechnicianSkillPayload = {
  technicianId?: number;
  category: string;
  specialty?: string;
  proficiency: number;
};

/** Payload for creating a technician ↔ site contract. */
export type TechnicianContractPayload = {
  siteId: number;
  technicianId: number;
};

/** The signed-in technician's availability status. */
/** Mirrors the backend AvailabilityResponse record. */
export type TechnicianAvailabilityResponse = {
  technicianId: number;
  status: 'available' | 'unavailable';
  updatedAt: string | null;
};

export type TechnicianAvailability = 'available' | 'unavailable';

/** A contract row rendered on the technician directory card. */
export type TechnicianContractSummary = {
  siteId: number;
  siteName: string;
  createdAt: string;
};

/** Directory entry returned by `GET /api/technicians`. */
export type TechnicianSummary = User & {
  availabilityStatus: TechnicianAvailability;
  skills: TechnicianSkill[];
  contracts: TechnicianContractSummary[];
};

/** Alias used by screens written against the older name. */
export type Technician = TechnicianSummary;

/** A technician's request to be contracted at a site. */
export type TechnicianContractRequestPayload = {
  siteId: number;
  note?: string;
};

/** Decision payload for a contract request (admin review). */
export type ContractDecisionPayload = {
  decision: TechnicianContractRequestDecision;
  reason?: string;
};
