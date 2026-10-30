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

export type TechnicianSummary = {
  id: number; firstName: string; lastName: string; email: string; phone: string | null;
  availabilityStatus: 'available' | 'unavailable';
  skills: { id: number; category: string; specialty: string | null; proficiency: number }[];
  contracts: { siteId: number; siteName: string; createdAt: string }[];
};
export type RankingMode = 'STANDARD' | 'AI';
export type TechnicianRanking = {
  reportId: number; requestedMode: RankingMode; methodUsed: RankingMode; fallbackReason: string | null;
  candidates: { technicianId: number; proficiency: number; specialtyMatch: boolean; activeCases: number; score: number }[];
};
