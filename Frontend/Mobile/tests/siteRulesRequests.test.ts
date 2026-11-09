import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({ api }));
import { deleteSiteRule, listAllSiteRules, listSiteRules, saveSiteRule } from '../services/siteRules';

const draft = { siteType: 'school' as const, category: ' Plumbing ', urgencyWeight: 4, sortOrder: 2 };

describe('site rules requests', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists all rules or filters by site type', () => {
    listAllSiteRules();
    listSiteRules('hotel');
    expect(api.get).toHaveBeenNthCalledWith(1, '/api/site-rules');
    expect(api.get).toHaveBeenNthCalledWith(2, '/api/site-rules?siteType=hotel');
  });

  it('creates and updates normalized drafts using the correct methods', () => {
    const normalized = { ...draft, category: 'plumbing' };
    saveSiteRule(null, draft);
    saveSiteRule(12, draft);
    expect(api.post).toHaveBeenCalledWith('/api/site-rules', normalized);
    expect(api.put).toHaveBeenCalledWith('/api/site-rules/12', normalized);
  });

  it('deletes the selected rule', () => {
    deleteSiteRule(12);
    expect(api.del).toHaveBeenCalledWith('/api/site-rules/12');
  });

  it('rejects invalid categories and numeric values without sending a request', () => {
    for (const invalid of [
      { ...draft, category: ' ' },
      { ...draft, category: 'x'.repeat(129) },
      { ...draft, urgencyWeight: 1.5 },
      { ...draft, sortOrder: 2147483648 },
      { ...draft, urgencyWeight: NaN },
    ]) {
      expect(() => saveSiteRule(null, invalid)).toThrow();
      expect(() => saveSiteRule(12, invalid)).toThrow();
    }
    expect(api.post).not.toHaveBeenCalled();
    expect(api.put).not.toHaveBeenCalled();
  });
});
