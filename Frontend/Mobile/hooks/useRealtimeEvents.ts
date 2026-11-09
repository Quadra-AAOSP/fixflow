import { useEffect, useRef } from 'react';

import {
  isRealtimeConnected,
  subscribeToReportEvents,
} from '@/services/realtime';
import type { RealtimeReportEvent } from '@/utils/notifications';

type Options = {
  /** Polling fallback used only while the socket is unavailable. */
  fallbackPollMs?: number;
  enabled?: boolean;
};

/**
 * Live report events plus a polling fallback.
 *
 * `onSignal` fires for every domain event, and also on the fallback interval
 * while the socket is disconnected, so screens can simply reload. Handlers are
 * expected to debounce (a page of events becomes one refetch).
 */
export function useRealtimeEvents(
  destination: string | null,
  onSignal: (event?: RealtimeReportEvent) => void,
  { fallbackPollMs = 30_000, enabled = true }: Options = {},
): void {
  const handlerRef = useRef(onSignal);
  handlerRef.current = onSignal;

  useEffect(() => {
    if (!enabled) return;

    // No destination (e.g. a technician whose queue spans contract sites)
    // still gets the polling fallback so the screen stays fresh.
    const unsubscribe = destination
      ? subscribeToReportEvents(destination, (event) => {
          handlerRef.current(event);
        })
      : () => {};
    const poll = setInterval(() => {
      if (!isRealtimeConnected()) handlerRef.current(undefined);
    }, fallbackPollMs);

    return () => {
      unsubscribe();
      clearInterval(poll);
    };
  }, [destination, enabled, fallbackPollMs]);
}
