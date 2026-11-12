import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight, Package, RefreshCw } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { useAuth } from '@/hooks/useAuth';
import { dashboardColors, shopColors } from '@/constants/theme';
import { ApiError } from '@/lib/apiClient';
import { advanceManagerOrder, getManagerOrder, listManagerOrders } from '@/services/shop';
import type { ShopManagerOrder } from '@/types/shop';
import { formatDate, formatMoney } from '@/utils/format';
import { shortOrderRef } from '@/utils/shop';
import { PRODUCT_IMAGES } from '@/utils/shopImages';

/**
 * Shop manager / admin view of every customer order. The list leads with what
 * needs attention (newest first, action-highlighted status chips) and the
 * detail view mirrors the shopper's own order page so staff see what the
 * customer sees, plus the fulfilment actions.
 */
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
  const refresh = () => {
    if (detail) void openOrder(detail.orderId);
    else void loadPage(0, ++generation.current);
  };

  const money = (order: ShopManagerOrder, value: number) =>
    formatMoney(value, order.minorUnitDigits, order.currency);

  if (!authorized || activeScope !== scope) {
    return (
      <Screen>
        <StateView variant="empty" title={t('orderManagement.unavailable')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-12 pt-5">
        {detail ? (
          <ManagerOrderDetail order={detail} money={money} onAdvance={advance} onBack={back} t={t} />
        ) : (
          <ManagerOrderList
            orders={orders}
            money={money}
            loading={loading}
            error={error}
            hasMore={hasMore}
            onRefresh={refresh}
            onLoadMore={() => void loadPage(page + 1, generation.current)}
            onOpen={(id) => void openOrder(id)}
            t={t}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  List                                                                      */
/* -------------------------------------------------------------------------- */

type ListProps = {
  orders: ShopManagerOrder[];
  money: (order: ShopManagerOrder, value: number) => string;
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
};

function ManagerOrderList({ orders, money, loading, error, hasMore, onRefresh, onLoadMore, onOpen, t }: ListProps) {
  return (
    <>
      {/* The stack header already shows the screen title; this row adds the
          one-line explanation plus a refresh control. */}
      <View className="mb-4 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-[12px] leading-4 text-muted">
          {t('orderManagement.subtitle')}
        </Text>
        <Pressable
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel={t('orderManagement.refresh')}
          hitSlop={8}
          disabled={loading}
          className="h-9 w-9 items-center justify-center rounded-full border border-border bg-card active:opacity-70"
        >
          <RefreshCw color={shopColors.productBody} size={15} />
        </Pressable>
      </View>

      {error ? (
        <StateView
          variant="error"
          title={t('orderManagement.error')}
          actionLabel={t('orderManagement.retry')}
          onAction={onRefresh}
        />
      ) : !loading && orders.length === 0 ? (
        <StateView variant="empty" title={t('orderManagement.empty')} />
      ) : null}

      {orders.map((order) => {
        const chip = statusChip(order);
        return (
          <Pressable
            key={order.orderId}
            onPress={() => onOpen(order.orderId)}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={`${t('orderManagement.viewOrder')} #${shortOrderRef(order.orderId)}`}
            className="mb-2 rounded-[14px] border border-border bg-card p-3 active:opacity-80"
          >
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-[13px] font-bold text-ink">
                #{shortOrderRef(order.orderId)}
              </Text>
              <View
                className="rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: chip.bg,
                  borderWidth: chip.bg === 'transparent' ? 1 : 0,
                  borderColor: shopColors.cardLine,
                }}
              >
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: chip.ink }}
                >
                  {statusLabel(order, t)}
                </Text>
              </View>
            </View>

            <View className="mt-1.5 flex-row items-end justify-between gap-2">
              <Text numberOfLines={2} className="flex-1 text-[12px] leading-4 text-muted">
                {order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
              </Text>
              <Text className="text-[15px] font-bold text-ink">
                {money(order, order.totalMinor)}
              </Text>
            </View>

            <View className="mt-2 flex-row items-center justify-between border-t border-border pt-2">
              <Text numberOfLines={1} className="flex-1 text-[11px] text-muted">
                {formatDate(order.createdAt, true)} · {order.shippingName}
              </Text>
              <View className="ml-2 flex-row items-center gap-0.5">
                <Text className="text-[11px] font-medium text-muted">
                  {t('orderManagement.viewOrder')}
                </Text>
                <ChevronRight color={shopColors.footText} size={13} />
              </View>
            </View>
          </Pressable>
        );
      })}

      {hasMore ? (
        <Button
          variant="secondary"
          label={t('orderManagement.more')}
          onPress={onLoadMore}
          loading={loading}
          className="mt-1"
        />
      ) : null}
    </>
  );
}

/** Fall back to the payment state for orders that never reached fulfilment. */
function statusLabel(
  order: ShopManagerOrder,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  return order.fulfillmentStatus
    ? t(`orderManagement.status.${order.fulfillmentStatus}`)
    : t(`more.shop.orderStatus.${order.status}`);
}

/** Chip colour: citron = needs action, mint = in flight, quiet = settled. */
function statusChip(order: ShopManagerOrder): { bg: string; ink: string } {
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return { bg: 'transparent', ink: shopColors.footText };
  }
  if (order.status === 'pending_payment') {
    return { bg: shopColors.basketBadge, ink: shopColors.mintInk };
  }
  switch (order.fulfillmentStatus) {
    case 'processing':
    case 'shipped':
      return { bg: shopColors.mint, ink: shopColors.mintInk };
    case 'delivered':
      return { bg: 'transparent', ink: shopColors.productFoot };
    default:
      return { bg: shopColors.basketBadge, ink: shopColors.mintInk };
  }
}

/* -------------------------------------------------------------------------- */
/*  Detail                                                                    */
/* -------------------------------------------------------------------------- */

type DetailProps = {
  order: ShopManagerOrder;
  money: (order: ShopManagerOrder, value: number) => string;
  onAdvance: (status: 'processing' | 'shipped') => void;
  onBack: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
};

function ManagerOrderDetail({ order, money, onAdvance, onBack, t }: DetailProps) {
  // Marking an order shipped notifies the customer, so it confirms inline
  // (Alert.alert is a no-op on react-native-web).
  const [confirmingShipped, setConfirmingShipped] = useState(false);

  useEffect(() => setConfirmingShipped(false), [order.orderId]);

  const chip = statusChip(order);

  return (
    <>
      <Pressable
        onPress={onBack}
        accessibilityRole="link"
        className="mb-3 flex-row items-center gap-1 self-start active:opacity-70"
      >
        <ArrowLeft color={dashboardColors.teal} size={15} />
        <Text className="text-[11px] font-semibold" style={{ color: dashboardColors.teal }}>
          {t('orderManagement.back')}
        </Text>
      </Pressable>

      {/* Header — short reference, status, and when it landed. */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className="text-[24px] font-bold leading-7 text-ink"
            style={{ letterSpacing: -0.6 }}
          >
            #{shortOrderRef(order.orderId)}
          </Text>
          <Text className="mt-1 text-[11px] text-muted">
            {t('more.shop.placed', { date: formatDate(order.createdAt, true) })}
          </Text>
        </View>
        <View
          className="rounded-full px-3 py-1.5"
          style={{
            backgroundColor: chip.bg,
            borderWidth: chip.bg === 'transparent' ? 1 : 0,
            borderColor: shopColors.cardLine,
          }}
        >
          <Text className="text-[11px] font-semibold" style={{ color: chip.ink }}>
            {statusLabel(order, t)}
          </Text>
        </View>
      </View>

      {/* Items */}
      <View className="mb-2 mt-5 flex-row items-center justify-between">
        <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
          {t('orderManagement.items')}
        </Text>
        <Text className="text-[11px] text-muted">
          {t('more.shop.itemsCount', {
            count: order.items.reduce((sum, item) => sum + item.quantity, 0),
            plural: order.items.length === 1 ? '' : 's',
          })}
        </Text>
      </View>
      <Card padded={false} className="mb-4">
        {order.items.map((item, index) => (
          <View
            key={`${item.productId}-${index}`}
            className={`flex-row items-center gap-3 px-4 py-3 ${
              index > 0 ? 'border-t border-border' : ''
            }`}
          >
            <ItemThumb productId={item.productId} />
            <View className="flex-1">
              <Text className="text-[13px] font-semibold text-ink" numberOfLines={2}>
                {item.name}
              </Text>
              <Text className="mt-0.5 text-[11px] text-muted">
                {money(order, item.unitPriceMinor)} · ×{item.quantity}
              </Text>
            </View>
            <Text className="text-[13px] font-semibold text-ink">
              {money(order, item.lineTotalMinor)}
            </Text>
          </View>
        ))}
      </Card>

      {/* Totals */}
      <Card className="mb-4">
        <Row label={t('more.shop.subtotal')} value={money(order, order.subtotalMinor)} />
        <Row label={t('more.shop.shipping')} value={money(order, order.shippingMinor)} />
        <Row label={t('more.shop.tax')} value={money(order, order.taxMinor)} />
        <View className="mt-2 border-t border-border pt-2">
          <Row label={t('orderManagement.total')} value={money(order, order.totalMinor)} bold />
        </View>
      </Card>

      {/* Recipient */}
      <Text className="mb-2 text-[10px] font-bold uppercase text-muted" style={{ letterSpacing: 1.1 }}>
        {t('more.shop.deliverTo')}
      </Text>
      <Card className="mb-4">
        <Row label={t('orderManagement.recipient')} value={order.shippingName} />
        {order.shippingPhone ? (
          <Row label={t('orderManagement.phone')} value={order.shippingPhone} />
        ) : null}
        <Row label={t('orderManagement.address')} value={order.shippingAddress} />
        <Row
          label={t('orderManagement.payment')}
          value={
            order.paymentStatus
              ? t(`orderManagement.paymentStatus.${order.paymentStatus}`)
              : '--'
          }
        />
        {order.deliverySignedName ? (
          <Row label={t('orderManagement.signedBy')} value={order.deliverySignedName} />
        ) : null}
        {order.deliveryConfirmedAt ? (
          <Row
            label={t('orderManagement.confirmedAt')}
            value={formatDate(order.deliveryConfirmedAt, true)}
          />
        ) : null}
      </Card>

      {/* Fulfilment actions */}
      {order.allowedTransitions.length > 0 ? (
        <Card className="mb-4">
          <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
            {t('orderManagement.actions')}
          </Text>
          {confirmingShipped ? (
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 text-[11px] leading-4 text-muted">
                {t('orderManagement.shipConfirmBody')}
              </Text>
              <Pressable
                onPress={() => setConfirmingShipped(false)}
                accessibilityRole="button"
                className="rounded-full border border-border px-3 py-1.5 active:opacity-70"
              >
                <Text className="text-[11px] font-semibold text-ink">
                  {t('orderManagement.notNow')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setConfirmingShipped(false);
                  onAdvance('shipped');
                }}
                accessibilityRole="button"
                className="rounded-full px-3 py-1.5 active:opacity-80"
                style={{ backgroundColor: shopColors.mint }}
              >
                <Text className="text-[11px] font-semibold" style={{ color: shopColors.mintInk }}>
                  {t('orderManagement.action.shipped')}
                </Text>
              </Pressable>
            </View>
          ) : (
            order.allowedTransitions.map((status) => (
              <Button
                key={status}
                label={t(`orderManagement.action.${status}`)}
                onPress={() =>
                  status === 'shipped' ? setConfirmingShipped(true) : onAdvance(status)
                }
                disabled={confirmingShipped}
                className={status === 'shipped' ? 'mt-0' : 'mb-2'}
              />
            ))
          )}
        </Card>
      ) : null}

      {/* Settled orders show a quiet receipt note instead of actions. */}
      {order.fulfillmentStatus === 'delivered' && order.deliverySignedName ? (
        <View className="mb-4 flex-row items-center gap-2 px-1">
          <Package color={shopColors.footText} size={13} />
          <Text className="flex-1 text-[11px] text-muted">
            {t('orderManagement.signedBy')}: {order.deliverySignedName}
          </Text>
        </View>
      ) : null}
    </>
  );
}

/** Item thumbnail from the bundled catalogue map, or the neutral placeholder. */
function ItemThumb({ productId }: { productId: string }) {
  const source = PRODUCT_IMAGES[productId];
  if (!source) {
    return (
      <View
        className="h-11 w-11 items-center justify-center rounded-lg bg-shop-image-bg"
        accessibilityRole="image"
      >
        <Package color={shopColors.footText} size={17} />
      </View>
    );
  }
  return (
    <Image
      source={source}
      resizeMode="cover"
      // Explicit size: bundled assets carry intrinsic pixel sizes that
      // react-native-web prefers over layout classes.
      style={{ width: 44, height: 44, borderRadius: 8 }}
      accessibilityIgnoresInvertColors
    />
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className={`text-xs ${bold ? 'font-semibold text-ink' : 'text-muted'}`}>
        {label}
      </Text>
      <Text
        className={`text-sm ${bold ? 'font-semibold text-ink' : 'text-ink'}`}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}
