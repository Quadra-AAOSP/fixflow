import { request } from './api';
import type { SiteRule, SiteType } from '@/types/maintenance';
export interface RuleDraft { siteType: SiteType; category: string; urgencyWeight: number; sortOrder: number }
export const listSiteRules = () => request<SiteRule[]>('/api/site-rules');
export function saveSiteRule(id: number | null, draft: RuleDraft) {
  const value = { ...draft, category: draft.category.trim().toLowerCase() };
  if (!['school', 'hostel', 'hotel'].includes(value.siteType) || !value.category || value.category.length > 128 ||
      ![value.urgencyWeight, value.sortOrder].every(n => Number.isInteger(n) && n >= -2147483648 && n <= 2147483647)) {
    throw new Error('Enter a category and valid whole-number rule values.');
  }
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) throw new Error('Choose a valid rule.');
  return request<SiteRule>(id === null ? '/api/site-rules' : `/api/site-rules/${id}`, {
    method: id === null ? 'POST' : 'PUT', body: JSON.stringify(value),
  });
}
export function deleteSiteRule(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Choose a valid rule.');
  return request<void>(`/api/site-rules/${id}`, { method: 'DELETE' });
}
