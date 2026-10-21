import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  PackageSearch,
  ShoppingBag,
  ShoppingBasket,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { Picker } from '@/components/ui/Picker';
import { ProductCard } from '@/components/ui/ProductCard';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { shopColors, themeColors } from '@/constants/theme';
import { ApiError } from '@/lib/apiClient';
import {
  createOrder,
  loadCatalog,
  listOrders,
  quoteCheckout,
} from '@/services/shop';
import type {
  ShopCatalog,
  ShopOrder,
  ShopProduct,
  ShopQuote,
} from '@/types';
import {
  BasketLine,
  SHOP_SORT_OPTIONS,
  ShopSortKey,
  basketCount,
  matchesProductQuery,
  productCategories,
  safeImageUrl,
  sortProducts,
  toCartPayload,
} from '@/utils/shop';
import { formatDate, formatMoney, fullName } from '@/utils/format';

const ALL_CATEGORIES = 'all';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Shop catalog. Mirrors the public `/shop` page on the web build but lives
 * inside the More stack so the bottom tabs stay visible. The basket and
 * checkout are presented as sheets over the catalog so users can keep
 * browsing while a transaction is in flight.
 *
 * Anonymous browsers can see the catalog; checkout requires a session — the
 * auth gate is enforced at the `createOrder` call.
 */
export default function ShopIndexScreen() {
  const palette = themeColors();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation('common');

  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [sort, setSort] = useState<ShopSortKey>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);

  const [basket, setBasket] = useState<Record<string, number>>({});
  const [activeProduct, setActiveProduct] = useState<ShopProduct | null>(null);
  const [basketSheetOpen, setBasketSheetOpen] = useState(false);
  const [ordersSheetOpen, setOrdersSheetOpen] = useState(false);

  const [checkoutQuote, setCheckoutQuote] = useState<ShopQuote | null>(null);
  const [checkoutQuoting, setCheckoutQuoting] = useState(false);
  const [basketError, setBasketError] = useState<string | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

  const [orders, setOrders] = useState<ShopOrder[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (catalog === null) setLoading(true);
    try {
      const result = await loadCatalog();
      setCatalog(result);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('more.shop.couldNotLoadCatalog'),
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const result = await listOrders();
      setOrders(result);
    } catch (err) {
      setOrdersError(
        err instanceof ApiError ? err.message : t('more.shop.couldNotLoadOrders'),
      );
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (ordersSheetOpen) void loadOrders();
  }, [ordersSheetOpen, loadOrders]);

  // Pre-fill the shipping fields from the signed-in user — the web seeds
  // name / phone / address the same way (`ShopView.vue`).
  useEffect(() => {
    if (!user) return;
    setShippingName((current) =>
      current.length === 0 ? fullName(user.firstName, user.lastName) : current,
    );
    setShippingPhone((current) => current.length === 0 ? user.phone ?? '' : current);
    setShippingAddress((current) => current.length === 0 ? user.address ?? '' : current);
  }, [user]);

  const products = catalog?.products ?? [];
  const categories = useMemo(
    () => [ALL_CATEGORIES, ...productCategories(products)],
    [products],
  );

  const filtered = useMemo(() => {
    const base = products.filter((product) => {
      if (inStockOnly && product.stock <= 0) return false;
      if (category !== ALL_CATEGORIES && product.category !== category) {
        return false;
      }
      return matchesProductQuery(product, query);
    });
    return sortProducts(base, sort);
  }, [products, inStockOnly, category, query, sort]);

  const basketLines: BasketLine[] = useMemo(() => {
    if (!catalog) return [];
    return Object.entries(basket)
      .map(([productId, quantity]) => {
        const product = catalog.products.find((p) => p.id === productId);
        if (!product || quantity <= 0) return null;
        return { product, quantity } satisfies BasketLine;
      })
      .filter((line): line is BasketLine => line !== null);
  }, [basket, catalog]);

  const basketTotalCount = basketCount(basketLines);
  const basketSubtotalMinor = basketLines.reduce(
    (sum, line) => sum + line.product.priceMinor * line.quantity,
    0,
  );

  function setBasketQuantity(productId: string, quantity: number) {
    setBasket((current) => {
      const next = { ...current };
      if (quantity <= 0) {
        delete next[productId];
      } else {
        next[productId] = quantity;
      }
      return next;
    });
  }

  async function openCheckout() {
    if (!catalog || basketLines.length === 0) return;
    // Same gate the web applies: anonymous browsers can browse, but the
    // checkout path requires a session ("Sign in to checkout").
    if (!user) {
      setBasketError(t('more.shop.errors.signInToOrder'));
      return;
    }
    setCheckoutQuoting(true);
    setBasketError(null);
    try {
      const quote = await quoteCheckout(toCartPayload(basketLines));
      setCheckoutQuote(quote);
      setBasketSheetOpen(false);
    } catch (err) {
      // Surface the failure inside the basket sheet so the user can retry.
      setBasketError(
        err instanceof ApiError ? err.message : t('more.shop.errors.refreshQuote'),
      );
    } finally {
      setCheckoutQuoting(false);
    }
  }

  async function placeOrder() {
    if (!checkoutQuote) return;
    if (shippingName.trim().length === 0) {
      setCheckoutError(t('more.shop.errors.shippingName'));
      return;
    }
    if (shippingAddress.trim().length === 0) {
      setCheckoutError(t('more.shop.errors.shippingAddress'));
      return;
    }
    if (!user) {
      setCheckoutError(t('more.shop.errors.signInCheckout'));
      return;
    }
    setCheckoutSubmitting(true);
    setCheckoutError(null);
    try {
      const order = await createOrder({
        items: checkoutQuote.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        shippingName: shippingName.trim(),
        shippingPhone: shippingPhone.trim(),
        shippingAddress: shippingAddress.trim(),
      });
      setBasket({});
      setShippingName('');
      setShippingPhone('');
      setShippingAddress('');
      router.replace(`/more/shop/${order.orderId}`);
    } catch (err) {
      setCheckoutError(
        err instanceof ApiError
          ? err.message
          : t('more.shop.errors.placeOrder'),
      );
    } finally {
      setCheckoutSubmitting(false);
    }
  }

  return (
    <Screen className="bg-shop-shell px-0 pt-0">
      {/* Title bar — mirrors the web's `.shop-titlebar`: eyebrow +
          "A little care starts here." headline, with the Orders button and
          the "Your basket" pill on the right. */}
      <View className="flex-row items-start justify-between gap-3 px-5 pb-2 pt-4">
        <View className="flex-1 pr-3">
          <Text
            className="text-[10px] font-bold uppercase tracking-[1.7px] text-shop-foot-text"
            style={{ letterSpacing: 1.7 }}
          >
            {t('more.shop.kicker')}
          </Text>
          <Text
            className="mt-1 text-[24px] font-bold leading-tight text-shop-ink"
            style={{ letterSpacing: -0.8 }}
          >
            {t('more.shop.headlineBefore')}{' '}
            <Text className="italic text-shop-serif-accent">
              {t('more.shop.headlineAccent')}
            </Text>{' '}
            {t('more.shop.headlineAfter')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {user ? (
            <Pressable
              onPress={() => setOrdersSheetOpen(true)}
              accessibilityRole="button"
              className="rounded-full border border-shop-search-line bg-card px-3 py-2 active:opacity-80"
          >
            <Text
              className="text-[11px] font-semibold text-shop-ink"
            >
              {t('more.shop.orders')}
            </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setBasketSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('more.shop.basketA11y', {
              count: basketTotalCount,
              plural: basketTotalCount === 1 ? '' : 's',
            })}
            className="flex-row items-center gap-1.5 rounded-full border px-3 py-2 active:opacity-80"
            style={{
              backgroundColor: shopColors.shell,
              borderColor: shopColors.searchLine,
            }}
          >
            <ShoppingBag color={shopColors.ink} size={15} />
            <Text
              className="text-[11px] font-semibold text-shop-ink"
            >
              {t('more.shop.basket')}
            </Text>
            <View
              className="ml-0.5 min-w-5 items-center justify-center rounded-full px-1.5"
              style={{ backgroundColor: shopColors.basketBadge }}
            >
              <Text
                className="text-[10px] font-bold text-shop-ink"
              >
                {basketTotalCount}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Values row — mirrors the web's `.shop-values` strip: colour dots
          over a hairline bottom border. */}
      <View className="mb-3 flex-row flex-wrap gap-x-5 gap-y-1 border-b border-shop-values-line px-5 pb-3">
        <ValuePill dotClass="bg-shop-mint" label={t('more.shop.valueTools')} />
        <ValuePill dotClass="bg-shop-coral" label={t('more.shop.valueParts')} />
        <ValuePill dotClass="bg-shop-citron" label={t('more.shop.valueSpaces')} />
      </View>

      <View className="px-5">
        <View className="mb-3">
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t('more.shop.searchPlaceholder')}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 pb-3"
        >
          <Pressable
            onPress={() => setInStockOnly(!inStockOnly)}
            accessibilityRole="button"
            accessibilityState={{ selected: inStockOnly }}
            className={`rounded-full border px-3 py-2 active:opacity-80 ${
              inStockOnly
                ? 'border-shop-mint bg-shop-mint'
                : 'border-shop-tab-line bg-card'
            }`}
          >
            <Text
              className={`text-[11px] font-semibold ${
                inStockOnly ? 'text-shop-ink' : 'text-shop-values-text'
              }`}
            >
              {t('more.shop.inStockOnly')}
            </Text>
          </Pressable>
          {categories.map((value) => {
            const selected = value === category;
            return (
              <Pressable
                key={value}
                onPress={() => setCategory(value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={`rounded-full border px-3 py-2 active:opacity-80 ${
                  selected
                    ? 'border-shop-mint bg-shop-mint'
                    : 'border-shop-tab-line bg-card'
                }`}
              >
                <Text
                  className={`text-[11px] font-semibold ${
                    selected ? 'text-shop-ink' : 'text-shop-values-text'
                  }`}
                >
                  {value === ALL_CATEGORIES ? t('more.shop.allProducts') : value}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mb-3 flex-row items-end justify-between">
          <Text className="text-[10px] uppercase tracking-wide text-shop-foot-text">
            {t('more.shop.productCount', {
              count: filtered.length,
              plural: filtered.length === 1 ? '' : 's',
            })}
          </Text>
          <View className="w-44">
            <Picker
              label={t('more.shop.sortLabel')}
              value={sort}
              onChange={(value) => setSort(value as ShopSortKey)}
              options={SHOP_SORT_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
            />
          </View>
        </View>
      </View>

      {error && catalog === null ? (
        <StateView
          variant="error"
          title={t('more.shop.couldNotLoadCatalogTitle')}
          description={error}
          actionLabel={t('more.shop.retry')}
          onAction={() => {
            void load();
          }}
        />
      ) : catalog === null && loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <StateView
          variant="empty"
          icon={PackageSearch}
          title={t('more.shop.noMatchTitle')}
          description={t('more.shop.noMatchDesc')}
          actionLabel={t('more.shop.clearFilters')}
          onAction={() => {
            setQuery('');
            setCategory(ALL_CATEGORIES);
            setInStockOnly(false);
          }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerClassName="px-5 pb-32"
          columnWrapperStyle={{ columnGap: 12, paddingBottom: 12 }}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              currency={catalog!.currency}
              minorUnitDigits={catalog!.minorUnitDigits}
              onPress={() => setActiveProduct(item)}
            />
          )}
        />
      )}

      {basketTotalCount > 0 ? (
        <View className="pointer-events-box-none absolute bottom-0 left-0 right-0 px-5 pb-6">
          <Pressable
            onPress={() => setBasketSheetOpen(true)}
            accessibilityRole="button"
            className="flex-row items-center justify-between rounded-full px-5 py-3 active:opacity-90"
            style={{
              backgroundColor: shopColors.shell,
              borderColor: shopColors.cardLine,
              borderWidth: 1,
            }}
          >
            <View className="flex-row items-center gap-2">
              <ShoppingBasket color={shopColors.ink} size={18} />
              <Text
                className="text-sm font-semibold text-shop-ink"
              >
                {t('more.shop.basketCount', {
                  count: basketTotalCount,
                  plural: basketTotalCount === 1 ? '' : 's',
                })}{' '}
                ·{' '}
                {catalog
                  ? formatMoney(
                      basketSubtotalMinor,
                      catalog.minorUnitDigits,
                      catalog.currency,
                    )
                  : ''}
              </Text>
            </View>
            <Text
              className="text-sm font-semibold text-shop-ink"
            >
              {t('more.shop.review')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ProductDetailSheet
        product={activeProduct}
        catalog={catalog}
        quantity={activeProduct ? basket[activeProduct.id] ?? 0 : 0}
        onChangeQuantity={(value) =>
          activeProduct ? setBasketQuantity(activeProduct.id, value) : undefined
        }
        onClose={() => setActiveProduct(null)}
        t={t}
      />

      <BasketSheet
        visible={basketSheetOpen}
        onClose={() => setBasketSheetOpen(false)}
        lines={basketLines}
        catalog={catalog}
        onChangeQuantity={setBasketQuantity}
        quoting={checkoutQuoting}
        error={basketError}
        onCheckout={() => {
          void openCheckout();
        }}
        t={t}
      />

      <OrdersSheet
        visible={ordersSheetOpen}
        onClose={() => setOrdersSheetOpen(false)}
        orders={orders}
        loading={ordersLoading}
        error={ordersError}
        onRetry={loadOrders}
        onSelect={(orderId) => {
          setOrdersSheetOpen(false);
          router.push(`/more/shop/${orderId}`);
        }}
        t={t}
      />

      <CheckoutSheet
        visible={checkoutQuote !== null}
        quote={checkoutQuote}
        submitting={checkoutSubmitting}
        error={checkoutError}
        name={shippingName}
        phone={shippingPhone}
        address={shippingAddress}
        onChangeName={setShippingName}
        onChangePhone={setShippingPhone}
        onChangeAddress={setShippingAddress}
        onClose={() => {
          setCheckoutQuote(null);
          setCheckoutError(null);
        }}
        onPlace={placeOrder}
        t={t}
      />
    </Screen>
  );
}

type ProductDetailSheetProps = {
  product: ShopProduct | null;
  catalog: ShopCatalog | null;
  quantity: number;
  onChangeQuantity: (value: number) => void;
  onClose: () => void;
  t: TranslateFn;
};

function ProductDetailSheet({
  product,
  catalog,
  quantity,
  onChangeQuantity,
  onClose,
  t,
}: ProductDetailSheetProps) {
  if (!product) return null;
  const imageUri = safeImageUrl(product.imageUrl);
  const outOfStock = product.stock <= 0;
  return (
    <ModalSheet visible={!!product} title={product.name} onClose={onClose}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          resizeMode="cover"
          style={{ width: '100%', height: 180, borderRadius: 12 }}
        />
      ) : (
        <View className="h-44 items-center justify-center rounded-xl bg-border/40">
          <Text className="text-xs text-muted">{t('more.shop.noImage')}</Text>
        </View>
      )}
      {product.brand ? (
        <Text className="mt-3 text-xs uppercase tracking-wide text-muted">
          {product.brand}
        </Text>
      ) : null}
      <Text className="mt-2 text-base text-ink">
        {product.description ?? t('more.shop.noDescription')}
      </Text>
      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-primary">
          {catalog
            ? formatMoney(product.priceMinor, catalog.minorUnitDigits, catalog.currency)
            : ''}
        </Text>
        <Text
          className={`text-xs ${
            outOfStock ? 'text-tone-danger' : 'text-muted'
          }`}
        >
          {outOfStock
            ? t('more.shop.outOfStock')
            : t('more.shop.inStockCount', { count: product.stock })}
        </Text>
      </View>

      <View className="mt-5 flex-row items-center justify-between">
        <QuantityStepper
          value={quantity > 0 ? quantity : 1}
          onChange={onChangeQuantity}
          min={1}
          max={Math.max(1, product.stock)}
          disabled={outOfStock}
        />
        <Text className="ml-3 flex-1 text-right text-xs text-muted">
          {quantity > 0
            ? t('more.shop.quantityInBasket', { count: quantity })
            : t('more.shop.tapToAdd')}
        </Text>
      </View>
    </ModalSheet>
  );
}

type BasketSheetProps = {
  visible: boolean;
  onClose: () => void;
  lines: BasketLine[];
  catalog: ShopCatalog | null;
  onChangeQuantity: (productId: string, quantity: number) => void;
  quoting: boolean;
  error: string | null;
  onCheckout: () => void;
  t: TranslateFn;
};

function BasketSheet({
  visible,
  onClose,
  lines,
  catalog,
  onChangeQuantity,
  quoting,
  error,
  onCheckout,
  t,
}: BasketSheetProps) {
  return (
    <ModalSheet visible={visible} title={t('more.shop.basket')} onClose={onClose} busy={quoting}>
      {lines.length === 0 ? (
        <StateView
          variant="empty"
          icon={ShoppingBasket}
          title={t('more.shop.emptyBasketTitle')}
          description={t('more.shop.emptyBasketDesc')}
        />
      ) : (
        <View>
          {lines.map((line) => (
            <View
              key={line.product.id}
              className="mb-3 flex-row items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold text-ink"
                  numberOfLines={2}
                >
                  {line.product.name}
                </Text>
                <Text className="mt-0.5 text-xs text-muted">
                  {catalog
                    ? formatMoney(
                        line.product.priceMinor,
                        catalog.minorUnitDigits,
                        catalog.currency,
                      )
                    : ''}
                </Text>
                <Pressable
                  onPress={() => onChangeQuantity(line.product.id, 0)}
                  accessibilityRole="button"
                  accessibilityLabel={t('more.shop.removeA11y', {
                    name: line.product.name,
                  })}
                  className="mt-1 self-start active:opacity-70"
                >
                  <Text className="text-[11px] font-medium text-tone-danger underline">
                    {t('more.shop.remove')}
                  </Text>
                </Pressable>
              </View>
              <QuantityStepper
                value={line.quantity}
                onChange={(value) => onChangeQuantity(line.product.id, value)}
                // min = 0 so a line can be stepped down to nothing — the
                // stepper then removes it from the basket, matching the
                // web's per-line "Remove" affordance.
                min={0}
                max={Math.max(1, line.product.stock)}
              />
            </View>
          ))}

          {catalog ? (
            <View className="mb-3 flex-row items-center justify-between rounded-lg bg-border/30 px-3 py-2">
              <Text className="text-xs font-medium text-muted">{t('more.shop.subtotal')}</Text>
              <Text className="text-sm font-semibold text-ink">
                {formatMoney(
                  lines.reduce(
                    (sum, line) =>
                      sum + line.product.priceMinor * line.quantity,
                    0,
                  ),
                  catalog.minorUnitDigits,
                  catalog.currency,
                )}
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text className="mb-2 text-xs text-tone-danger">{error}</Text>
          ) : null}

          <View className="mt-2 flex-row items-center gap-2">
            <Button
              label={quoting ? t('more.shop.quoting') : t('more.shop.continueCheckout')}
              loading={quoting}
              onPress={onCheckout}
              className="flex-1"
            />
          </View>
        </View>
      )}
    </ModalSheet>
  );
}

type OrdersSheetProps = {
  visible: boolean;
  onClose: () => void;
  orders: ShopOrder[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (orderId: string) => void;
  t: TranslateFn;
};

function OrdersSheet({
  visible,
  onClose,
  orders,
  loading,
  error,
  onRetry,
  onSelect,
  t,
}: OrdersSheetProps) {
  const palette = themeColors();
  return (
    <ModalSheet visible={visible} title={t('more.shop.myOrders')} onClose={onClose}>
      {loading ? (
        <View className="py-6">
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : error ? (
        <StateView
          variant="error"
          title={t('more.shop.couldNotLoadOrdersTitle')}
          description={error}
          actionLabel={t('more.shop.retry')}
          onAction={onRetry}
        />
      ) : !orders || orders.length === 0 ? (
        <StateView
          variant="empty"
          title={t('more.shop.noOrdersTitle')}
          description={t('more.shop.noOrdersDesc')}
        />
      ) : (
        orders.map((order) => (
          <Pressable
            key={order.orderId}
            onPress={() => onSelect(order.orderId)}
            accessibilityRole="button"
            className="mb-2 rounded-xl border border-border bg-card p-3 active:opacity-80"
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-ink">
                #{order.orderId}
              </Text>
              <Text className="text-xs uppercase tracking-wide text-muted">
                {order.status.replaceAll('_', ' ')}
              </Text>
            </View>
            <Text className="mt-0.5 text-xs text-muted">
              {t('more.shop.basketCount', {
                count: order.items.length,
                plural: order.items.length === 1 ? '' : 's',
              })}{' '}
              ·{' '}
              {formatMoney(order.totalMinor, order.minorUnitDigits, order.currency)}
            </Text>
            <Text className="mt-0.5 text-xs text-muted">
              {formatDate(order.createdAt, true)}
            </Text>
          </Pressable>
        ))
      )}
    </ModalSheet>
  );
}

type CheckoutSheetProps = {
  visible: boolean;
  quote: ShopQuote | null;
  submitting: boolean;
  error: string | null;
  name: string;
  phone: string;
  address: string;
  onChangeName: (value: string) => void;
  onChangePhone: (value: string) => void;
  onChangeAddress: (value: string) => void;
  onClose: () => void;
  onPlace: () => void;
  t: TranslateFn;
};

function CheckoutSheet({
  visible,
  quote,
  submitting,
  error,
  name,
  phone,
  address,
  onChangeName,
  onChangePhone,
  onChangeAddress,
  onClose,
  onPlace,
  t,
}: CheckoutSheetProps) {
  if (!visible || !quote) return null;
  return (
    <ModalSheet
      visible={visible}
      title={t('more.shop.checkout')}
      onClose={onClose}
      busy={submitting}
      footer={
        <Button
          label={submitting ? t('more.shop.placing') : t('more.shop.placeOrder')}
          loading={submitting}
          onPress={onPlace}
        />
      }
    >
      <View className="mb-3 rounded-xl border border-border bg-card p-3">
        <Text className="text-sm font-semibold text-ink">
          {t('more.shop.orderSummary')}
        </Text>
        {quote.lines.length === 0 ? (
          <Text className="mt-2 text-xs text-muted">
            {t('more.shop.emptyCheckout')}
          </Text>
        ) : (
          quote.lines.map((line) => (
            <View
              key={line.productId}
              className="mt-2 flex-row items-center justify-between"
            >
              <Text className="flex-1 text-xs text-ink" numberOfLines={1}>
                {line.name} · ×{line.quantity}
              </Text>
              <Text className="text-xs text-muted">
                {formatMoney(
                  line.lineTotalMinor,
                  quote.minorUnitDigits,
                  quote.currency,
                )}
              </Text>
            </View>
          ))
        )}
        {quote.lines.length > 0 ? (
          <View className="mt-3 border-t border-border pt-2">
            <SummaryRow
              label={t('more.shop.subtotal')}
              value={formatMoney(
                quote.subtotalMinor,
                quote.minorUnitDigits,
                quote.currency,
              )}
            />
            <SummaryRow
              label={t('more.shop.shipping')}
              value={formatMoney(
                quote.shippingMinor,
                quote.minorUnitDigits,
                quote.currency,
              )}
            />
            <SummaryRow
              label={t('more.shop.tax')}
              value={formatMoney(
                quote.taxMinor,
                quote.minorUnitDigits,
                quote.currency,
              )}
            />
            <View className="mt-2 border-t border-border pt-2">
              <SummaryRow
                label={t('more.shop.total')}
                bold
                value={formatMoney(
                  quote.totalMinor,
                  quote.minorUnitDigits,
                  quote.currency,
                )}
              />
            </View>
          </View>
        ) : null}
      </View>

      <TextField
        label={t('more.shop.shippingNameLabel')}
        value={name}
        onChangeText={onChangeName}
        placeholder={t('more.shop.fullNamePlaceholder')}
        autoCapitalize="words"
      />
      <TextField
        label={t('more.shop.phoneLabel')}
        value={phone}
        onChangeText={onChangePhone}
        keyboardType="phone-pad"
      />
      <TextField
        label={t('more.shop.shippingAddressLabel')}
        value={address}
        onChangeText={onChangeAddress}
        placeholder={t('more.shop.addressPlaceholder')}
        autoCapitalize="words"
        multiline
        numberOfLines={2}
      />

      {error ? <Text className="text-xs text-tone-danger">{error}</Text> : null}
    </ModalSheet>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text
        className={`text-xs ${bold ? 'font-semibold text-ink' : 'text-muted'}`}
      >
        {label}
      </Text>
      <Text
        className={`text-xs ${bold ? 'font-semibold text-ink' : 'text-muted'}`}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Small color dot + label pair used in the values strip beneath the title
 * bar (mirrors the web's `.shop-values` row, which renders 11px dots in
 * mint / coral / citron). Stays inline so the strip can wrap on narrow
 * phones.
 */
function ValuePill({
  dotClass,
  label,
}: {
  dotClass: string;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <Text className="text-[11px] text-shop-values-text">{label}</Text>
    </View>
  );
}
