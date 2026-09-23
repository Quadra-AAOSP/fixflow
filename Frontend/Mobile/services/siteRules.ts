import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { SiteRule, SiteType } from '@/types';

/**
 * Lists the category / urgency-weight taxonomy for a given site type.
 * Categories returned are the only keys the report-create endpoint will accept
 * (the taxonomy is enforced server-side in `CategoryTaxonomyService`).
 */
export function listSiteRules(siteType: SiteType): Promise<SiteRule[]> {
  return api.get<SiteRule[]>(
    `${endpoints.siteRules.list}?siteType=${encodeURIComponent(siteType)}`,
  );
}

/**
 * Lists every site rule across all site types (`siteType` omitted).
 *
 * Needed where the caller has no single site type to filter by: a
 * marketplace-eligible technician has `siteId = null` and therefore no site
 * type, but still needs the trade list to declare skills against.
 */
export function listAllSiteRules(): Promise<SiteRule[]> {
  return api.get<SiteRule[]>(endpoints.siteRules.list);
}