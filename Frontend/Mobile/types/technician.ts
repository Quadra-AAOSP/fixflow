import type { Report, Site, User } from './user';

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