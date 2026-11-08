import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { advanceManagerOrder, getManagerOrder, listManagerOrders } from '@/services/shop';
import type { ShopManagerOrder } from '@/types/shop';
import { formatMoney } from '@/utils/format';

export default function ShopOrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();
  const requestedId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { t } = useTranslation('common');
  const authorized = user?.role === 'shop_manager' || user?.role === 'super_admin';
  const scope = `${user?.id ?? ''}:${user?.role ?? ''}`;
  const generation = useRef(0);
  const [activeScope, setActiveScope] = useState('');
  const [orders, setOrders] = useState<ShopManagerOrder[]>([]);
  const [detail, setDetail] = useState<ShopManagerOrder | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fail = useCallback((err: unknown) => {
    if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
      setOrders([]); setDetail(null); setHasMore(false);
    }
    setError(true);
  }, []);

  const loadPage = useCallback(async (next: number, token: number) => {
    setLoading(true); setError(false);
    try {
      const result = await listManagerOrders(next);
      if (token !== generation.current) return;
      setOrders(previous => next === 0 ? result.content : [...previous, ...result.content]);
      setPage(next); setHasMore(result.hasMore);
    } catch (err) { if (token === generation.current) fail(err); }
    finally { if (token === generation.current) setLoading(false); }
  }, [fail]);

  const openOrder = useCallback(async (id: string) => {
    const token = ++generation.current;
    setLoading(true); setError(false); setDetail(null);
    try {
      const result = await getManagerOrder(id);
      if (token === generation.current) setDetail(result);
    } catch (err) { if (token === generation.current) fail(err); }
    finally { if (token === generation.current) setLoading(false); }
  }, [fail]);

  useFocusEffect(useCallback(() => {
    const token = ++generation.current;
    setOrders([]); setDetail(null); setHasMore(false); setError(false); setLoading(false); setActiveScope(scope);
    if (authorized) {
      if (requestedId) void openOrder(requestedId);
      else void loadPage(0, token);
    }
    return () => { generation.current++; };
  }, [authorized, scope, requestedId, loadPage, openOrder]));

  const advance = async (status: 'processing' | 'shipped') => {
    if (!detail) return;
    const token = ++generation.current;
    setLoading(true); setError(false);
    try {
      const result = await advanceManagerOrder(detail.orderId, status);
      if (token === generation.current) setDetail(result);
    } catch (err) { if (token === generation.current) fail(err); }
    finally { if (token === generation.current) setLoading(false); }
  };
  const back = () => {
    const token = ++generation.current;
    setDetail(null);
    if (requestedId) router.setParams({ orderId: undefined });
    else void loadPage(0, token);
  };
  const money = (order: ShopManagerOrder, value: number) => formatMoney(value, order.minorUnitDigits, order.currency);

  return <Screen><ScrollView contentContainerClassName="p-5 gap-4">
    <Text className="text-2xl font-bold text-ink">{t('orderManagement.title')}</Text>
    {!authorized || activeScope !== scope ? <StateView variant="empty" title={t('orderManagement.unavailable')} /> : <>
      {detail && <Button variant="secondary" label={t('orderManagement.back')} onPress={back} disabled={loading} />}
      <Button variant="secondary" label={t('orderManagement.refresh')} onPress={() => detail ? void openOrder(detail.orderId) : void loadPage(0, ++generation.current)} disabled={loading} />
      {error && <StateView variant="error" description={t('orderManagement.error')} />}
      {loading && <StateView variant="loading" title={t('orderManagement.loading')} />}
      {detail ? <Card className="gap-3">
        <Text className="text-lg font-bold text-ink">{detail.orderId}</Text>
        <Text className="text-ink">{t('orderManagement.fulfillment')}: {detail.fulfillmentStatus ? t(`orderManagement.status.${detail.fulfillmentStatus}`) : '--'}</Text>
        <Text className="text-ink">{t('orderManagement.payment')}: {detail.paymentStatus}</Text>
        <Text className="text-ink">{t('orderManagement.recipient')}: {detail.shippingName}</Text>
        <Text className="text-ink">{t('orderManagement.phone')}: {detail.shippingPhone}</Text>
        <Text className="text-ink">{t('orderManagement.address')}: {detail.shippingAddress}</Text>
        <Text className="font-bold text-ink">{t('orderManagement.items')}</Text>
        {detail.items.map((item, index) => <Text key={`${item.productId}-${index}`} className="text-ink">{item.name} x {item.quantity} | {money(detail, item.lineTotalMinor)}</Text>)}
        <Text className="font-bold text-ink">{t('orderManagement.total')}: {money(detail, detail.totalMinor)}</Text>
        {detail.deliverySignedName && <Text className="text-ink">{t('orderManagement.signedBy')}: {detail.deliverySignedName}</Text>}
        {detail.deliveryConfirmedAt && <Text className="text-ink">{t('orderManagement.confirmedAt')}: {new Date(detail.deliveryConfirmedAt).toLocaleString()}</Text>}
        {detail.allowedTransitions.map(status => <Button key={status} label={t(`orderManagement.action.${status}`)} onPress={() => void advance(status)} disabled={loading} />)}
      </Card> : <View className="gap-3">
        {!loading && !error && orders.length === 0 && <StateView variant="empty" title={t('orderManagement.empty')} />}
        {orders.map(order => <Pressable key={order.orderId} accessibilityRole="button" onPress={() => void openOrder(order.orderId)} disabled={loading}>
          <Card className="min-h-[44px] gap-1"><Text className="font-bold text-ink">{order.orderId}</Text><Text className="text-ink">{order.fulfillmentStatus ? t(`orderManagement.status.${order.fulfillmentStatus}`) : '--'} | {money(order, order.totalMinor)}</Text></Card>
        </Pressable>)}
        {hasMore && <Button variant="secondary" label={t('orderManagement.more')} onPress={() => void loadPage(page + 1, generation.current)} disabled={loading} />}
        {error && <Button variant="secondary" label={t('orderManagement.retry')} onPress={back} disabled={loading} />}
      </View>}
    </>}
  </ScrollView></Screen>;
}
