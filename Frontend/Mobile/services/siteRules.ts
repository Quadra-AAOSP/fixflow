import { api } from "@/lib/apiClient";
import { endpoints } from "@/lib/endpoints";
import type { SiteRule, SiteType } from "@/types";

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
export type RuleDraft = {
  siteType: SiteType;
  category: string;
  urgencyWeight: number;
  sortOrder: number;
};
export function listAllSiteRules(): Promise<SiteRule[]> {
  return api.get(endpoints.siteRules.list);
}
export function saveSiteRule(
  id: number | null,
  draft: RuleDraft,
): Promise<SiteRule> {
  const value = { ...draft, category: draft.category.trim().toLowerCase() };
  if (
    !value.category ||
    value.category.length > 128 ||
    ![value.urgencyWeight, value.sortOrder].every(
      (n) => Number.isInteger(n) && n >= -2147483648 && n <= 2147483647,
    )
  )
    throw new Error("Invalid rule");
  return id === null
    ? api.post(endpoints.siteRules.list, value)
    : api.put(`${endpoints.siteRules.list}/${id}`, value);
}
export function deleteSiteRule(id: number): Promise<void> {
  return api.del(`${endpoints.siteRules.list}/${id}`);
}
