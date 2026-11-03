import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { shopColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { quoteCheckout, createOrder } from '@/services/shop';
import type {
  ShopCartItemPayload,
  ShopCreateOrderResult,
  ShopQuote,
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
 * 5. Send the customer to the provider's hosted payment page
 * 6. Show the created-order confirmation
 *
 * Payment settlement is owned by the backend provider webhook. The app only
 * opens the hosted checkout page and never marks an order paid locally.
 */

export default function ShopCheckoutScreen() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const shopPalette = shopColors;
  const router = useRouter();
  const { user } = useAuth();

  const { getCartPayload, clearBasket } = useCartStore();
  const [basket, setBasket] = useState<ShopCartItemPayload[] | null>(null);
  const [basketError, setBasketError] = useState<string | null>(null);
  const [quote, setQuote] = useState<ShopQuote | null>(null);
  const [order, setOrder] = useState<ShopCreateOrderResult | null>(null);
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBasket = useCallback(async () => {
    const items = getCartPayload();
    setBasket(items.length > 0 ? items : null);
  }, [getCartPayload]);

  // Validate basket before checkout
  const validateBasket = useCallback(() => {
    if (!basket || basket.length === 0) {
      setBasketError(t('more.shop.emptyCheckout'));
      return false;
    }
    return true;
  }, [basket, t]);

  const requestQuote = useCallback(async () => {
    if (!basket) return;
    setLoading(true);
    setError(null);
    try {
      const quote = await quoteCheckout(basket);
      setQuote(quote);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('more.shop.errors.refreshQuote'),
      );
    } finally {
      setLoading(false);
    }
  }, [basket, t]);

  const submitOrder = useCallback(async () => {
    if (!quote || !user || !basket) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!validateBasket()) return;
      // Validate shipping information
      if (!shippingName.trim() || !shippingPhone.trim() || !shippingAddress.trim()) {
        setError(t('more.shop.errors.shippingName'));
        return;
      }

      const created = await createOrder({
        items: basket,
        shippingName: shippingName.trim(),
        shippingPhone: shippingPhone.trim(),
        shippingAddress: shippingAddress.trim(),
      });
      setOrder(created);
      clearBasket();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError(t('more.shop.errors.signInCheckout'));
        } else if (err.status === 403) {
          setError(t('more.shop.errors.signInCheckout'));
        } else {
          setError(err.message);
        }
      } else {
        setError(t('more.shop.errors.placeOrder'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [quote, user, basket, shippingName, shippingPhone, shippingAddress, validateBasket, t, clearBasket]);

  // Opens the provider-hosted payment page. The webhook confirms payment.
  const handlePaymentConfirmation = useCallback(async () => {
    if (!order?.checkoutUrl) return;
    try {
      await Linking.openURL(order.checkoutUrl);
    } catch {
      setError(t('more.shop.errors.devPayment'));
    }
  }, [order, t]);

  useEffect(() => {
    void loadBasket();
  }, [loadBasket]);

  useEffect(() => {
    if (basket && basket.length > 0) {
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
          title={t('more.shop.errorTitle')}
          description={error}
          actionLabel={t('more.shop.retry')}
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
                {t('more.shop.orderSuccess', { id: order.orderId })}
              </Text>
              <Text style={{ fontSize: 14, color: palette.subtitle, textAlign: 'center' }}>
                {t('more.shop.orderNumber', { id: order.orderId })}
              </Text>
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: palette.subtitle }}>
                {t('more.shop.total')}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.primary }}>
                {formatMoney(
                  order.totalMinor,
                  quote?.minorUnitDigits ?? 2,
                  quote?.currency ?? 'NGN',
                )}
              </Text>
            </View>
            {order.checkoutUrl ? (
              <Button variant="primary" onPress={handlePaymentConfirmation}>
                {t('more.shop.payNow')}
              </Button>
            ) : (
              <Text style={{ fontSize: 12, color: palette.subtitle }}>
                {t('more.shop.devPaymentNote')}
              </Text>
            )}
          </Card>

          <Button variant="secondary" onPress={() => router.replace('/more/shop')}>
            {t('more.shop.backToShop')}
          </Button>
        </ScrollView>
      </Screen>
    );
  }

  if (!quote || !basket || basket.length === 0) {
    return (
      <Screen>
        <StateView
          variant="empty"
          title={t('more.shop.emptyBasketTitle')}
          description={t('more.shop.emptyBasketDesc')}
          actionLabel={t('more.shop.backToShop')}
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
            {t('more.shop.orderSummary')}
          </Text>
          <View style={{ gap: 8 }}>
            {quote.lines.map((line) => (
              <View
                key={line.productId}
                style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <Text style={{ fontSize: 14, color: palette.subtitle }}>
                  {line.name} × {line.quantity}
                </Text>
                <Text style={{ fontSize: 14, color: palette.ink }}>
                  {formatMoney(line.lineTotalMinor, quote.minorUnitDigits, quote.currency)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink, marginBottom: 8 }}>
            {t('more.shop.shipping')}
          </Text>
          <TextField
            label={t('more.shop.shippingNameLabel')}
            value={shippingName}
            onChangeText={setShippingName}
            placeholder={t('more.shop.fullNamePlaceholder')}
          />
          <TextField
            label={t('more.shop.phoneLabel')}
            value={shippingPhone}
            onChangeText={setShippingPhone}
            placeholder={t('more.shop.phoneLabel')}
            keyboardType="phone-pad"
          />
          <TextField
            label={t('more.shop.shippingAddressLabel')}
            value={shippingAddress}
            onChangeText={setShippingAddress}
            placeholder={t('more.shop.addressPlaceholder')}
            multiline
          />
        </Card>

        <Card>
          <Text style={{ fontSize: 16, fontWeight: '600', color: palette.ink, marginBottom: 8 }}>
            {t('more.shop.orderSummary')}
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: palette.subtitle }}>
                {t('more.shop.subtotal')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.ink }}>
                {formatMoney(quote.subtotalMinor, quote.minorUnitDigits, quote.currency)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: palette.subtitle }}>
                {t('more.shop.tax')}
              </Text>
              <Text style={{ fontSize: 14, color: palette.ink }}>
                {formatMoney(quote.taxMinor, quote.minorUnitDigits, quote.currency)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border }}>
              <Text style={{ fontSize: 14, color: palette.subtitle }}>
                {t('more.shop.total')}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.primary }}>
                {formatMoney(quote.totalMinor, quote.minorUnitDigits, quote.currency)}
              </Text>
            </View>
          </View>
        </Card>

        {basketError ? (
          <Text style={{ fontSize: 12, color: palette.subtitle }}>{basketError}</Text>
        ) : null}

        <Button
          variant="primary"
          onPress={submitOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={palette.card} />
          ) : (
            t('more.shop.placeOrder')
          )}
        </Button>
      </ScrollView>
    </Screen>
  );
}
