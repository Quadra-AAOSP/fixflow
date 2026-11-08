import { WS_EVENTS_URL, WS_ORIGIN } from '@/constants/config';
import type { RealtimeReportEvent } from '@/utils/notifications';

/**
 * Report event stream client for `/ws/reports`.
 *
 * The backend accepts frames shaped exactly like
 * `{ "action": "subscribe" | "unsubscribe", "destination": "/sites/7/events" }`
 * and answers with `{ type: "subscribed" | "subscribed..." }` control frames or
 * `{ type: "event", destination, event }` payloads. One shared socket serves
 * every screen; destinations are reference-counted and replayed after a
 * reconnect. Failures are silent by contract: callers keep a polling fallback
 * so the UI stays live when the socket cannot be established (e.g. a native
 * build whose cookie jar is not shared with the HTTP client).
 *
 * Nothing from the session (cookies, ids) is ever logged here.
 */

type Listener = (event: RealtimeReportEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const sentDestinations = new Set<string>();

let socket: WebSocket | null = null;
let connected = false;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function totalListeners(): number {
  let count = 0;
  for (const set of listeners.values()) count += set.size;
  return count;
}

function send(frame: object): void {
  if (!socket || !connected) return;
  try {
    socket.send(JSON.stringify(frame));
  } catch {
    // The close handler scheduled a reconnect.
  }
}

function subscribeFrame(destination: string): void {
  if (sentDestinations.has(destination)) return;
  sentDestinations.add(destination);
  send({ action: 'subscribe', destination });
}

function unsubscribeFrame(destination: string): void {
  if (!sentDestinations.has(destination)) return;
  sentDestinations.delete(destination);
  send({ action: 'unsubscribe', destination });
}

function openSocket(): void {
  if (socket || typeof WebSocket === 'undefined') return;
  let next: WebSocket;
  try {
    // React Native extends the constructor with an options bag (headers);
    // browsers ignore the extra argument and set their own Origin.
    const Ctor = WebSocket as unknown as new (
      url: string,
      protocols?: string | string[],
      options?: { headers?: Record<string, string> },
    ) => WebSocket;
    const isNative =
      typeof navigator !== 'undefined' &&
      (navigator as { product?: string }).product === 'ReactNative';
    next = isNative
      ? new Ctor(WS_EVENTS_URL, [], { headers: { Origin: WS_ORIGIN } })
      : new Ctor(WS_EVENTS_URL);
  } catch {
    scheduleReconnect();
    return;
  }
  socket = next;

  next.onopen = () => {
    connected = true;
    reconnectAttempt = 0;
    sentDestinations.clear();
    for (const destination of listeners.keys()) subscribeFrame(destination);
  };

  next.onmessage = (message) => {
    let payload: unknown;
    try {
      payload = JSON.parse(String((message as { data?: unknown }).data ?? ''));
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') return;
    const frame = payload as {
      type?: string;
      destination?: string;
      event?: RealtimeReportEvent;
    };
    if (frame.type === 'subscription-revoked' && frame.destination) {
      const owned = listeners.get(frame.destination);
      if (owned && owned.size > 0) {
        // Access was revoked (role/site change). Drop the frame; the next
        // authorization check on the server is authoritative.
        sentDestinations.delete(frame.destination);
      }
      return;
    }
    if (frame.type !== 'event' || !frame.destination || !frame.event) return;
    const owned = listeners.get(frame.destination);
    if (!owned) return;
    for (const listener of owned) {
      try {
        listener(frame.event);
      } catch {
        // A screen-level error must not break delivery for other screens.
      }
    }
  };

  const onDisconnect = () => {
    connected = false;
    sentDestinations.clear();
    if (socket === next) socket = null;
    if (totalListeners() > 0) scheduleReconnect();
  };
  next.onclose = onDisconnect;
  next.onerror = onDisconnect;
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null || socket !== null || totalListeners() === 0) return;
  const delay = Math.min(30_000, 1000 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (totalListeners() > 0) openSocket();
  }, delay);
}

function closeIfIdle(): void {
  if (totalListeners() > 0) return;
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
  connected = false;
  sentDestinations.clear();
  const current = socket;
  socket = null;
  try {
    current?.close();
  } catch {
    // Already closed.
  }
}

export function isRealtimeConnected(): boolean {
  return connected;
}

/**
 * Subscribe to `/sites/{id}/events` or `/reports/{id}/events`.
 * Returns an idempotent unsubscribe function.
 */
export function subscribeToReportEvents(
  destination: string,
  listener: Listener,
): () => void {
  let set = listeners.get(destination);
  if (!set) {
    set = new Set();
    listeners.set(destination, set);
  }
  set.add(listener);
  if (socket) subscribeFrame(destination);
  else openSocket();

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const owned = listeners.get(destination);
    if (!owned) return;
    owned.delete(listener);
    if (owned.size === 0) {
      listeners.delete(destination);
      unsubscribeFrame(destination);
      closeIfIdle();
    }
  };
}
