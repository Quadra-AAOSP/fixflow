import type { Report } from '@/types/maintenance';
import { request } from './api';

export interface ReportResolution {
  id: number;
  technicianId: number;
  description: string;
  createdAt: string;
}

export interface ReportRating {
  id: number;
  resolutionId: number;
  score: number;
  feedback: string | null;
  createdAt: string;
  ratedByCurrentUser?: boolean;
}

const path = (reportId: number, action: string) => `/api/reports/${reportId}/${action}`;
export const startWork = (reportId: number) => request<Report>(path(reportId, 'start'), { method: 'POST' });
export const resolveWork = (reportId: number, description: string) => request<Report>(path(reportId, 'resolve'), {
  method: 'POST', body: JSON.stringify({ description }),
});
export const escalateWork = (reportId: number, reason: string) => request<Report>(path(reportId, 'escalate'), {
  method: 'POST', body: JSON.stringify({ reason }),
});
export const listResolutions = (reportId: number, signal: AbortSignal) => request<ReportResolution[]>(path(reportId, 'resolutions'), { signal });
export const listRatings = (reportId: number, signal: AbortSignal) => request<ReportRating[]>(path(reportId, 'ratings'), { signal });
export const submitRating = (reportId: number, rating: { resolutionId: number; score: number; feedback: string }) =>
  request<ReportRating>(path(reportId, 'ratings'), { method: 'POST', body: JSON.stringify(rating) });
