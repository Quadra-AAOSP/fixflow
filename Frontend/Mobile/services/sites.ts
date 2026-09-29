import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { Site } from '@/types';

/**
 * Lists the sites visible to the caller. Backend returns only their own
 * site for non-super_admin actors, and all sites for super_admin
 * (see `SiteService.list`).
 *
 * Public site directory (`GET /api/sites` pre-login) is NOT exposed here —
 * the endpoint does not exist on the backend yet (audit dependency #5).
 */
export function listSites(): Promise<Site[]> {
  return api.get<Site[]>(endpoints.sites.list);
}

export function getSite(id: number): Promise<Site> {
  return api.get<Site>(endpoints.sites.byId(id));
}