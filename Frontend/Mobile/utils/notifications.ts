/**
 * Maps backend report domain events (`/ws/reports`) onto in-app notifications.
 * Pure so the mapping can be unit tested without a socket.
 */

export type RealtimeReportEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  reportId: number;
  siteId?: number;
  status?: string;
  previousStatus?: string;
  assigneeId?: number | null;
  previousAssigneeId?: number | null;
};

export type NotificationTone = 'info' | 'success' | 'warning';

export type AppNotification = {
  id: string;
  eventType: string;
  reportId: number;
  titleKey: string;
  bodyKey: string;
  tone: NotificationTone;
  occurredAt: string;
  read: boolean;
};

type EventCopy = { titleKey: string; bodyKey: string; tone: NotificationTone };

const EVENT_COPY: Record<string, EventCopy> = {
  'report.assignment.v1': {
    titleKey: 'notifications.event.assignment.title',
    bodyKey: 'notifications.event.assignment.body',
    tone: 'info',
  },
  'report.reassignment.v1': {
    titleKey: 'notifications.event.reassignment.title',
    bodyKey: 'notifications.event.reassignment.body',
    tone: 'warning',
  },
  'report.status-changed.v1': {
    titleKey: 'notifications.event.status.title',
    bodyKey: 'notifications.event.status.body',
    tone: 'info',
  },
  'report.pending-resolution.v1': {
    titleKey: 'notifications.event.pendingResolution.title',
    bodyKey: 'notifications.event.pendingResolution.body',
    tone: 'warning',
  },
  'report.confirmation.v1': {
    titleKey: 'notifications.event.confirmation.title',
    bodyKey: 'notifications.event.confirmation.body',
    tone: 'success',
  },
};

export function notificationForEvent(
  event: RealtimeReportEvent,
): AppNotification | null {
  if (
    !event ||
    typeof event.eventId !== 'string' ||
    typeof event.eventType !== 'string' ||
    typeof reportIdOf(event) !== 'number'
  ) {
    return null;
  }
  const copy = EVENT_COPY[event.eventType];
  if (!copy) return null;
  return {
    id: event.eventId,
    eventType: event.eventType,
    reportId: event.reportId,
    titleKey: copy.titleKey,
    bodyKey: copy.bodyKey,
    tone: copy.tone,
    occurredAt: event.occurredAt,
    read: false,
  };
}

function reportIdOf(event: RealtimeReportEvent): number | undefined {
  return event.reportId;
}

/**
 * Newest-first, de-duplicated by event id, capped so a long-lived session
 * cannot grow the feed or its SecureStore record without bound.
 */
export function mergeNotifications(
  existing: AppNotification[],
  incoming: AppNotification[],
  limit = 50,
): AppNotification[] {
  const seen = new Set<string>();
  const merged: AppNotification[] = [];
  for (const item of [...incoming, ...existing]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}

export function unreadCount(items: AppNotification[]): number {
  return items.reduce((count, item) => count + (item.read ? 0 : 1), 0);
}
