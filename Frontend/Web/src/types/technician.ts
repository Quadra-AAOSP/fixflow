export type TechnicianTermsStatus = {
  technicianId: number;
  currentVersion: string | null;
  documentUrl: string | null;
  enforcementRequired: boolean;
  acceptedCurrentVersion: boolean;
  acceptances: { version: string; documentUrl: string; acceptedAt: string }[];
};

export type ContractApplication = {
  id: number;
  technicianId: number;
  siteId: number;
  status: 'pending' | 'approved' | 'rejected';
  note: string | null;
  decisionReason: string | null;
  decidedByUserId: number | null;
  createdAt: string;
  decidedAt: string | null;
};
