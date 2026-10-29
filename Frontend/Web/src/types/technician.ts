export type TechnicianTermsStatus = {
  technicianId: number;
  currentVersion: string | null;
  documentUrl: string | null;
  enforcementRequired: boolean;
  acceptedCurrentVersion: boolean;
  acceptances: { version: string; documentUrl: string; acceptedAt: string }[];
};
