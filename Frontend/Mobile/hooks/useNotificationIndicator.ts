import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { listNotifications } from '@/services/notifications';
import { listShopNotifications } from '@/services/shop';
import { readSeen, subscribeSeen, type NoticeFeed } from '@/lib/notificationSeen';

export function useNotificationIndicator() {
  const { user } = useAuth();
  const [state, setState] = useState({ id: user?.id, unread: false });
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    const id = user?.id;
    if (id == null || user?.applicationOnly) { setState({ id, unread: false }); return; }
    const feeds: NoticeFeed[] = user?.role === 'shop_manager' ? ['shop'] : ['reports', 'shop'];
    const seen = await readSeen(id);
    const results = await Promise.allSettled(feeds.map(async feed => {
      const result = await (feed === 'reports' ? listNotifications(0) : listShopNotifications(0));
      return result.content.some(notice => notice.id > seen[feed]);
    }));
    if (current !== version.current) return;
    setState(previous => ({ id, unread: results.some(result => result.status === 'fulfilled' && result.value)
      || (results.some(result => result.status === 'rejected') && previous.id === id && previous.unread) }));
  }, [user?.id, user?.role, user?.applicationOnly]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const subscription = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    const unsubscribe = subscribeSeen(() => { void refresh(); });
    return () => { version.current++; clearInterval(timer); subscription.remove(); unsubscribe(); };
  }, [refresh]));
  return state.id === user?.id && state.unread;
}
