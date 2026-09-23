export type SiteType = 'school' | 'hostel' | 'hotel';

export type ContractStatus = 'contracted' | 'uncontracted';

/**
 * Mirrors backend `SiteResponse`. `address`, `description`, and `imageUrl`
 * may be `null` — backend columns are nullable and Jackson serializes them.
 */
export type Site = {
  id: number;
  name: string;
  type: SiteType;
  contractStatus: ContractStatus;
  address: string | null;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Mirrors backend `SiteRuleResponse`. Categories are lower-cased server-side
 * via `CategoryTaxonomyService.requireAllowedCategory` — match this when
 * sending them back (create-report payload).
 */
export type SiteRule = {
  id: number;
  siteType: SiteType;
  category: string;
  urgencyWeight: number;
  sortOrder: number;
};