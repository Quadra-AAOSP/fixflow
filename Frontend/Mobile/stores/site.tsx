import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiError } from '@/lib/apiClient';
import { listSites } from '@/services/sites';
import type { Site } from '@/types';
import { useAuth } from '@/hooks/useAuth';

export type SiteContextValue = {
  /**
   * The site the user is currently viewing. For reporter / technician /
   * staff / admin this is the user's own site; for super_admin Phase 9 will
   * add a switcher backed by `sites`.
   */
  site: Site | null;
  /**
   * All sites visible to the caller. For non-super_admin actors this is a
   * single-element array; for super_admin it lists every site. Exposed so a
   * future switcher (Phase 9) can be added without changing this provider.
   */
  sites: Site[];
  /** True while the initial fetch (or an explicit refresh) is in flight. */
  loading: boolean;
  /** Last fetch error, if any. */
  error: Error | null;
  /** Re-fetch the list of sites for the current user. */
  refresh: () => Promise<void>;
};

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

/**
 * Loads and exposes the caller's site context. Wraps the authenticated
 * route tree so consumers can call `useCurrentSite()` from any tab.
 *
 * Scope: POST-login only. The pre-login public site directory is
 * intentionally not implemented — backend dependency #5 (no public
 * `GET /api/sites` endpoint before login). The Register screen therefore
 * asks the user to type the numeric site ID supplied by their admin.
 */
export function SiteProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep the latest logout reference without re-creating `refresh` on every
  // render (and therefore re-firing the effect on every parent update).
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const refresh = useCallback(async () => {
    if (!user) {
      setSites([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await listSites();
      setSites(result);
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      setError(wrapped);
      // Treat 401 on site lookup the same as a stale session everywhere
      // else: sign the user out so we stop showing stale data.
      if (err instanceof ApiError && err.status === 401) {
        await logoutRef.current().catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void refresh();
    } else {
      setSites([]);
      setError(null);
    }
    // We intentionally key off `user?.id` (not the whole user) so we don't
    // re-fetch on every user-object reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const value = useMemo<SiteContextValue>(() => {
    const site = sites.length > 0 ? sites[0] : null;
    return { site, sites, loading, error, refresh };
  }, [sites, loading, error, refresh]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useCurrentSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error('useCurrentSite must be used within a SiteProvider');
  }
  return ctx;
}