import { beforeEach, expect, it, vi } from 'vitest';
import { request } from '../src/services/api';
import { listSiteRules, saveSiteRule, deleteSiteRule } from '../src/services/siteRules';
vi.mock('../src/services/api', () => ({ request: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const draft = { siteType: 'school' as const, category: ' Plumbing ', urgencyWeight: -1, sortOrder: 2 };
it('uses published list/create/update/delete mappings and normalized category codes', async () => {
  await listSiteRules(); expect(request).toHaveBeenLastCalledWith('/api/site-rules');
  await saveSiteRule(null, draft); expect(request).toHaveBeenLastCalledWith('/api/site-rules', { method: 'POST', body: JSON.stringify({ ...draft, category: 'plumbing' }) });
  await saveSiteRule(7, draft); expect(request).toHaveBeenLastCalledWith('/api/site-rules/7', expect.objectContaining({ method: 'PUT' }));
  await deleteSiteRule(7); expect(request).toHaveBeenLastCalledWith('/api/site-rules/7', { method: 'DELETE' });
});
it('rejects values outside DTO integer and category limits', () => {
  for (const value of [{ ...draft, sortOrder: 2147483648 }, { ...draft, urgencyWeight: 1.5 }, { ...draft, category: 'x'.repeat(129) }]) expect(() => saveSiteRule(null, value)).toThrow();
  expect(request).not.toHaveBeenCalled();
});
