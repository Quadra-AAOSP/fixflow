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