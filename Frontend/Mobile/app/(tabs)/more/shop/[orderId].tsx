import { Stack, Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Package,
  ShieldCheck,
} from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { StateView } from '@/components/ui/StateView';
import { useAuth } from '@/hooks/useAuth';
import { dashboardColors, shopColors } from '@/constants/theme';
import { ApiError } from '@/lib/apiClient';
import {
  cancelOrder,
  confirmDelivery,
  completeDevPayment,
  getOrder,
} from '@/services/shop';
import type { ShopOrder } from '@/types';
import { formatDate, formatMoney } from '@/utils/format';
import {
  canConfirmReceipt,
  canShopPurchase,
  isSandboxCheckoutUrl,
  shortOrderRef,
} from '@/utils/shop';
import { PRODUCT_IMAGES } from '@/utils/shopImages';

/** One entry per stop in the order's life, in display order. */
type Step = { key: string; label: string; done: boolean; at: string | null };

/**
 * Order detail and payment. The screen is the post-checkout landing page, so
 * it leads with what the shopper has to do next (pay, wait, or confirm
 * receipt) rather than with database bookkeeping.
 */
export default function OrderDetailScreen() {
  const { user } = useAuth();
  const { orderId } = useLocalSearchParams<{ orderId?: string | string[] }>();
  if (!canShopPurchase(user?.role)) {
    return (
      <Redirect
        href={user?.role === 'reporter' ? '/more' : '/more/shop-orders'}
      />
    );
  }
  return <OrderDetailContent key={`${user?.id ?? ''}:${user?.role ?? ''}:${orderId}`} />;
}

function OrderDetailContent() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const publicId = Array.isArray(orderId) ? orderId[0] : orderId;
  const { t } = useTranslation('common');

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [received, setReceived] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  function handleError(err: unknown, fallback: string) {
    if (err instanceof ApiError && [401, 403, 404].includes(err.status)) {
      setOrder(null);
      setSignedName('');
      setReceived(false);
    }
    setError(err instanceof ApiError ? err.message : fallback);
  }

  const load = useCallback(async () => {
    if (!publicId) return;
    setError(null);
    if (order === null) setLoading(true);
    try {
      setOrder(await getOrder(publicId));
    } catch (err) {
      handleError(err, t('more.shop.couldNotLoadOrder'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Cancel is confirmed inline rather than through `Alert.alert`, which is a
   * no-op on react-native-web — the button used to do nothing in the browser.
   */
  async function onCancel() {
    if (!order) return;
    setConfirmingCancel(false);
    setActing(true);
    try {
      setOrder(await cancelOrder(order.orderId));
    } catch (err) {
      handleError(err, t('more.shop.errors.cancelOrder'));
    } finally {
      setActing(false);
    }
  }

  /**
   * Pay. A hosted gateway opens its own page; the local dev provider settles
   * in-app so the demo can run end-to-end without a real card form.
   */
  async function onPay() {
    if (!order) return;
    setActing(true);
    setError(null);
    try {
      if (isSandboxCheckoutUrl(order.checkoutUrl)) {
        setOrder(await completeDevPayment(order.orderId));
        return;
      }
      await Linking.openURL(order.checkoutUrl as string);
    } catch (err) {
      handleError(err, t('more.shop.errors.devPayment'));
    } finally {
      setActing(false);
    }
  }

  async function onConfirmDelivery() {
    const name = signedName.trim();
    if (!order?.canConfirmDelivery || !canConfirmReceipt(name, received) || acting) {
      return;
    }
    setActing(true);
    setError(null);
    try {
      setOrder(await confirmDelivery(order.orderId, name));
      setSignedName('');
      setReceived(false);
    } catch (err) {
      handleError(err, t('orderReceipt.error'));
    } finally {
      setActing(false);
    }
  }

  if (!publicId) {
    return (
      <Screen>
        <StateView variant="empty" title={t('more.shop.orderNotFound')} />
      </Screen>
    );
  }

  if (loading && order === null) {
    return (
      <Screen>
        <StateView variant="loading" title={t('review.loading')} />
      </Screen>
    );
  }

  if (error && order === null) {
    return (
      <Screen>
        <StateView
          variant="error"
          title={t('more.shop.couldNotLoadOrderTitle')}
          description={error}
          actionLabel={t('more.shop.retry')}
          onAction={() => {
            void load();
          }}
        />
      </Screen>
    );
  }

  if (!order) return null;

  const money = (value: number) =>
    formatMoney(value, order.minorUnitDigits, order.currency);
  const ref = shortOrderRef(order.orderId);
  const sandbox = isSandboxCheckoutUrl(order.checkoutUrl);
  const paid = order.status === 'paid' || order.status === 'fulfilled';
  const dead = order.status === 'cancelled' || order.status === 'refunded';
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const steps: Step[] = [
    { key: 'placed', label: t('more.shop.steps.placed'), done: true, at: order.createdAt },
    { key: 'paid', label: t('more.shop.steps.paid'), done: paid, at: null },
    {
      key: 'processing',
      label: t('more.shop.steps.processing'),
      done: !!order.processingAt,
      at: order.processingAt,
    },
    {
      key: 'shipped',
      label: t('more.shop.steps.shipped'),
      done: !!order.shippedAt,
      at: order.shippedAt,
    },
    {
      key: 'delivered',
      label: t('more.shop.steps.delivered'),
      done: !!order.deliveryConfirmedAt,
      at: order.deliveryConfirmedAt,
    },
  ];

  const statusLabel =
    order.status === 'paid' && order.fulfillmentStatus
      ? t(`orderManagement.status.${order.fulfillmentStatus}`)
      : t(`more.shop.orderStatus.${order.status}`);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('more.shop.orderTitle', { id: ref }) }} />
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/more/shop')}
          className="mb-3 flex-row items-center gap-1 self-start active:opacity-70"
        >
          <ArrowLeft color={dashboardColors.teal} size={15} />
          <Text className="text-[11px] font-semibold" style={{ color: dashboardColors.teal }}>
            {t('more.shop.backToShop')}
          </Text>
        </Pressable>

        {/* Header — short reference up front, full id kept as provenance. */}
        <Text
          className="text-[9px] font-bold uppercase text-shop-foot-text"
          style={{ letterSpacing: 1.5 }}
        >
          {t('more.shop.orderScreenTitle')}
        </Text>
        <View className="mt-1 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text
              className="text-[24px] font-bold leading-7 text-ink"
              style={{ letterSpacing: -0.6 }}
            >
              #{ref}
            </Text>
            <Text className="mt-1 text-[11px] text-dashboard-subtitle">
              {t('more.shop.placed', { date: formatDate(order.createdAt, true) })}
            </Text>
          </View>
          <View
            className="rounded-full px-3 py-1.5"
            style={{
              backgroundColor: dead
                ? 'transparent'
                : paid
                  ? shopColors.mint
                  : shopColors.basketBadge,
            }}
          >
            <Text
              className={`text-[11px] font-semibold ${dead ? 'text-tone-danger' : 'text-shop-ink'}`}
              style={dead ? undefined : { color: shopColors.mintInk }}
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        {error ? (
          <View className="mt-3 rounded-xl border border-tone-danger bg-card px-3 py-2">
            <Text className="text-[12px] text-tone-danger">{error}</Text>
          </View>
        ) : null}

        {/* What to do next, stated once at the top. Fixed mint/citron fills
            (with dark ink) keep this readable in both colour modes. */}
        <View
          className={`mt-3 rounded-[14px] px-3 py-2.5 ${
            dead ? 'border border-tone-danger' : ''
          }`}
          style={{
            backgroundColor: dead
              ? 'transparent'
              : paid
                ? shopColors.mint
                : shopColors.basketBadge,
          }}
        >
          <Text
            className={`text-[12px] leading-5 ${dead ? 'text-tone-danger' : 'text-shop-ink'}`}
            style={dead ? undefined : { color: shopColors.mintInk }}
          >
            {order.status === 'cancelled'
              ? t('more.shop.orderCancelledBanner')
              : order.status === 'refunded'
                ? t('more.shop.orderRefundedBanner')
                : paid
                  ? t('more.shop.paymentReceived')
                  : t('more.shop.paymentPendingBanner')}
          </Text>
        </View>

        {/* Progress — hidden once the order is dead, where it would lie. */}
        {!dead ? (
          <Card className="mb-4 mt-4">
            <Text className="mb-3 text-[10px] font-bold uppercase text-dashboard-subtitle" style={{ letterSpacing: 1.1 }}>
              {t('more.shop.orderProgress')}
            </Text>
            {steps.map((step, index) => {
              const isLast = index === steps.length - 1;
              return (
                <View key={step.key} className="flex-row">
                  <View className="mr-3 items-center">
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 22,
                        height: 22,
                        backgroundColor: step.done ? shopColors.mint : 'transparent',
                        borderWidth: step.done ? 0 : 1,
                        borderColor: shopColors.cardLine,
                      }}
                    >
                      {step.done ? <Check color={shopColors.mintInk} size={13} strokeWidth={3} /> : null}
                    </View>
                    {!isLast ? (
                      <View
                        style={{
                          width: 1,
                          flex: 1,
                          minHeight: 18,
                          backgroundColor: shopColors.cardLine,
                        }}
                      />
                    ) : null}
                  </View>
                  <View className={`flex-1 ${isLast ? 'pb-0' : 'pb-4'}`}>
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`text-[12px] ${
                          step.done ? 'font-semibold text-ink' : 'text-dashboard-caption'
                        }`}
                      >
                        {step.label}
                      </Text>
                      {step.at ? (
                        <Text className="text-[10px] text-dashboard-caption">
                          {formatDate(step.at, true)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}

        {/* Items */}
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
            {t('more.shop.items')}
          </Text>
          <Text className="text-[11px] text-dashboard-caption">
            {t('more.shop.itemsCount', {
              count: itemCount,
              plural: itemCount === 1 ? '' : 's',
            })}
          </Text>
        </View>
        <Card padded={false} className="mb-4">
          {order.items.map((item, index) => (
            <View
              key={item.productId}
              className={`flex-row items-center gap-3 px-4 py-3 ${
                index > 0 ? 'border-t border-dashboard-card-line' : ''
              }`}
            >
              <OrderItemImage productId={item.productId} />
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-ink" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="mt-0.5 text-[11px] text-dashboard-subtitle">
                  {money(item.unitPriceMinor)} · ×{item.quantity}
                </Text>
              </View>
              <Text className="text-[13px] font-semibold text-ink">
                {money(item.lineTotalMinor)}
              </Text>
            </View>
          ))}
        </Card>

        {/* Payment summary */}
        <Card className="mb-4">
          <Row label={t('more.shop.subtotal')} value={money(order.subtotalMinor)} />
          <Row label={t('more.shop.shipping')} value={money(order.shippingMinor)} />
          <Row label={t('more.shop.tax')} value={money(order.taxMinor)} />
          <View className="mt-2 border-t border-dashboard-card-line pt-2">
            <Row label={t('more.shop.total')} value={money(order.totalMinor)} bold />
          </View>
        </Card>

        {/* Delivery */}
        <Text className="mb-2 text-[10px] font-bold uppercase text-dashboard-subtitle" style={{ letterSpacing: 1.1 }}>
          {t('more.shop.deliverTo')}
        </Text>
        <Card className="mb-4">
          <Row label={t('more.shop.nameLabel')} value={order.shippingName} />
          {order.shippingPhone ? (
            <Row label={t('more.shop.phoneLabel')} value={order.shippingPhone} />
          ) : null}
          <Row label={t('more.shop.addressLabel')} value={order.shippingAddress} />
        </Card>

        {/* Payment action */}
        {order.status === 'pending_payment' ? (
          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
                {t('more.shop.payment')}
              </Text>
              <View className="flex-row items-center gap-1.5 rounded-full bg-shop-mint px-2.5 py-1">
                <CreditCard color={shopColors.mintInk} size={12} />
                <Text
                  className="text-[10px] font-semibold text-shop-ink"
                  style={{ color: shopColors.mintInk }}
                >
                  {sandbox ? t('more.shop.paymentSandbox') : t('more.shop.providerCheckout')}
                </Text>
              </View>
            </View>

            <View className="mt-3 flex-row items-baseline justify-between">
              <Text className="text-[12px] text-muted">{t('more.shop.amountDue')}</Text>
              <Text className="text-[22px] font-bold text-ink">{money(order.totalMinor)}</Text>
            </View>

            <Button
              className="mt-3"
              label={
                acting
                  ? t('more.shop.completing')
                  : t('more.shop.payAmount', { amount: money(order.totalMinor) })
              }
              loading={acting}
              onPress={onPay}
            />

            <View className="mt-2 flex-row items-center justify-center gap-1.5">
              <ShieldCheck color={shopColors.footText} size={12} />
              <Text className="text-[10px] text-dashboard-caption">
                {sandbox
                  ? t('more.shop.paymentSandboxNote')
                  : t('more.shop.payAfterPlace')}
              </Text>
            </View>

            <View className="mt-3 border-t border-dashboard-card-line pt-2">
              {confirmingCancel ? (
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-[11px] leading-4 text-dashboard-caption">
                    {t('more.shop.cancelOrderBody')}
                  </Text>
                  <Pressable
                    onPress={() => setConfirmingCancel(false)}
                    accessibilityRole="button"
                    className="rounded-full border border-dashboard-card-line px-3 py-1.5 active:opacity-70"
                  >
                    <Text className="text-[11px] font-semibold text-ink">
                      {t('more.shop.keepOrder')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onCancel}
                    accessibilityRole="button"
                    className="rounded-full px-3 py-1.5 active:opacity-80"
                    style={{ backgroundColor: shopColors.coral }}
                  >
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: shopColors.mintInk }}
                    >
                      {t('more.shop.confirmCancel')}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View className="items-center">
                  <Pressable
                    onPress={() => setConfirmingCancel(true)}
                    disabled={acting}
                    accessibilityRole="button"
                    className={`active:opacity-70 ${acting ? 'opacity-50' : ''}`}
                  >
                    <Text className="text-[11px] font-medium text-tone-danger underline">
                      {t('more.shop.cancelOrder')}
                    </Text>
                  </Pressable>
                  <Text className="mt-1 text-[10px] text-dashboard-caption">
                    {t('more.shop.cancelOrderHint')}
                  </Text>
                </View>
              )}
            </View>
          </Card>
        ) : null}

        {/* Receipt confirmation once the parcel has shipped. */}
        {order.canConfirmDelivery ? (
          <Card className="mb-4">
            <Text className="mb-2 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('more.shop.confirmDeliveryTitle')}
            </Text>
            <TextField
              label={t('orderReceipt.name')}
              value={signedName}
              onChangeText={setSignedName}
              maxLength={160}
              editable={!acting}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: received, disabled: acting }}
              onPress={() => setReceived(!received)}
              disabled={acting}
              className="mb-3 min-h-[44px] flex-row items-center gap-3"
            >
              <View
                className="h-5 w-5 items-center justify-center rounded border"
                style={{
                  borderColor: received ? dashboardColors.teal : dashboardColors.cardLine,
                  backgroundColor: received ? shopColors.mint : 'transparent',
                }}
              >
                {received ? <Check color={shopColors.mintInk} size={13} strokeWidth={3} /> : null}
              </View>
              <Text className="flex-1 text-[13px] text-ink">
                {t('orderReceipt.received')}
              </Text>
            </Pressable>
            <Button
              label={t('orderReceipt.submit')}
              onPress={onConfirmDelivery}
              loading={acting}
              disabled={!canConfirmReceipt(signedName, received)}
            />
          </Card>
        ) : null}

        {paid && !order.canConfirmDelivery && !dead ? (
          <View className="mb-4 flex-row items-center gap-2 px-1">
            <Package color={shopColors.footText} size={13} />
            <Text className="flex-1 text-[11px] text-dashboard-caption">
              {t('more.shop.preparingOrder')}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => router.replace('/more/shop')}
          accessibilityRole="link"
          className="self-center rounded-lg border border-dashboard-card-line bg-dashboard-card-bg px-4 py-2 active:opacity-70"
        >
          <Text className="text-sm font-medium" style={{ color: dashboardColors.teal }}>
            {t('more.shop.backToShop')}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

/** Item thumbnail from the bundled catalogue map, or the neutral placeholder. */
function OrderItemImage({ productId }: { productId: string }) {
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
