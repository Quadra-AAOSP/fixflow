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
import { AppState } from 'react-native';

import { api } from '@/lib/apiClient';
import { listQueuedReports } from '@/lib/offlineQueue';
import {
  flushReportQueue,
  isNetworkFailure,
  type FlushResult,
} from '@/services/offlineReports';

type ConnectivityValue = {
  /** Last probe failed at the network layer. */
  offline: boolean;
  /** Reports waiting in the offline queue. */
  pendingCount: number;
  /** Re-probe the backend and re-send queued reports. */
  retry: () => Promise<void>;
  /** Send queued reports only (used by the reports-list banner). */
  flush: () => Promise<FlushResult>;
  /** Re-read the queued count (after the form enqueues offline). */
  refreshPending: () => Promise<void>;
};

const ConnectivityContext = createContext<ConnectivityValue | null>(null);

/**
 * Single app-wide connectivity monitor. Replaces the previous per-component
 * probe so every banner, screen and the offline queue agree on the same
 * offline/online state, and queued reports auto-send when the backend returns.
 */
export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasOffline = useRef(false);

  const refreshPending = useCallback(async () => {
    try {
      setPendingCount((await listQueuedReports()).length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const probe = useCallback(async (): Promise<boolean> => {
    try {
      await api.get('/api/auth/policy');
      setOffline(false);
      return true;
    } catch (err) {
      // A real HTTP response (even 4xx/5xx) means the server is reachable.
      const networkDown = isNetworkFailure(err);
      setOffline(networkDown);
      return !networkDown;
    }
  }, []);

  const flush = useCallback(async (): Promise<FlushResult> => {
    const result = await flushReportQueue();
    await refreshPending();
    return result;
  }, [refreshPending]);

  const runProbe = useCallback(async () => {
    const online = await probe();
    if (online && wasOffline.current) {
      wasOffline.current = false;
      await flush();
    } else if (!online) {
      wasOffline.current = true;
    }
  }, [probe, flush]);

  useEffect(() => {
    void runProbe();
    void refreshPending();
    timer.current = setInterval(() => {
      void runProbe();
      void refreshPending();
    }, 30_000);
    return () => {
      if (timer.current !== null) clearInterval(timer.current);
    };
  }, [runProbe, refreshPending]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void runProbe();
        void refreshPending();
      }
    });
    return () => sub.remove();
  }, [runProbe, refreshPending]);

  const retry = useCallback(async () => {
    await runProbe();
    await flush();
  }, [runProbe, flush]);

  const value = useMemo<ConnectivityValue>(
    () => ({ offline, pendingCount, retry, flush, refreshPending }),
    [offline, pendingCount, retry, flush, refreshPending],
  );

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityValue {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
}
