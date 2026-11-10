import { request } from './api';
import type { Report } from '@/types/maintenance';
import type { Urgency } from '@/types';
export interface WorkflowHistory { id: number; fromStatus: string | null; toStatus: string; changedByUserId: number | null; note: string | null; createdAt: string }
export interface WorkflowResolution { id: number; technicianId: number; description: string; createdAt: string }
export interface WorkflowRating { id: number; resolutionId: number; score: number; feedback: string | null; createdAt: string }
export interface WorkflowLink { id: number; reportId: number; linkedReportId: number; reason: string; createdAt: string }
function id(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Choose a valid report or resolution ID.');
  return value;
}
function text(value: string, max: number) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new Error(`Enter between 1 and ${max} characters.`);
  return trimmed;
}
const path = (reportId: number, action: string) => `/api/reports/${id(reportId)}/${action}`;
const post = <T>(reportId: number, action: string, body?: unknown) => request<T>(path(reportId, action), { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
export const claimReport = (reportId: number) => post<Report>(reportId, 'claim');
export const startReport = (reportId: number) => post<Report>(reportId, 'start');
export const resolveReport = (reportId: number, description: string) => post<Report>(reportId, 'resolve', { description: text(description, 10000) });
export const escalateReport = (reportId: number, reason: string) => post<Report>(reportId, 'escalate', { reason: text(reason, 2000) });
export function overrideReportUrgency(reportId: number, urgency: Urgency, reason: string) {
  if (!['low', 'medium', 'high', 'critical'].includes(urgency)) throw new Error('Choose a valid urgency.');
  return request<Report>(path(reportId, 'urgency'), { method: 'PATCH', body: JSON.stringify({ urgency, reason: text(reason, 2000) }) });
}
export const listWorkflowHistory = (reportId: number) => request<WorkflowHistory[]>(path(reportId, 'history'));
export const listWorkflowResolutions = (reportId: number) => request<WorkflowResolution[]>(path(reportId, 'resolutions'));
export const listWorkflowRatings = (reportId: number) => request<WorkflowRating[]>(path(reportId, 'ratings'));
export const listWorkflowLinks = (reportId: number) => request<WorkflowLink[]>(path(reportId, 'links'));
export function rateReportResolution(reportId: number, resolutionId: number, score: number, feedback: string) {
  id(resolutionId);
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error('Choose a score between 1 and 5.');
  if (feedback.length > 2000) throw new Error('Feedback must be at most 2,000 characters.');
  return post<WorkflowRating>(reportId, 'ratings', { resolutionId, score, feedback: feedback.trim() || null });
}
export function linkReports(reportId: number, linkedReportId: number, reason: string) {
  id(linkedReportId);
  if (reportId === linkedReportId) throw new Error('A report cannot link to itself.');
  return post<WorkflowLink>(reportId, 'links', { linkedReportId, reason: text(reason, 2000) });
}
