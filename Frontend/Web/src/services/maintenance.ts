import { request } from './api';
import type { CreateReportPayload, Report, ReportReporter, Site, SiteRule, SiteType, SitePayload, Subsite, SubsitePayload } from '@/types/maintenance';

export const listSites = () => request<Site[]>('/api/sites');
export const listRules = (type: SiteType) => request<SiteRule[]>(`/api/site-rules?siteType=${encodeURIComponent(type)}`);
export const listReports = async (siteId: number) => {
  const page = await request<{ content: Report[] }>(`/api/reports?siteId=${siteId}`);
  return page.content ?? [];
};
export const getReport = (id: number) => request<Report>(`/api/reports/${id}`);
export const createReport = (payload: CreateReportPayload) => request<Report>('/api/reports', { method: 'POST', body: JSON.stringify(payload) });
export const joinReport = (id: number) => request<Report>(`/api/reports/${id}/join`, { method: 'POST' });
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
