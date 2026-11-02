import type { User } from './user';

/** Status of a technician contract request */
export type TechnicianContractRequestStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'failed';

/** Decision for a technician contract request */
export type TechnicianContractRequestDecision = 
  | 'approve'
  | 'reject';

/** Technician contract request */
export type TechnicianContractRequest = {
  id: number;
  siteId: number;
  status: TechnicianContractRequestStatus;
  createdAt: string;
  updatedAt: string;
  siteName: string;
};

/** Technician contract */
export type TechnicianContract = {
  id: number;
  siteId: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  siteName: string;
};

/** Technician invitation */
export type TechnicianInvitation = {
  id: number;
  reportId: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
  reportTitle: string;
};

/** Technician pool for a site */
export type TechnicianPool = {
  siteId: number;
  technicians: User[];
};

/** Technician terms */
export type TechnicianTerm = {
  id: number;
  version: string;
  status: 'accepted' | 'pending';
  acceptedAt: string | null;
  content: string;
};

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
export type TechnicianAvailabilityResponse = {
  available: boolean;
  status?: 'available' | 'unavailable';
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
  message?: string;
};

/** Decision payload for a contract request (admin review). */
export type ContractDecisionPayload = {
  decision: TechnicianContractRequestDecision;
  note?: string;
};