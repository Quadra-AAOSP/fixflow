import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';

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

export type CreateJobOfferBody = {
  technicianId: number;
  amountMinor: number;
  currency?: string;
  note?: string;
};

export const listJobOffers = (reportId: number) =>
  api.get<JobOffer[]>(endpoints.jobOffers.forReport(reportId));

export const createJobOffer = (reportId: number, body: CreateJobOfferBody) =>
  api.post<JobOffer>(endpoints.jobOffers.forReport(reportId), {
    technicianId: body.technicianId,
    amountMinor: body.amountMinor,
    currency: body.currency ?? 'USD',
    note: body.note,
  });

export const acceptJobOffer = (reportId: number, offerId: number) =>
  api.post<JobOffer>(endpoints.jobOffers.accept(reportId, offerId));

export const rejectJobOffer = (reportId: number, offerId: number, note?: string) =>
  api.post<JobOffer>(endpoints.jobOffers.reject(reportId, offerId), { note });

export const counterJobOffer = (
  reportId: number,
  offerId: number,
  amountMinor: number,
  note?: string,
) =>
  api.post<JobOffer>(endpoints.jobOffers.counter(reportId, offerId), {
    amountMinor,
    note,
  });

export const listMyJobOffers = () =>
  api.get<JobOffer[]>(endpoints.jobOffers.mine);
