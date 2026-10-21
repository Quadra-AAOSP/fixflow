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

/**
 * Device-local "available for work" preference for technicians.
 *
 * The backend has no availability endpoint, so this value is deliberately
 * never dispatched anywhere — it only reflects what the technician picked on
 * this device. Persisted through SecureStore (which also works on web via
 * expo-secure-store's web shim) under a single boolean flag.
 */
const STORAGE_KEY = 'fixflow.technician.available';

type TechnicianAvailabilityValue = {
  /** Whether the technician is currently available for work. */
  available: boolean;
  setAvailable: (value: boolean) => void;
  /** True until the stored value has resolved, so the UI doesn't flash. */
  loading: boolean;
};

const TechnicianAvailabilityContext =
  createContext<TechnicianAvailabilityValue | null>(null);

export function TechnicianAvailabilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Optimistic default (available); `loading` keeps the UI from trusting it
  // until storage has been read.
  const [available, setAvailableState] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (mounted && (raw === 'true' || raw === 'false')) {
          setAvailableState(raw === 'true');
        }
      } catch {
        // SecureStore can be unavailable (e.g. web without the native module).
        // Degrade to the in-memory default rather than crashing.
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setAvailable = useCallback((value: boolean) => {
    setAvailableState(value);
    void (async () => {
      try {
        await SecureStore.setItemAsync(STORAGE_KEY, value ? 'true' : 'false');
      } catch {
        // Persistence failed — the in-memory state still reflects the choice.
      }
    })();
  }, []);

  const value = useMemo<TechnicianAvailabilityValue>(
    () => ({ available, setAvailable, loading }),
    [available, setAvailable, loading],
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
