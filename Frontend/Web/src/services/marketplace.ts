import type { Urgency } from '@/types';
import { request } from './api';

export interface MarketplaceApplication {
  id: number;
  technicianId: number;
  technicianName: string;
  note: string;
  proposedAmountMinor: number | null;
  status: 'pending' | 'offered' | 'accepted' | 'declined' | 'withdrawn' | 'rejected' | 'expired' | 'cancelled';
  offerExpiresAt: string | null;
  activeCases: number | null;
  completedJobs: number | null;
  averageRating: number | null;
  cancellations?: number | null;
  reviewedTrades?: string | null;
  reviewedQualifications?: string | null;
}

export interface MarketplaceListing {
  id: number;
  reportId: number | null;
  summary: string;
  broadLocation: string;
  timing: string;
  category: string;
  specialty: string | null;
  amountMinor: number;
  currency: string;
  urgency: Urgency | null;
  status: 'open' | 'offered' | 'assigned' | 'closed' | 'expired';
  canCancelAssignment: boolean;
  expiresAt: string;
  myApplication: MarketplaceApplication | null;
  /** Present for site/super admins — applicants for this listing. */
  applications?: MarketplaceApplication[];
}

export interface MarketplaceDraft {
  reportId: number;
  summary: string;
  broadLocation: string;
  timing: string;
  amountMinor: number;
  currency?: string;
}

const listings = '/api/marketplace/listings';
export const listMarketplaceJobs = (signal?: AbortSignal) => request<MarketplaceListing[]>(listings, { signal });
export const publishMarketplaceJob = (draft: MarketplaceDraft) => request<MarketplaceListing>(listings, {
  method: 'POST', body: JSON.stringify(draft),
});
export const closeMarketplaceJob = (listingId: number) => request<MarketplaceListing>(`${listings}/${listingId}/close`, { method: 'POST' });
export const cancelMarketplaceAssignment = (listingId: number, reason: string) => request<MarketplaceListing>(`${listings}/${listingId}/cancel-assignment`, {
  method: 'POST', body: JSON.stringify({ reason }),
});
export const listMarketplaceApplicants = (listingId: number, signal?: AbortSignal) =>
  request<MarketplaceApplication[]>(`${listings}/${listingId}/applications`, { signal });
export const applyForMarketplaceJob = (listingId: number, note: string) =>
  request<MarketplaceApplication>(`${listings}/${listingId}/applications`, { method: 'POST', body: JSON.stringify({ note }) });
export const actOnMarketplaceApplication = (listingId: number, applicationId: number, action: 'select' | 'accept' | 'decline' | 'withdraw') =>
  request<MarketplaceApplication>(`${listings}/${listingId}/applications/${applicationId}/${action}`, {
    method: 'POST', ...(action === 'select' ? { body: JSON.stringify({ safetyConfirmed: true }) } : {}),
  });
