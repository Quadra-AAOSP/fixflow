import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { useAuth } from '@/hooks/useAuth';
import { listShopNotifications } from '@/services/shop';
import type { ShopNotification } from '@/types/shop';
import { toErrorMessage } from '@/lib/apiClient';
import { listNotifications, type ReportNotice } from '@/services/notifications';
import { markNoticesSeen } from '@/lib/notificationSeen';
import { formatDate } from '@/utils/format';

export default function NotificationsScreen() {
  const { user } = useAuth();
  return <NotificationFeeds key={`${user?.id ?? ''}:${user?.role ?? ''}`} />;
}

function NotificationFeeds() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const [notices, setNotices] = useState<ReportNotice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const requestVersion = useRef(0);

  const load = useCallback(async (nextPage: number) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError('');
    try {
      const result = await listNotifications(nextPage);
      if (version !== requestVersion.current) return;
      setNotices(current => nextPage === 0 ? result.content
        : [...current, ...result.content.filter(item => !current.some(notice => notice.id === item.id))]);
      if (user?.id != null) void markNoticesSeen(user.id, 'reports', result.content);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      if (version === requestVersion.current) {
        setError(toErrorMessage(err, { fallback: t('more.notifications.loadError') }));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [t, user?.id]);

  useFocusEffect(useCallback(() => {
    void load(0);
    return () => { requestVersion.current++; };
  }, [load]));

  return (
    <Screen>
      <FlatList data={notices} keyExtractor={notice => String(notice.id)}
        contentContainerClassName="gap-3 px-5 py-4"
        onRefresh={() => load(0)} refreshing={loading && page === 0}
        ListHeaderComponent={<View className="gap-3"><Text className="text-2xl font-bold text-ink">{t('more.notifications.title')}</Text>{user?.role !== 'reporter' && <ShopNotices />}</View>}
        ListEmptyComponent={!loading && !error ? (
          <StateView variant="empty" title={t('more.notifications.emptyTitle')} />
        ) : null}
        renderItem={({ item }) => (
          <Pressable disabled={item.type !== 'work_completed' || item.reportId == null} onPress={() => router.push(`/reports/${item.reportId}`)} accessibilityRole="button"><Card>
            <Text className="text-sm font-semibold text-ink">
              {item.type === 'work_completed' ? t('more.notifications.workCompleted', { id: item.reportId }) : t(item.type === 'report_edited' ? 'more.notifications.edited' : 'more.notifications.archived', { id: item.reportId })}
            </Text>
            <Text className="mt-1 text-xs text-subtitle">{formatDate(item.createdAt, true)}</Text>
          </Card></Pressable>
        )}
        ListFooterComponent={error ? (
          <StateView variant="error" description={error} actionLabel={t('more.notifications.retry')} onAction={() => load(0)} />
        ) : hasMore ? (
          <Button variant="secondary" label={t('more.notifications.loadMore')} loading={loading} onPress={() => load(page + 1)} />
        ) : null}
      />
    </Screen>
  );
}

function ShopNotices() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const router = useRouter();
  const [notices, setNotices] = useState<ShopNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const version = useRef(0);
  const load = useCallback(async (next: number) => {
    const token = ++version.current;
    setLoading(true); setError(false);
    try {
      const result = await listShopNotifications(next);
      if (token !== version.current) return;
      setNotices(current => next === 0 ? result.content : [...current, ...result.content.filter(item => !current.some(old => old.id === item.id))]);
      if (user?.id != null) void markNoticesSeen(user.id, 'shop', result.content);
      setPage(next); setHasMore(result.hasMore);
    } catch {
      if (token === version.current) { setNotices([]); setHasMore(false); setError(true); }
    } finally { if (token === version.current) setLoading(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => {
    setNotices([]); setHasMore(false); setPage(0); void load(0);
    return () => { version.current++; };
  }, [load]));
  return <View className="gap-3">
    <Text className="text-lg font-semibold text-ink">{t('shopNotices.title')}</Text>
    {notices.map(item => <Pressable key={item.id} accessibilityRole="button" className="min-h-[44px]" onPress={() => item.type === 'order_placed' ? router.push({ pathname: '/more/shop-orders', params: { orderId: item.orderId } }) : router.push(`/more/shop/${encodeURIComponent(item.orderId)}`)}>
      <Card><Text className="text-sm font-semibold text-ink">{t(item.type === 'order_placed' ? 'shopNotices.placed' : 'shopNotices.shipped', { id: item.orderId })}</Text>
      <Text className="mt-1 text-xs text-ink">{formatDate(item.createdAt, true)}</Text></Card>
    </Pressable>)}
    {loading && <StateView variant="loading" title={t('shopNotices.loading')} />}
    {!loading && !error && notices.length === 0 && <Text className="text-ink">{t('shopNotices.empty')}</Text>}
    {error && <><Text className="text-ink">{t('shopNotices.error')}</Text><Button variant="secondary" label={t('more.notifications.retry')} onPress={() => void load(0)} /></>}
    {hasMore && <Button variant="secondary" label={t('more.notifications.loadMore')} loading={loading} onPress={() => void load(page + 1)} />}
    <Text className="text-lg font-semibold text-ink">{t('shopNotices.reports')}</Text>
  </View>;
}
