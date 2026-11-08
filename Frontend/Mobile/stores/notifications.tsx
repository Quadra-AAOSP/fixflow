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
import { useTranslation } from 'react-i18next';

import { useToast } from '@/components/ui/useToastContext';
import { useAuth } from '@/hooks/useAuth';
import { deleteJson, readJson, writeJson } from '@/lib/persist';
import { subscribeToReportEvents } from '@/services/realtime';
import { useCurrentSite } from '@/stores/site';
import {
  mergeNotifications,
  notificationForEvent,
  unreadCount,
  type AppNotification,
} from '@/utils/notifications';

const STORAGE_KEY = 'fixflow.notifications.v1';

type PersistedFeed = { userId: number; items: AppNotification[] };

type NotificationsValue = {
  items: AppNotification[];
  unread: number;
  markAllRead: () => void;
  clearAll: () => void;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * In-app notification feed built from the `/ws/reports` site stream. Entries
 * survive restarts (SecureStore) and are scoped to the signed-in account, so
 * switching users never leaks another account's activity.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { site } = useCurrentSite();
  const { showToast } = useToast();
  const { t } = useTranslation('common');

  const [items, setItems] = useState<AppNotification[]>([]);
  const loadedFor = useRef<number | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    if (userId === null) {
      setItems([]);
      loadedFor.current = null;
      void deleteJson(STORAGE_KEY);
      return;
    }
    void (async () => {
      const persisted = await readJson<PersistedFeed>(STORAGE_KEY);
      if (cancelled) return;
      const restored =
        persisted && persisted.userId === userId ? persisted.items : [];
      setItems(restored);
      loadedFor.current = userId;
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (userId === null || loadedFor.current !== userId) return;
    void writeJson(STORAGE_KEY, { userId, items } satisfies PersistedFeed);
  }, [items, userId]);

  useEffect(() => {
    if (!site) return;
    const unsubscribe = subscribeToReportEvents(`/sites/${site.id}/events`, (event) => {
      const notification = notificationForEvent(event);
      if (!notification) return;
      setItems((current) => mergeNotifications(current, [notification]));
      showToast(t(notification.titleKey), notification.tone === 'warning' ? 'info' : 'success');
    });
    return unsubscribe;
  }, [site?.id, showToast, t]);

  const markAllRead = useCallback(() => {
    setItems((current) =>
      current.some((item) => !item.read)
        ? current.map((item) => ({ ...item, read: true }))
        : current,
    );
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    void deleteJson(STORAGE_KEY);
  }, []);

  const value = useMemo<NotificationsValue>(
    () => ({ items, unread: unreadCount(items), markAllRead, clearAll }),
    [items, markAllRead, clearAll],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
