import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { api } from '@/lib/apiClient';

/**
 * Lightweight "is the backend reachable?" hook — no extra native deps needed.
 * Periodically probes the backend with a minimal GET (`/api/auth/policy` —
 * cheap, always open, no credentials required) and listens for network-level
 * errors (timeout, DNS failure, connection refused). 4xx/5xx responses mean
 * the server is up; they don't count as offline.
 *
 * Also listens to AppState: when the app foregrounds, we re-probe immediately.
 *
 * Exposes:
 *   `offline` — true when the last probe failed at the network layer
 *   `retry()` — manually trigger a probe now
 */
export function useConnectivity() {
  const [offline, setOffline] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const probe = useCallback(async () => {
    try {
      await api.get('/api/auth/policy');
      setOffline(false);
    } catch (err: unknown) {
      // Network-level errors are the only ones that should flip us to offline.
      // An ApiError with a status code means the server answered — it's not
      // "offline" in the connectivity sense.
      if (err instanceof Error && isNetworkError(err)) {
        setOffline(true);
      } else {
        // Server answered 4xx/5xx — still online.
        setOffline(false);
      }
    }
  }, []);

  // Initial probe + periodic poll while the app is active.
  useEffect(() => {
    void probe();
    timer.current = setInterval(() => void probe(), 30_000);
    return () => {
      if (timer.current !== null) clearInterval(timer.current);
    };
  }, [probe]);

  // Re-probe on foreground.
  useEffect(() => {
    function handleAppState(state: string) {
      if (state === 'active') void probe();
    }
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [probe]);

  return { offline, retry: probe };
}

/**
 * Network-level error detection. Cross-platform — React Native's fetch throws
 * plain `Error` objects for "Network request failed", "Timeout", "ECONNREFUSED"
 * style conditions; web also surfaces `TypeError` with "NetworkError" in the
 * name. 4xx/5xx HTTP errors are handled in apiClient and do NOT count here.
 */
function isNetworkError(err: Error): boolean {
  const msg = (err.message ?? '').toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('networkerror') ||
    msg.includes('timeout') ||
    msg.includes('connection refused') ||
    msg.includes('dns') ||
    msg.includes('unable to resolve') ||
    msg.includes('cannot connect')
  );
}
