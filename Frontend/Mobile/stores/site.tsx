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
   * staff / admin this is the user's own site; for super_admin it is
   * whichever site is currently selected via `setActiveSite`.
   */
  site: Site | null;
  /**
   * All sites visible to the caller. Exactly one for non-super_admin actors,
   * every site for super_admin (`SiteService.list`).
   */
  sites: Site[];
  /** True while the initial fetch (or an explicit refresh) is in flight. */
  loading: boolean;
  /** Last fetch error, if any. */
  error: Error | null;
  /** Re-fetch the list of sites for the current user. */
  refresh: () => Promise<void>;
  /**
   * Selects which entry in `sites` is active. Only meaningful when more than
   * one site is visible (super_admin) — see `SiteSwitcher`.
   */
  setActiveSite: (siteId: number) => void;
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
 *
 * The super_admin selection is in-memory: it resets on app restart and on
 * identity change. Persisting it would need either a storage dependency or a
 * backend preference endpoint (neither exists yet); the derived `site` below
 * means a stale selection can never surface the wrong site.
 */
export function SiteProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  const [sites, setSites] = useState<Site[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<number | null>(null);
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
    // Drop any previous actor's selection so a super_admin selection never
    // carries across a sign-out / sign-in.
    setActiveSiteId(null);
    if (user) {
      void refresh();
    } else {
      setSites([]);
      setError(null);
    }
    // Intentionally keyed on `user?.id` (not the whole user object) so we do
    // not re-fetch on every user-object reference change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setActiveSite = useCallback((siteId: number) => {
    setActiveSiteId(siteId);
  }, []);

  const value = useMemo<SiteContextValue>(() => {
    // Resolve defensively: an unknown/stale `activeSiteId` (e.g. the site was
    // deleted, or the list has not loaded yet) falls through to the first
    // entry rather than resolving to null.
    let site: Site | null = null;
    if (sites.length > 0) {
      site =
        (activeSiteId !== null
          ? sites.find((candidate) => candidate.id === activeSiteId)
          : undefined) ?? sites[0];
    }

    return {
      site,
      sites,
      loading,
      error,
      refresh,
      setActiveSite,
    };
  }, [sites, activeSiteId, loading, error, refresh, setActiveSite]);

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useCurrentSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error('useCurrentSite must be used within a SiteProvider');
  }
  return ctx;
}