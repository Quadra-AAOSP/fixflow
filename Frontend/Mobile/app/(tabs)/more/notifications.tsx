import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { toErrorMessage } from '@/lib/apiClient';
import { listNotifications, type ReportNotice } from '@/services/notifications';
import { formatDate } from '@/utils/format';

export default function NotificationsScreen() {
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
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (err) {
      if (version === requestVersion.current) {
        setError(toErrorMessage(err, { fallback: t('more.notifications.loadError') }));
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [t]);

  useFocusEffect(useCallback(() => {
    void load(0);
    return () => { requestVersion.current++; };
  }, [load]));

  return (
    <Screen>
      <FlatList data={notices} keyExtractor={notice => String(notice.id)}
        contentContainerClassName="gap-3 px-5 py-4"
        onRefresh={() => load(0)} refreshing={loading && page === 0}
        ListHeaderComponent={<Text className="text-2xl font-bold text-ink">{t('more.notifications.title')}</Text>}
        ListEmptyComponent={!loading && !error ? (
          <StateView variant="empty" title={t('more.notifications.emptyTitle')} />
        ) : null}
        renderItem={({ item }) => (
          <Card>
            <Text className="text-sm font-semibold text-ink">
              {t(item.type === 'report_edited' ? 'more.notifications.edited' : 'more.notifications.archived', { id: item.reportId })}
            </Text>
            <Text className="mt-1 text-xs text-subtitle">{formatDate(item.createdAt, true)}</Text>
          </Card>
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
