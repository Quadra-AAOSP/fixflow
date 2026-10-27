import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Check, CreditCard, ShoppingBag } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { shopColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  quoteCheckout,
  createOrder,
  listOrders,
} from '@/services/shop';
import type {
  ShopQuote,
  ShopOrder,
} from '@/types';
import { formatMoney } from '@/utils/shop';
import { useCartStore } from '@/stores/cart';

/**
 * Shop checkout flow. Mirrors `ShopCheckoutView.vue`:
 *
 * 1. Review basket
 * 2. Request quote
 * 3. Display totals
 * 4. Submit order
 * 5. Handle payment
 * 6. Show order confirmation
 */

export default function ShopCheckoutScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const shopPalette = shopColors();
  const router = useRouter();
  const { user } = useAuth();

  const { getCartPayload, clearBasket } = useCartStore();
  const [quote, setQuote] = useState<ShopQuote | null>(null);
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBasket = useCallback(async () => {
    const cartPayload = getCartPayload();
    if (cartPayload.length > 0) {
      setBasket({
        items: cartPayload,
        currency: 'NGN',
        minorUnitDigits: 2,
      });
    } else {
      setBasket(null);
    }
  }, []);

  const requestQuote = useCallback(async () => {
    if (!basket) return;
    setLoading(true);
    setError(null);
    try {
      const quote = await quoteCheckout(basket);
      setQuote(quote);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('shop.checkout.quoteFail'),
      );
    } finally {
      setLoading(false);
    }
  }, [basket, t]);

  const submitOrder = useCallback(async () => {
    if (!quote) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder(quote);
      setOrder(order);
      // Clear basket after successful order
      clearBasket();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('shop.checkout.orderFail'),
      );
    } finally {
      setSubmitting(false);
    }
  }, [quote, t, clearBasket]);

  useEffect(() => {
    void loadBasket();
  }, [loadBasket]);

  useEffect(() => {
    if (basket && basket.items.length > 0) {
      void requestQuote();
    }
  }, [basket, requestQuote]);

  if (loading && !quote) {
    return (
      <Screen>
        <StateView variant="loading" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <StateView
          variant="error"
          title={t('shop.checkout.errorTitle')}
          description={error}
          actionLabel={t('shop.checkout.retry')}
          onAction={() => {
            setError(null);
            if (basket) {
              void requestQuote();
            } else {
              void loadBasket();
            }
          }}
        />
      </Screen>
    );
  }

  if (order) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <Card>
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Check size={48} color={shopPalette.mint} />
              <Text style={{ fontSize: 20, fontWeight: '600', color: palette.ink }}>
                {t('shop.checkout.orderSuccess')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, textAlign: 'center' }}>
                {t('shop.checkout.orderNumber', { number: order.publicId })}
              </Text>
            </View>
          </Card>

          <Card>
            <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink, marginBottom: 8 }}>
              {t('shop.checkout.orderDetails')}
            </Text>
            <Button
              variant="primary"
              onPress={() => router.push(`/more/shop/${order.publicId}`)}
              style={{ marginTop: 16, alignSelf: 'center' }}
            >
              {t('shop.checkout.viewOrder')}
            </Button>
            <View style={{ gap: 8 }}>
              {order.items.map((item) => (
                <View
                  key={item.productId}
                  style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                >
                  <Text style={{ fontSize: 14, color: palette.subtitle }}>
                    {item.name} × {item.quantity}
                  </Text>
                  <Text style={{ fontSize: 14, color: palette.ink }}>
                    {formatMoney(item.priceMinor, order.minorUnitDigits, order.currency)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: palette.subtitle }}>
                  {t('shop.checkout.subtotal')}
                </Text>
                <Text style={{ fontSize: 14, color: palette.ink }}>
                  {formatMoney(order.subtotalMinor, order.minorUnitDigits, order.currency)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: palette.subtitle }}>
                  {t('shop.checkout.tax')}
                </Text>
                <Text style={{ fontSize: 14, color: palette.ink }}>
                  {formatMoney(order.taxMinor, order.minorUnitDigits, order.currency)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: palette.subtitle }}>
                  {t('shop.checkout.total')}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '600', color: shopPalette.price }}>
                  {formatMoney(order.totalMinor, order.minorUnitDigits, order.currency)}
                </Text>
              </View>
            </View>
          </Card>


        </ScrollView>
      </Screen>
    );
  }

  if (!quote || !basket || basket.items.length === 0) {
    return (
      <Screen>
        <StateView
          variant="empty"
          title={t('shop.checkout.emptyBasketTitle')}
          description={t('shop.checkout.emptyBasketDesc')}
          actionLabel={t('shop.checkout.continueShopping')}
          onAction={() => router.push('/more/shop')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Card>
          <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink, marginBottom: 8 }}>
            {t('shop.checkout.reviewOrder')}
          </Text>
          <View style={{ gap: 8 }}>
            {basket.items.map((item) => (
              <View
                key={item.productId}
                style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 14, color: palette.subtitle }}>
                  {item.name} × {item.quantity}
                </Text>
                <Text style={{ fontSize: 14, color: palette.ink }}>
                  {formatMoney(item.priceMinor, basket.minorUnitDigits, basket.currency)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink, marginBottom: 8 }}>
            {t('shop.checkout.paymentDetails')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CreditCard size={20} color={palette.subtitle} />
            <Text style={{ fontSize: 14, color: palette.subtitle }}>
              {t('shop.checkout.creditCard')}
            </Text>
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink, marginBottom: 8 }}>
            {t('shop.checkout.orderSummary')}
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: palette.subtitle }}>
                {t('shop.checkout.subtotal')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.ink }}>
                {formatMoney(quote.subtotalMinor, quote.minorUnitDigits, quote.currency)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: palette.subtitle }}>
                {t('shop.checkout.tax')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.ink }}>
                {formatMoney(quote.taxMinor, quote.minorUnitDigits, quote.currency)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border }}>
              <Text style={{ fontSize: 14, color: palette.subtitle }}>
                {t('shop.checkout.total')}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: shopPalette.price }}>
                {formatMoney(quote.totalMinor, quote.minorUnitDigits, quote.currency)}
              </Text>
            </View>
          </View>
        </Card>

        <Button
          variant="primary"
          onPress={submitOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={shopPalette.card} />
          ) : (
            t('shop.checkout.placeOrder')
          )}
        </Button>
      </ScrollView>
    </Screen>
  );
}