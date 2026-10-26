import { api } from '@/lib/apiClient';
import { endpoints } from '@/lib/endpoints';
import type { NlSearchResult } from '@/types';

/**
 * Natural-language → structured filters. The backend validates every
 * extracted value against the site taxonomy and drops unknowns, so the
 * returned filters are always safe to apply client-side.
 */
export function searchReportsNl(
  siteId: number,
  query: string,
): Promise<NlSearchResult> {
  return api.post<NlSearchResult>(endpoints.reports.searchNl, { siteId, query });
}
