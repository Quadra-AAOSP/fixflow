import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';

import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  getMyAvailability,
  updateMyAvailability,
} from '@/services/technician';

/**
 * "Available for work" preference for technicians, backed by
 * `GET/PUT /api/technicians/me/availability` — the ranking and assignment
 * pools read this value server-side, so toggling it here actually changes
 * assignment eligibility.
 *
 * SecureStore keeps a cached copy so the UI paints instantly on cold start;
 * the server value wins once the GET resolves. Non-technician roles never
 * call the endpoint (it 403s for them) and keep the local default.
 */
const STORAGE_KEY = 'fixflow.technician.available';

type TechnicianAvailabilityValue = {
  /** Whether the technician is currently available for work. */
  available: boolean;
  setAvailable: (value: boolean) => void;
  /** True until the server value (or cache) has resolved, so the UI doesn't flash. */
  loading: boolean;
  /** True while a toggle is being written to the backend. */
  saving: boolean;
  /** Set when the last sync attempt failed; cleared on the next success. */
  syncError: boolean;
};

const TechnicianAvailabilityContext =
  createContext<TechnicianAvailabilityValue | null>(null);

export function TechnicianAvailabilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const isTechnician = user?.role === 'technician';

  // Optimistic default (available); `loading` keeps the UI from trusting it
  // until the server (or at least the cache) has been read.
  const [available, setAvailableState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Fast paint from cache first.
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (mounted && (raw === 'true' || raw === 'false')) {
          setAvailableState(raw === 'true');
        }
      } catch {
        // SecureStore can be unavailable (e.g. web without the native module).
      }

      if (isTechnician) {
        try {
          const mine = await getMyAvailability();
          if (mounted) {
            setAvailableState(mine.status === 'available');
            setSyncError(false);
          }
        } catch (err) {
          // Keep the cached value; a 401 here is handled globally by apiClient.
          if (mounted && !(err instanceof ApiError && err.status === 401)) {
            setSyncError(true);
          }
        }
      }

      if (mounted) setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [isTechnician]);

  const setAvailable = useCallback(
    (value: boolean) => {
      const previous = available;
      setAvailableState(value);
      setSyncError(false);
      void SecureStore.setItemAsync(
        STORAGE_KEY,
        value ? 'true' : 'false',
      ).catch(() => {
        // Persistence failed — the in-memory state still reflects the choice.
      });

      if (!isTechnician) return;

      setSaving(true);
      void updateMyAvailability(value)
        .then(() => {
          setSyncError(false);
        })
        .catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 401) return;
          // Roll back so the toggle never claims a state the server rejected.
          setAvailableState(previous);
          void SecureStore.setItemAsync(
            STORAGE_KEY,
            previous ? 'true' : 'false',
          ).catch(() => {});
          setSyncError(true);
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [available, isTechnician],
  );

  const value = useMemo<TechnicianAvailabilityValue>(
    () => ({ available, setAvailable, loading, saving, syncError }),
    [available, setAvailable, loading, saving, syncError],
  );

  return (
    <TechnicianAvailabilityContext.Provider value={value}>
      {children}
    </TechnicianAvailabilityContext.Provider>
  );
}

export function useTechnicianAvailability(): TechnicianAvailabilityValue {
  const context = useContext(TechnicianAvailabilityContext);
  if (!context) {
    throw new Error(
      'useTechnicianAvailability must be used inside a TechnicianAvailabilityProvider',
    );
  }
  return context;
}
