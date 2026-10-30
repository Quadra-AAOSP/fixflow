import { request } from './api';
import { REPORT_PHOTO_LIMIT, validateReportPhoto } from './reportPhotos';
import type { CreateReportPayload, Report, ReportReporter, Site, SiteRule, SiteType, SitePayload, Subsite, SubsitePayload, SubsiteAlert } from '@/types/maintenance';

export const listSites = () => request<Site[]>('/api/sites');
export const listRules = (type: SiteType) => request<SiteRule[]>(`/api/site-rules?siteType=${encodeURIComponent(type)}`);
export const listReports = async (siteId: number) => {
  const page = await request<{ content: Report[] }>(`/api/reports?siteId=${siteId}`);
  return page.content ?? [];
};
export const getReport = (id: number) => request<Report>(`/api/reports/${id}`);
export const classifyReport = (id: number) => request<Report>(`/api/reports/${id}/classify`, { method: 'POST' });
export const createReport = (payload: CreateReportPayload) => request<Report>('/api/reports', { method: 'POST', body: JSON.stringify(payload) });
export function createReportWithPhotos(payload: CreateReportPayload, photos: File[]) {
  if (photos.length > REPORT_PHOTO_LIMIT) throw new Error('A report may have at most 5 photos.');
  photos.forEach(validateReportPhoto);
  const body = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value != null) body.append(key, String(value));
  }
  photos.forEach(photo => body.append('photos', photo));
  return request<Report>('/api/reports', { method: 'POST', body });
}
export const joinReport = (id: number) => request<Report>(`/api/reports/${id}/join`, { method: 'POST' });
export const confirmReport = (id: number) => request<Report>(`/api/reports/${id}/confirm`, { method: 'POST' });
export function reopenReport(id: number, reason: string) {
  const message = reason.trim();
  if (!message || message.length > 500) throw new Error('Enter a reopen reason of 1–500 characters.');
  return request<Report>(`/api/reports/${id}/reopen`, { method: 'POST', body: JSON.stringify({ reason: message }) });
}
export const listReporters = (id: number) => request<ReportReporter[]>(`/api/reports/${id}/reporters`);
export const assignTechnician = (id: number, technicianId: number) => request<Report>(`/api/reports/${id}/assign`, { method: 'POST', body: JSON.stringify({ technicianId }) });

export const createSite = (payload: SitePayload) => request<Site>('/api/sites', { method: 'POST', body: JSON.stringify(payload) });
export const updateSite = (id: number, payload: SitePayload) => request<Site>(`/api/sites/${id}`, { method: 'PUT', body: JSON.stringify(payload) });

function subsitePath(siteId: number) {
  if (!Number.isSafeInteger(siteId) || siteId <= 0) throw new Error('Choose a valid site.');
  return `/api/sites/${siteId}/subsites`;
}
export const listSubsites = (siteId: number) => request<Subsite[]>(subsitePath(siteId));
export function createSubsite(siteId: number, value: SubsitePayload) {
  const label = value.label.trim().toUpperCase();
  const name = value.name.trim();
  const description = value.description?.trim() || null;
  if (!label || label.length > 64) throw new Error('Enter a building label of up to 64 characters.');
  if (!name || name.length > 255) throw new Error('Enter a building name of up to 255 characters.');
  if (description && description.length > 2000) throw new Error('Keep the description under 2,000 characters.');
  return request<Subsite>(subsitePath(siteId), {
    method: 'POST', body: JSON.stringify({ label, name, description }),
  });
}
export function updateSubsite(siteId: number, subsiteId: number, value: SubsitePayload) {
  if (!Number.isSafeInteger(subsiteId) || subsiteId <= 0) throw new Error('Choose a valid building.');
  const label = value.label.trim().toUpperCase();
  const name = value.name.trim();
  const description = value.description?.trim() || null;
  if (!label || label.length > 64 || !name || name.length > 255 || (description?.length ?? 0) > 2000) {
    throw new Error('Enter a valid label, name and description.');
  }
  return request<Subsite>(`${subsitePath(siteId)}/${subsiteId}`, {
    method: 'PUT', body: JSON.stringify({ label, name, description }),
  });
}
export function archiveSubsite(siteId: number, subsiteId: number) {
  if (!Number.isSafeInteger(subsiteId) || subsiteId <= 0) throw new Error('Choose a valid building.');
  return request<Subsite>(`${subsitePath(siteId)}/${subsiteId}/archive`, { method: 'POST' });
}
export function listPendingSubsiteRequests(siteId: number) {
  if (!Number.isSafeInteger(siteId) || siteId <= 0) throw new Error('Choose a valid site.');
  return request<SubsiteAlert[]>(`/api/sites/${siteId}/subsite-requests`);
}
export function resolveSubsiteRequest(siteId: number, requestId: number) {
  if (!Number.isSafeInteger(siteId) || siteId <= 0 || !Number.isSafeInteger(requestId) || requestId <= 0) {
    throw new Error('Choose a valid site and request.');
  }
  return request<SubsiteAlert>(`/api/sites/${siteId}/subsite-requests/${requestId}/resolve`, { method: 'POST' });
}
export function requestSubsiteAddition(siteId: number, note: string) {
  if (!Number.isSafeInteger(siteId) || siteId <= 0) throw new Error('Choose a valid site.');
  const trimmed = note.trim();
  if (!trimmed || trimmed.length > 1000) throw new Error('Describe the missing building in 1–1,000 characters.');
  return request<{ id: number; siteId: number; status: string }>(`/api/sites/${siteId}/subsite-requests`, {
    method: 'POST', body: JSON.stringify({ note: trimmed }),
  });
}
