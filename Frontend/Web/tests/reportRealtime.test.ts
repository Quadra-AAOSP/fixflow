import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportRealtimeClient, reportSocketUrl } from '../src/services/reportRealtime';
class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
  open() { this.readyState = 1; this.onopen?.(); }
  message(frame: unknown) { this.onmessage?.({ data: JSON.stringify(frame) }); }
}
let sockets: FakeSocket[];
let callbacks: { state: ReturnType<typeof vi.fn>; connected: ReturnType<typeof vi.fn>; disconnected: ReturnType<typeof vi.fn>; event: ReturnType<typeof vi.fn>; revoked: ReturnType<typeof vi.fn> };
let client: ReportRealtimeClient;
const event = { eventId: 'event-1', schemaVersion: 1, eventType: 'report.reassignment.v1', occurredAt: '2026-10-30T08:00:00Z', siteId: 7, reportId: 91, previousStatus: 'assigned', status: 'assigned' };
beforeEach(() => {
  vi.useFakeTimers(); sockets = [];
  callbacks = { state: vi.fn(), connected: vi.fn(), disconnected: vi.fn(), event: vi.fn(), revoked: vi.fn() };
  client = new ReportRealtimeClient('ws://example.invalid/ws/reports', callbacks, () => {
    const socket = new FakeSocket(); sockets.push(socket); return socket as unknown as WebSocket;
  });
});
afterEach(() => { client.stop(); vi.useRealTimers(); });
describe('authenticated report invalidation stream', () => {
  it('sends only supported subscription frames and unsubscribes when scope changes', () => {
    client.setSubscriptions(['/sites/7/events', '/reports/91/events', '/invalid']); client.start(); sockets[0]!.open();
    expect(sockets[0]!.send.mock.calls.map(call => JSON.parse(call[0]))).toEqual([
      { action: 'subscribe', destination: '/sites/7/events' }, { action: 'subscribe', destination: '/reports/91/events' },
    ]);
    client.setSubscriptions(['/sites/9/events']);
    expect(sockets[0]!.send).toHaveBeenCalledWith(JSON.stringify({ action: 'unsubscribe', destination: '/reports/91/events' }));
  });
  it('deduplicates an event received through both site and report subscriptions', () => {
    client.setSubscriptions(['/sites/7/events', '/reports/91/events']); client.start(); sockets[0]!.open();
    sockets[0]!.message({ type: 'event', destination: '/sites/7/events', event });
    sockets[0]!.message({ type: 'event', destination: '/reports/91/events', event });
    expect(callbacks.event).toHaveBeenCalledOnce();
  });
  it('ignores mismatched scope, unsupported schema, and unsubscribed report events', () => {
    client.setSubscriptions(['/sites/7/events']); client.start(); sockets[0]!.open();
    sockets[0]!.message({ type: 'event', destination: '/sites/7/events', event: { ...event, siteId: 9 } });
    sockets[0]!.message({ type: 'event', destination: '/sites/7/events', event: { ...event, schemaVersion: 2 } });
    sockets[0]!.message({ type: 'event', destination: '/reports/91/events', event });
    expect(callbacks.event).not.toHaveBeenCalled();
  });
  it('invalidates on disconnect, reconnects, and stops all activity on logout', async () => {
    client.setSubscriptions(['/sites/7/events']); client.start(); sockets[0]!.open(); sockets[0]!.close();
    expect(callbacks.disconnected).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1000); expect(sockets).toHaveLength(2);
    sockets[1]!.open(); expect(callbacks.connected).toHaveBeenCalledTimes(2);
    client.stop(); await vi.advanceTimersByTimeAsync(60000);
    expect(sockets).toHaveLength(2); expect(vi.getTimerCount()).toBe(0);
    sockets[0]!.message({ type: 'event', destination: '/sites/7/events', event });
    expect(callbacks.event).not.toHaveBeenCalled();
  });
  it('removes revoked subscriptions before reconnecting', async () => {
    client.setSubscriptions(['/reports/91/events']); client.start(); sockets[0]!.open();
    sockets[0]!.message({ type: 'subscription-revoked', destination: '/reports/91/events' });
    expect(callbacks.revoked).toHaveBeenCalledWith('/reports/91/events');
    sockets[0]!.close(); await vi.advanceTimersByTimeAsync(1000); sockets[1]!.open();
    expect(sockets[1]!.send).not.toHaveBeenCalled();
  });
  it('derives ws/wss origins without putting credentials in the URL', () => {
    expect(reportSocketUrl('', 'https://app.example.invalid')).toBe('wss://app.example.invalid/ws/reports');
    expect(reportSocketUrl('http://localhost:8080', 'http://localhost:5173')).toBe('ws://localhost:8080/ws/reports');
  });
});
