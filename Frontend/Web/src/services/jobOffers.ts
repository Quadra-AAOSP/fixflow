import { request } from './api';

export type JobOffer = {
  id: number;
  reportId: number;
  technicianId: number;
  technicianName: string;
  amountMinor: number;
  currency: string;
  counterAmountMinor: number | null;
  status: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export const listJobOffers = (reportId: number, signal?: AbortSignal) =>
  request<JobOffer[]>(`/api/reports/${reportId}/job-offers`, { signal });

export const createJobOffer = (
  reportId: number,
  body: { technicianId: number; amountMinor: number; currency?: string; note?: string },
) =>
  request<JobOffer>(`/api/reports/${reportId}/job-offers`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const acceptJobOffer = (reportId: number, offerId: number) =>
  request<JobOffer>(`/api/reports/${reportId}/job-offers/${offerId}/accept`, { method: 'POST' });

export const rejectJobOffer = (reportId: number, offerId: number, note?: string) =>
  request<JobOffer>(`/api/reports/${reportId}/job-offers/${offerId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });

export const counterJobOffer = (reportId: number, offerId: number, amountMinor: number, note?: string) =>
  request<JobOffer>(`/api/reports/${reportId}/job-offers/${offerId}/counter`, {
    method: 'POST',
    body: JSON.stringify({ amountMinor, note }),
  });

export const listMyJobOffers = (signal?: AbortSignal) =>
  request<JobOffer[]>('/api/technicians/me/job-offers', { signal });

export const listTechnicianHistory = (technicianId: number, signal?: AbortSignal) =>
  request(`/api/technicians/${technicianId}/history`, { signal });
