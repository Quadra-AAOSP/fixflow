export type RealtimeState = 'connecting' | 'connected' | 'offline' | 'stopped';
export type ReportEvent = {
  eventId: string; eventType: string; schemaVersion: 1; occurredAt: string;
  siteId: number; reportId: number; previousStatus: string; status: string;
};
type Callbacks = {
  state: (state: RealtimeState) => void;
  connected: () => void;
  disconnected: () => void;
  event: (event: ReportEvent) => void;
  revoked: (destination: string) => void;
};
const destinationPattern = /^\/(sites|reports)\/([1-9][0-9]*)\/events$/;
const eventTypes = new Set(['report.assignment.v1', 'report.status-changed.v1', 'report.pending-resolution.v1', 'report.confirmation.v1', 'report.reassignment.v1']);

/** Cookie-authenticated invalidation stream. Event frames never replace REST report data. */
export class ReportRealtimeClient {
  private socket: WebSocket | null = null;
  private destinations = new Set<string>();
  private seen = new Set<string>();
  private retry: ReturnType<typeof setTimeout> | undefined;
  private attempts = 0;
  private stopped = true;
  constructor(private url: string, private callbacks: Callbacks,
    private createSocket: (url: string) => WebSocket = url => new WebSocket(url)) {}

  start() { if (!this.stopped) return; this.stopped = false; this.connect(); }
  stop() {
    this.stopped = true; clearTimeout(this.retry); this.retry = undefined;
    const socket = this.socket; this.socket = null;
    socket?.close(); this.destinations.clear(); this.seen.clear(); this.attempts = 0;
    this.callbacks.state('stopped');
  }
  setSubscriptions(values: string[]) {
    const next = new Set(values.filter(value => destinationPattern.test(value)));
    for (const old of this.destinations) if (!next.has(old)) this.send('unsubscribe', old);
    for (const value of next) if (!this.destinations.has(value)) this.send('subscribe', value);
    this.destinations = next;
  }
  private send(action: 'subscribe' | 'unsubscribe', destination: string) {
    if (this.socket?.readyState === 1) this.socket.send(JSON.stringify({ action, destination }));
  }
  private connect() {
    if (this.stopped) return;
    this.callbacks.state('connecting');
    let socket: WebSocket;
    try { socket = this.createSocket(this.url); }
    catch { this.lost(); return; }
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket || this.stopped) return;
      this.attempts = 0; this.callbacks.state('connected');
      for (const destination of this.destinations) this.send('subscribe', destination);
      this.callbacks.connected();
    };
    socket.onmessage = message => {
      if (this.socket !== socket || this.stopped || typeof message.data !== 'string') return;
      this.receive(message.data);
    };
    socket.onclose = () => { if (this.socket === socket && !this.stopped) this.lost(); };
    socket.onerror = () => {
      if (this.socket !== socket || this.stopped) return;
      this.lost(); socket.close();
    };
  }
  private lost() {
    this.socket = null;
    this.callbacks.state('offline'); this.callbacks.disconnected();
    if (this.stopped) return;
    const delay = Math.min(1000 * 2 ** Math.min(this.attempts++, 5), 30000);
    clearTimeout(this.retry);
    this.retry = setTimeout(() => { this.retry = undefined; this.connect(); }, delay);
  }
  private receive(raw: string) {
    try {
      const frame = JSON.parse(raw);
      if (!frame || typeof frame.destination !== 'string' || !this.destinations.has(frame.destination)) return;
      if (frame.type === 'subscription-revoked') {
        this.destinations.delete(frame.destination); this.callbacks.revoked(frame.destination); return;
      }
      if (frame.type !== 'event') return;
      const event = frame.event;
      const match = destinationPattern.exec(frame.destination);
      if (!event || !match || event.schemaVersion !== 1 || !eventTypes.has(event.eventType) ||
          typeof event.eventId !== 'string' || !event.eventId || event.eventId.length > 128 ||
          !Number.isSafeInteger(event.siteId) || event.siteId <= 0 || !Number.isSafeInteger(event.reportId) || event.reportId <= 0 ||
          Number(match[2]) !== (match[1] === 'sites' ? event.siteId : event.reportId) || this.seen.has(event.eventId)) return;
      this.seen.add(event.eventId);
      if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
      this.callbacks.event(event as ReportEvent);
    } catch { /* Ignore malformed frames; private report data is always refetched through REST. */ }
  }
}

export function reportSocketUrl(apiBase: string, pageOrigin: string) {
  const url = new URL('/ws/reports', apiBase || pageOrigin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) API origin without embedded credentials.');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}
