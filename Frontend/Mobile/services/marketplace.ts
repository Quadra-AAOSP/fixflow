import { api } from '@/lib/apiClient';

export type MarketplaceApplication = {
  id: number;
  technicianId: number;
  technicianName: string;
  note: string;
  status: 'pending' | 'offered' | 'accepted' | 'declined' | 'withdrawn' | 'rejected' | 'expired' | 'cancelled';
  offerExpiresAt: string | null;
  activeCases: number;
  completedJobs: number;
  cancellations: number;
  averageRating: number | null;
  reviewedTrades?: string | null;
  reviewedQualifications?: string | null;
};

export type MarketplaceListing = {
  applications?: MarketplaceApplication[];
  id: number;
  summary: string;
  broadLocation: string;
  timing: string;
  category: string;
  specialty: string | null;
  amountMinor: number;
  currency: string;
  urgency: string;
  status: 'open' | 'offered' | 'assigned' | 'closed' | 'expired';
  canCancelAssignment: boolean;
  expiresAt: string;
  reportId: number | null;
  myApplication: MarketplaceApplication | null;
};

export type ListingDraft = {
  summary: string;
  broadLocation: string;
  timing: string;
  amountMinor: number;
  currency?: string;
};

const listings = '/api/marketplace/listings';
const applications = (listingId: number) => `${listings}/${listingId}/applications`;

export const searchJobsWithAi = (query: string) => api.post<{ fallback: boolean; filters: Record<string, string | null>; listings: MarketplaceListing[] }>('/api/marketplace/search/nl', { query }, { timeoutMs: 180_000 });
export const listJobs = () => api.get<MarketplaceListing[]>(listings);
export const publishJob = (reportId: number, draft: ListingDraft) =>
  api.post<MarketplaceListing>(listings, {
    reportId,
    summary: draft.summary,
    broadLocation: draft.broadLocation,
    timing: draft.timing,
    amountMinor: draft.amountMinor,
    currency: draft.currency ?? 'USD',
  });
export const closeJob = (listingId: number) =>
  api.post<MarketplaceListing>(`${listings}/${listingId}/close`);
export const cancelJobAssignment = (listingId: number, reason: string) =>
  api.post<MarketplaceListing>(`${listings}/${listingId}/cancel-assignment`, { reason });
export const listJobApplications = (listingId: number) =>
  api.get<MarketplaceApplication[]>(applications(listingId));
export const applyForJob = (listingId: number, note: string) =>
  api.post<MarketplaceApplication>(applications(listingId), { note });
export const actOnJobApplication = (
  listingId: number,
  applicationId: number,
  action: 'select' | 'accept' | 'decline' | 'withdraw',
) => api.post<MarketplaceApplication>(
  `${applications(listingId)}/${applicationId}/${action}`,
  action === 'select' ? { safetyConfirmed: true } : undefined,
);
