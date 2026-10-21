import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, CreditCard, ExternalLink, X } from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { dashboardColors, themeColors } from '@/constants/theme';
import { ApiError } from '@/lib/apiClient';
import {
  cancelOrder,
  completeDevPayment,
  getOrder,
} from '@/services/shop';
import type { ShopOrder } from '@/types';
import { formatDate, formatMoney } from '@/utils/format';

/**
 * Order detail. Reads the order ID from the route, fetches it, and shows the
 * full breakdown. Pending orders expose a "complete dev payment" CTA so the
 * dev-only payment provider can settle an order end-to-end without a real
 * payment gateway.
 */
export default function OrderDetailScreen() {
  const palette = themeColors();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string | string[] }>();
  const publicId = Array.isArray(orderId) ? orderId[0] : orderId;
  const { t } = useTranslation('common');

  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!publicId) return;
    setError(null);
    if (order === null) setLoading(true);
    try {
      const result = await getOrder(publicId);
      setOrder(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('more.shop.couldNotLoadOrder'),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCancel() {
    if (!order) return;
    Alert.alert(t('more.shop.cancelOrderTitle'), t('more.shop.cancelOrderBody'), [
      { text: t('more.shop.keepOrder'), style: 'cancel' },
      {
        text: t('more.shop.cancelOrder'),
        style: 'destructive',
        onPress: async () => {
          setActing(true);
          try {
            const next = await cancelOrder(order.orderId);
            setOrder(next);
          } catch (err) {
            setError(
              err instanceof ApiError
                ? err.message
                : t('more.shop.errors.cancelOrder'),
            );
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  }

  async function onDevComplete() {
    if (!order) return;
    setActing(true);
    try {
      const next = await completeDevPayment(order.orderId);
      setOrder(next);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('more.shop.errors.devPayment'),
      );
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
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
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

  return (
    <Screen>
      <Stack.Screen
        options={{ title: t('more.shop.orderTitle', { id: order.orderId }) }}
      />
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/more/shop')}
          className="mb-2 flex-row items-center gap-1 self-start active:opacity-70"
        >
          <ArrowLeft color={dashboardColors.teal} size={15} />
          <Text
            className="text-[11px] font-semibold"
            style={{ color: dashboardColors.teal }}
          >
            {t('more.shop.backToShop')}
          </Text>
        </Pressable>

        <View className="mb-2 flex-row items-center gap-3">
          <View
            className="rounded-xl p-3"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <CreditCard color={dashboardColors.statMintDeep} size={26} />
          </View>
          <View className="flex-1">
            <Text
              className="text-xl font-bold text-ink"
              style={{ letterSpacing: -0.4 }}
            >
              {t('more.shop.orderTitle', { id: order.orderId })}
            </Text>
            <Text className="mt-0.5 text-xs text-dashboard-subtitle">
              {t('more.shop.placed', { date: formatDate(order.createdAt, true) })}
            </Text>
          </View>
        </View>

        <Card className="mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[10px] uppercase tracking-wide text-dashboard-subtitle">
                {t('more.shop.status')}
              </Text>
              <Text className="mt-0.5 text-base font-semibold text-ink">
                {order.status.replaceAll('_', ' ')}
              </Text>
            </View>
            <View
              className="rounded-md px-3 py-1.5"
              style={{ backgroundColor: dashboardColors.pillBg }}
            >
              <Text
                className="text-xs font-semibold"
                style={{ color: dashboardColors.teal }}
              >
                {order.paymentStatus.replaceAll('_', ' ')}
              </Text>
            </View>
          </View>
          <View className="mt-3">
            <Row
              label={t('more.shop.placedLabel')}
              value={formatDate(order.createdAt, true)}
            />
            <Row
              label={t('more.shop.updatedLabel')}
              value={formatDate(order.updatedAt, true)}
            />
            <Row
              label={t('more.shop.total')}
              value={formatMoney(
                order.totalMinor,
                order.minorUnitDigits,
                order.currency,
              )}
              bold
            />
          </View>
        </Card>

        <Text
          className="mb-2 text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('more.shop.items')}
        </Text>
        <Card padded={false} className="mb-4">
          {order.items.map((item, index) => (
            <View
              key={item.productId}
              className={`px-4 py-3 ${
                index > 0 ? 'border-t border-dashboard-card-line' : ''
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="flex-1 text-sm font-semibold text-ink"
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Text className="text-sm font-semibold text-ink">
                  {formatMoney(
                    item.lineTotalMinor,
                    order.minorUnitDigits,
                    order.currency,
                  )}
                </Text>
              </View>
              <Text className="mt-1 text-xs text-dashboard-subtitle">
                {formatMoney(
                  item.unitPriceMinor,
                  order.minorUnitDigits,
                  order.currency,
                )}{' '}
                · ×{item.quantity}
              </Text>
            </View>
          ))}
        </Card>

        <Text
          className="mb-2 text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('more.shop.shipping')}
        </Text>
        <Card className="mb-4">
          <Row label={t('more.shop.nameLabel')} value={order.shippingName} />
          {order.shippingPhone ? (
            <Row label={t('more.shop.phoneLabel')} value={order.shippingPhone} />
          ) : null}
          <Row label={t('more.shop.addressLabel')} value={order.shippingAddress} />
        </Card>

        {order.status === 'pending_payment' ? (
          <Card className="mb-4">
            <Text
              className="mb-2 text-[15px] font-semibold text-ink"
              style={{ letterSpacing: -0.3 }}
            >
              {t('more.shop.payment')}
            </Text>
            {order.checkoutUrl ? (
              <Pressable
                onPress={() => {
                  // Native WebView isn't bundled yet — surfacing the URL via
                  // a tap-to-copy alert keeps the workflow reachable without
                  // pulling in a heavyweight dependency.
                  Alert.alert(
                    t('more.shop.providerCheckout'),
                    order.checkoutUrl ?? '',
                    [{ text: t('more.shop.ok') }],
                  );
                }}
                accessibilityRole="button"
                className="mb-3 flex-row items-center gap-2 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3 active:opacity-80"
              >
                <ExternalLink color={dashboardColors.teal} size={16} />
                <Text
                  className="flex-1 text-xs"
                  style={{ color: dashboardColors.teal }}
                  numberOfLines={1}
                >
                  {order.checkoutUrl}
                </Text>
              </Pressable>
            ) : null}
            <View className="flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                disabled={acting}
                onPress={onDevComplete}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-[11px] border px-4 py-3 active:opacity-90"
                style={{
                  backgroundColor: dashboardColors.ctaBg,
                  borderColor: dashboardColors.ctaBorder,
                  opacity: acting ? 0.55 : 1,
                }}
              >
                <CreditCard
                  color={dashboardColors.ctaText}
                  size={17}
                  strokeWidth={2.2}
                />
                <Text
                  className="text-[14px] font-semibold"
                  style={{ color: dashboardColors.ctaText }}
                >
                  {acting
                    ? t('more.shop.completing')
                    : t('more.shop.completeDevPayment')}
                </Text>
              </Pressable>
              <Pressable
                onPress={onCancel}
                disabled={acting}
                accessibilityRole="button"
                className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg px-3 py-3 active:opacity-70 ${
                  acting ? 'opacity-50' : ''
                }`}
              >
                <X color={dashboardColors.statCoralDeep} size={16} />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: dashboardColors.statCoralDeep }}
                >
                  {t('more.shop.cancel')}
                </Text>
              </Pressable>
            </View>
            <View className="mt-3 flex-row items-center gap-1.5">
              <CreditCard color={dashboardColors.subtitle} size={12} />
              <Text className="text-[11px] text-dashboard-caption">
                {t('more.shop.devPaymentNote')}
              </Text>
            </View>
          </Card>
        ) : null}

        <Pressable
          onPress={() => router.replace('/more/shop')}
          accessibilityRole="link"
          className="self-center rounded-lg border border-dashboard-card-line bg-dashboard-card-bg px-4 py-2 active:opacity-70"
        >
          <Text
            className="text-sm font-medium"
            style={{ color: dashboardColors.teal }}
          >
            {t('more.shop.backToShop')}
          </Text>
        </Pressable>
      </ScrollView>
    </Screen>
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
      <Text className="text-xs text-muted">{label}</Text>
      <Text
        className={`text-sm ${bold ? 'font-semibold text-ink' : 'text-ink'}`}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}
