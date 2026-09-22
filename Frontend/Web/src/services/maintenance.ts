import { request } from './api';
import type { CreateReportPayload, Report, ReportReporter, Site, SiteRule, SiteType, SitePayload } from '@/types/maintenance';

export const listSites = () => request<Site[]>('/api/sites');
export const listRules = (type: SiteType) => request<SiteRule[]>(`/api/site-rules?siteType=${encodeURIComponent(type)}`);
export const listReports = (siteId: number) => request<Report[]>(`/api/reports?siteId=${siteId}`);
export const getReport = (id: number) => request<Report>(`/api/reports/${id}`);
export const createReport = (payload: CreateReportPayload) => request<Report>('/api/reports', { method: 'POST', body: JSON.stringify(payload) });
export const joinReport = (id: number) => request<Report>(`/api/reports/${id}/join`, { method: 'POST' });
export const listReporters = (id: number) => request<ReportReporter[]>(`/api/reports/${id}/reporters`);
export const assignTechnician = (id: number, technicianId: number) => request<Report>(`/api/reports/${id}/assign`, { method: 'POST', body: JSON.stringify({ technicianId }) });

export const createSite = (payload: SitePayload) => request<Site>('/api/sites', { method: 'POST', body: JSON.stringify(payload) });
export const updateSite = (id: number, payload: SitePayload) => request<Site>(`/api/sites/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
