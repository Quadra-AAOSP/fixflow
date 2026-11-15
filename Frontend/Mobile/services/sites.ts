import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type {
  ReportingSetup,
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
  contractFlatFeeMinor?: number | null;
  contractFeeCurrency?: string;
  termsText?: string | null;
  contractTermsText?: string | null;
};

export function createSite(payload: SitePayload): Promise<Site> {
  return api.post<Site>(endpoints.sites.list, payload);
}

export function updateSite(id: number, payload: SitePayload): Promise<Site> {
  return api.put<Site>(endpoints.sites.byId(id), payload);
}

export type SiteDocumentKind = 'terms' | 'contract';

function mimeFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

/**
 * Upload a PDF/Word/text file for site terms or the site contract.
 * Backend writes the bytes to local storage and saves the object path on the site.
 * Callers should pick with `copyToCacheDirectory: true` so the URI is readable.
 */
export function uploadSiteDocument(
  siteId: number,
  kind: SiteDocumentKind,
  file: { uri: string; name: string; mimeType?: string | null },
): Promise<Site> {
  const name = (file.name || `${kind}.txt`).replace(/[/\\]/g, '_');
  const mimeType =
    file.mimeType && file.mimeType !== 'application/octet-stream'
      ? file.mimeType
      : mimeFromFilename(name);
  const uri =
    file.uri.startsWith('file://')
    || file.uri.startsWith('content://')
    || file.uri.startsWith('ph://')
      ? file.uri
      : `file://${file.uri}`;

  const form = new FormData();
  // React Native FormData expects `{ uri, name, type }`, not a web Blob.
  form.append('file', { uri, name, type: mimeType } as unknown as Blob);
  return api.post<Site>(endpoints.sites.document(siteId, kind), undefined, {
    body: form,
    timeoutMs: 60_000,
  });
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

export function updateSubsite(
  siteId: number,
  id: number,
  payload: SubsitePayload,
): Promise<Subsite> {
  return api.put<Subsite>(endpoints.sites.subsite(siteId, id), payload);
}

/** Archives a subsite — it stays listed but stops accepting new reports. */
export function archiveSubsite(siteId: number, id: number): Promise<Subsite> {
  return api.post<Subsite>(endpoints.sites.archiveSubsite(siteId, id));
}

/**
 * Live reporting readiness for a site. The backend recalculates this on every
 * call (`SubsiteService.setup`) — archiving the last building flips
 * `reportingReady` back to false.
 */
export function getReportingSetup(siteId: number): Promise<ReportingSetup> {
  return api.get<ReportingSetup>(endpoints.sites.reportingSetup(siteId));
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
