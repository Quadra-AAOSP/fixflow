import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  Site,
  Subsite,
  SubsiteAlert,
  SubsitePayload,
} from '@/types';

/**
 * Lists the sites visible to the caller. Backend returns only their own
 * site for non-super_admin actors, and all sites for super_admin
 * (`SiteService.list`).
 *
 * The route is public server-side, which is what lets the Register screen
 * offer a real site picker before the user has a session.
 */
export function listSites(): Promise<Site[]> {
  return api.get<Site[]>(endpoints.sites.list);
}

export function getSite(id: number): Promise<Site> {
  return api.get<Site>(endpoints.sites.byId(id));
}

/** Mirrors backend `SiteRequest`. `type`/`contractStatus` are required. */
export type SitePayload = {
  name: string;
  type: Site['type'];
  contractStatus: Site['contractStatus'];
  address?: string;
  description?: string;
  imageUrl?: string;
};

export function createSite(payload: SitePayload): Promise<Site> {
  return api.post<Site>(endpoints.sites.list, payload);
}

export function updateSite(id: number, payload: SitePayload): Promise<Site> {
  return api.put<Site>(endpoints.sites.byId(id), payload);
}

export function deleteSite(id: number): Promise<void> {
  return api.del<void>(endpoints.sites.byId(id));
}

/** Sub-sites (blocks/buildings) belonging to a site. Public GET. */
export function listSubsites(siteId: number): Promise<Subsite[]> {
  return api.get<Subsite[]>(endpoints.sites.subsites(siteId));
}

export function createSubsite(
  siteId: number,
  payload: SubsitePayload,
): Promise<Subsite> {
  return api.post<Subsite>(endpoints.sites.subsites(siteId), payload);
}

/** Flags that a subsite is missing or mislabelled. */
export function createSubsiteAlert(
  siteId: number,
  note: string,
): Promise<SubsiteAlert> {
  return api.post<SubsiteAlert>(endpoints.sites.subsiteRequests(siteId), {
    note,
  });
}

export function listSubsiteAlerts(siteId: number): Promise<SubsiteAlert[]> {
  return api.get<SubsiteAlert[]>(endpoints.sites.subsiteRequests(siteId));
}

export function resolveSubsiteAlert(
  siteId: number,
  alertId: number,
): Promise<SubsiteAlert> {
  return api.post<SubsiteAlert>(
    endpoints.sites.resolveSubsiteRequest(siteId, alertId),
  );
}
