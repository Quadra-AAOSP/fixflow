import { describe, expect, it } from 'vitest';

import {
  mergeNotifications,
  notificationForEvent,
  unreadCount,
  type AppNotification,
  type RealtimeReportEvent,
} from '../utils/notifications';

function event(overrides: Partial<RealtimeReportEvent> = {}): RealtimeReportEvent {
  return {
    eventId: 'e1',
    eventType: 'report.pending-resolution.v1',
    occurredAt: '2026-01-10T09:00:00.000Z',
    reportId: 42,
    siteId: 7,
    status: 'resolved_pending_confirmation',
    ...overrides,
  };
}

describe('notification mapping', () => {
  it('maps every backend event type to translated copy', () => {
    const types = [
      'report.assignment.v1',
      'report.reassignment.v1',
      'report.status-changed.v1',
      'report.pending-resolution.v1',
      'report.confirmation.v1',
    ];
    for (const eventType of types) {
      const item = notificationForEvent(event({ eventType }));
      expect(item, eventType).not.toBeNull();
      expect(item?.titleKey).toMatch(/^notifications\.event\./);
      expect(item?.bodyKey).toMatch(/^notifications\.event\./);
    }
  });

  it('gives pending resolution a warning tone and confirmation a success tone', () => {
    expect(notificationForEvent(event())?.tone).toBe('warning');
    expect(
      notificationForEvent(event({ eventType: 'report.confirmation.v1' }))?.tone,
    ).toBe('success');
  });

  it('drops unknown event types and malformed envelopes', () => {
    expect(notificationForEvent(event({ eventType: 'report.unknown.v1' }))).toBeNull();
    expect(
      notificationForEvent({ ...event(), eventId: undefined as unknown as string }),
    ).toBeNull();
  });
});

describe('notification feed', () => {
  const item = (id: string): AppNotification => ({
    id,
    eventType: 'report.status-changed.v1',
    reportId: 42,
    titleKey: 'notifications.event.status.title',
    bodyKey: 'notifications.event.status.body',
    tone: 'info',
    occurredAt: '2026-01-10T09:00:00.000Z',
    read: false,
  });

  it('de-dupes by event id and keeps newest first', () => {
    const merged = mergeNotifications([item('a')], [item('b'), item('a')]);
    expect(merged.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('caps the feed', () => {
    const many = Array.from({ length: 60 }, (_, index) => item(`e${index}`));
    expect(mergeNotifications([], many).length).toBe(50);
  });

  it('counts only unread rows', () => {
    expect(unreadCount([item('a'), { ...item('b'), read: true }])).toBe(1);
  });
});
