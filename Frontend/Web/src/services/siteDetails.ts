import { request } from './api';
import type { Site, SiteRule } from '@/types/maintenance';
export interface ReportingSetup { siteId: number; reportingReady: boolean; activeSubsiteCount: number }
export interface SiteTechnician {
  technicianId: number; firstName: string; lastName: string; email: string;
  availability: 'available' | 'busy' | 'unavailable'; contracted: boolean;
}
function path(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Choose a valid site.');
  return `/api/sites/${id}`;
}
export const getSite = (id: number) => request<Site>(path(id));
export const getSiteTaxonomy = (id: number) => request<SiteRule[]>(`${path(id)}/taxonomy`);
export const getReportingSetup = (id: number) => request<ReportingSetup>(`${path(id)}/reporting-setup`);
export const getSiteTechnicians = (id: number) => request<SiteTechnician[]>(`${path(id)}/technician-pool`);
export const deleteSite = (id: number) => request<void>(path(id), { method: 'DELETE' });
