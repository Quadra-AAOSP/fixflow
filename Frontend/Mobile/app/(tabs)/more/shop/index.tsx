import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Package,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  ShoppingBasket,
  Trash2,
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
import { useToast } from '@/components/ui/useToastContext';
import { useAuth } from '@/hooks/useAuth';
import { shopColors } from '@/constants/theme';
import { ApiError } from '@/lib/apiClient';
import {
  cancelOrder,
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
  canShopPurchase,
  type BasketLine,
  SHOP_SORT_OPTIONS,
  ShopSortKey,
  basketCount,
  matchesProductQuery,
  productCategories,
  shortOrderRef,
  sortProducts,
  toCartPayload,
} from '@/utils/shop';
import { useCartStore } from '@/stores/cart';
import { formatDate, formatMoney, fullName } from '@/utils/format';
import { PRODUCT_IMAGES, productImageSource } from '@/utils/shopImages';

const ALL_CATEGORIES = 'all'

// Same editorial photography the web shop uses (`ShopView.vue`), bundled with
// the app so the shop looks identical without a network round-trip.
const HERO_IMAGE = PRODUCT_IMAGES['cordless-drill-18v'];
const EDITORIAL_IMAGE = PRODUCT_IMAGES['multi-bit-set'];

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
  const { user } = useAuth();
  if (!canShopPurchase(user?.role)) return <Redirect href={user?.role === 'reporter' ? "/more" : "/more/shop-orders"} />;
  return <ShopPurchaseScreen key={`${user?.id ?? ''}:${user?.role ?? ''}`} />;
}

function ShopPurchaseScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const { showToast } = useToast();

  // Subscribing to the store (instead of calling the getter) is what makes
  // the badge, floating bar, and sheets re-render when the basket changes.
  const basketLines = useCartStore((state) => state.basket);
  const addToBasket = useCartStore((state) => state.addToBasket);
  const updateBasketQuantity = useCartStore(
    (state) => state.updateBasketQuantity,
  );
  const clearBasket = useCartStore((state) => state.clearBasket);
  const syncCatalog = useCartStore((state) => state.syncCatalog);

  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [sort, setSort] = useState<ShopSortKey>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);

  const [activeProduct, setActiveProduct] = useState<ShopProduct | null>(null);
  const [basketSheetOpen, setBasketSheetOpen] = useState(false);
  const [ordersSheetOpen, setOrdersSheetOpen] = useState(false);

  const [checkoutQuote, setCheckoutQuote] = useState<ShopQuote | null>(null);
  const [checkoutQuoting, setCheckoutQuoting] = useState(false);
  const [basketError, setBasketError] = useState<string | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  /** Where the current quote came from — a "Buy now" must not clear the basket. */
  const [checkoutMode, setCheckoutMode] = useState<'basket' | 'buy-now'>('basket');
  /** Flips on the first submit so empty fields only turn red after a try. */
  const [checkoutAttempted, setCheckoutAttempted] = useState(false);
  const [buyNowBusy, setBuyNowBusy] = useState(false);
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

  const [orders, setOrders] = useState<ShopOrder[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const listRef = useRef<FlatList<ShopProduct>>(null);
  const [heroHeight, setHeroHeight] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    if (catalog === null) setLoading(true);
    try {
      const result = await loadCatalog();
      setCatalog(result);
      // Clamp persisted basket quantities to fresh stock / drop sold-out
      // lines — the web store does this on every catalog refresh.
      syncCatalog(result);
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

  const basketTotalCount = basketCount(basketLines);
  const basketSubtotalMinor = basketLines.reduce(
    (sum, line) => sum + line.product.priceMinor * line.quantity,
    0,
  );
  const activeQuantity = activeProduct
    ? basketLines.find((line) => line.product.id === activeProduct.id)
        ?.quantity ?? 0
    : 0;

  async function openCheckout() {
    if (!canShopPurchase(user?.role) || !catalog || basketLines.length === 0) return;
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
      setCheckoutMode('basket');
      setCheckoutAttempted(false);
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

  /**
   * "Buy now" — quote the single item straight from the detail sheet and open
   * checkout, skipping the basket. The basket is left untouched, so a user can
   * buy one thing immediately while keeping what they were collecting.
   */
  async function buyNow(product: ShopProduct, quantity: number) {
    if (!canShopPurchase(user?.role) || !catalog) return;
    if (!user) {
      showToast(t('more.shop.errors.signInToOrder'), 'error');
      return;
    }
    setBuyNowBusy(true);
    try {
      const quote = await quoteCheckout([
        { productId: product.id, quantity: Math.max(1, quantity) },
      ]);
      if (quote.lines.length === 0) {
        showToast(t('more.shop.soldOutJustNow'), 'error');
        await load();
        return;
      }
      setCheckoutMode('buy-now');
      setCheckoutAttempted(false);
      setCheckoutError(null);
      setCheckoutQuote(quote);
      setActiveProduct(null);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : t('more.shop.errors.refreshQuote'),
        'error',
      );
    } finally {
      setBuyNowBusy(false);
    }
  }

  async function placeOrder() {
    if (!canShopPurchase(user?.role) || !checkoutQuote) return;
    setCheckoutAttempted(true);
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
      // A Buy-now order must not wipe the basket the user was curating.
      if (checkoutMode === 'basket') clearBasket();
      setCheckoutQuote(null);
      setCheckoutMode('basket');
      setCheckoutAttempted(false);
      // Reset to the profile values the sheet was pre-filled with, otherwise
      // the next checkout starts with empty required fields.
      setShippingName(fullName(user.firstName, user.lastName));
      setShippingPhone(user.phone ?? '');
      setShippingAddress(user.address ?? '');
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

  // Mirrors the web's `cancelPending`: pending-payment orders can be
  // cancelled from the orders sheet, then the catalog reloads so any
  // reserved stock is reflected in the tiles. The confirmation lives in the
  // sheet itself — `Alert.alert` is a no-op on react-native-web, which made
  // the old cancel button appear broken in the browser build.
  async function cancelPendingOrder(orderId: string) {
    setOrdersError(null);
    try {
      await cancelOrder(orderId);
      await loadOrders();
      await load();
      showToast(t('more.shop.orderCancelledToast'), 'success');
    } catch (err) {
      setOrdersError(
        err instanceof ApiError
          ? err.message
          : t('more.shop.errors.cancelOrder'),
      );
    }
  }

  function scrollToCatalogue() {
    listRef.current?.scrollToOffset({ offset: heroHeight, animated: true });
  }

  return (
    <Screen className="bg-shop-shell px-0 pt-0">
      {user?.role === 'super_admin' || user?.role === 'technician' ? (
        <Pressable accessibilityRole="button" onPress={() => router.replace('/more')}
          className="self-end px-5 pt-3 active:opacity-70">
          <Text className="text-[12px] font-semibold text-ink">{t('tabs.openTools')}</Text>
        </Pressable>
      ) : null}
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
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerClassName="pb-32"
          columnWrapperStyle={{
            columnGap: 12,
            paddingHorizontal: 20,
            marginBottom: 12,
          }}
          ListHeaderComponent={
            <View>
              {/* Hero — mirrors the web's `.shop-hero`: image with the
                  "everyday essentials" note card, then the pill, headline,
                  body copy, CTA, and foot note. The CTA scrolls to the
                  catalogue (the web anchors to `#shop-catalogue`). */}
              <View
                onLayout={(event) => setHeroHeight(event.nativeEvent.layout.height)}
              >
                <View className="mx-5 mb-4 mt-1 overflow-hidden rounded-[20px] bg-shop-hero">
                  <View>
                    <Image
                      source={HERO_IMAGE}
                      style={{ width: '100%', height: 176 }}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                    <View
                      className="absolute bottom-2.5 left-2.5 right-2.5 flex-row items-end justify-between rounded-2xl px-3 py-2"
                      style={{ backgroundColor: shopColors.imageNoteBg }}
                    >
                      <View>
                        <Text
                          className="text-[8px] font-bold uppercase text-shop-foot-text"
                          style={{ letterSpacing: 1.4 }}
                        >
                          {t('more.shop.heroNoteKicker')}
                        </Text>
                        <Text className="text-[13px] font-bold leading-4 text-shop-ink">
                          {t('more.shop.heroNoteA')}
                          {'\n'}
                          {t('more.shop.heroNoteB')}
                        </Text>
                      </View>
                      <ArrowUpRight color={shopColors.ink} size={20} />
                    </View>
                  </View>
                  <View className="px-4 pb-4 pt-3">
                    <View className="flex-row items-center gap-1.5 self-start rounded-full border border-shop-pill-line px-2.5 py-1">
                      <View className="h-1.5 w-1.5 rounded-full bg-shop-pill-dot" />
                      <Text
                        className="text-[8px] font-bold uppercase text-shop-foot-text"
                        style={{ letterSpacing: 1.4 }}
                      >
                        {t('more.shop.heroPill')}
                      </Text>
                    </View>
                    <Text
                      className="mt-2 text-[22px] font-bold leading-7 text-shop-ink"
                      style={{ letterSpacing: -0.6 }}
                    >
                      {t('more.shop.heroTitleA')}
                      {'\n'}
                      <Text className="italic text-shop-serif-accent">
                        {t('more.shop.heroTitleB')}
                      </Text>
                    </Text>
                    <Text className="mt-1.5 text-[12px] leading-5 text-shop-hero-body">
                      {t('more.shop.heroBody')}
                    </Text>
                    <Pressable
                      onPress={scrollToCatalogue}
                      accessibilityRole="button"
                      className="mt-3 flex-row items-center gap-1.5 self-start rounded-full bg-shop-ink px-4 py-2.5 active:opacity-90"
                    >
                      <Text className="text-[12px] font-semibold text-shop-shell">
                        {t('more.shop.heroCta')}
                      </Text>
                      <ArrowRight color={shopColors.shell} size={15} />
                    </Pressable>
                    <View className="mt-3 flex-row items-center gap-1.5">
                      <Text className="text-[13px] text-shop-star">✳</Text>
                      <Text className="text-[11px] text-shop-hero-body">
                        {t('more.shop.heroFoot')}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Values row — mirrors the web's `.shop-values` strip: colour
                  dots over a hairline bottom border. */}
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
                      style={inStockOnly ? { color: shopColors.mintInk } : undefined}
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
                          style={selected ? { color: shopColors.mintInk } : undefined}
                        >
                          {value === ALL_CATEGORIES ? t('more.shop.allProducts') : value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View className="mb-3 flex-row items-end justify-between">
                  <Text className="text-[10px] uppercase tracking-wide text-shop-foot-text">
                    {catalog ? t('more.shop.productCount', {
                      count: filtered.length,
                      plural: filtered.length === 1 ? '' : 's',
                    }) : t('more.shop.loading')}
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
            </View>
          }
          ListEmptyComponent={catalog === null ? (
            <StateView variant="loading" title={t('more.shop.loading')} className="px-5" />
          ) : (
            <View className="px-5">
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
                  // Web's clearFilters also resets the sort control.
                  setSort('featured');
                }}
              />
            </View>
          )}
          ListFooterComponent={
            filtered.length > 0 ? (
              <View className="mx-5 mb-8 mt-4 overflow-hidden rounded-[20px] bg-shop-editorial-bg p-4">
                <Image
                  source={EDITORIAL_IMAGE}
                  style={{ width: '100%', height: 144, borderRadius: 14 }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                <Text
                  className="mt-3 text-[9px] font-bold uppercase text-shop-foot-text"
                  style={{ letterSpacing: 1.6 }}
                >
                  {t('more.shop.editorialKicker')}
                </Text>
                <Text
                  className="mt-1 text-[18px] font-bold text-shop-ink"
                  style={{ letterSpacing: -0.4 }}
                >
                  {t('more.shop.editorialTitle')}
                </Text>
                <Text className="mt-1 text-[12px] leading-5 text-shop-editorial-text">
                  {t('more.shop.editorialBody')}
                </Text>
                <Pressable
                  onPress={scrollToCatalogue}
                  accessibilityRole="button"
                  className="mt-2.5 flex-row items-center gap-1 self-start active:opacity-70"
                >
                  <Text className="text-[12px] font-semibold text-shop-editorial-link">
                    {t('more.shop.editorialCta')}
                  </Text>
                  <ArrowUpRight color={shopColors.editorialLink} size={14} />
                </Pressable>
              </View>
            ) : null
          }
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
        inBasketQuantity={activeQuantity}
        busy={buyNowBusy}
        onAdd={(quantity) => {
          if (!activeProduct) return;
          addToBasket(activeProduct, quantity);
          const next = basketTotalCount + quantity;
          showToast(
            t('more.shop.addedToBasket', {
              name: activeProduct.name,
              count: next,
              plural: next === 1 ? '' : 's',
            }),
            'success',
          );
        }}
        onBuyNow={(quantity) => {
          if (!activeProduct) return;
          void buyNow(activeProduct, quantity);
        }}
        onClose={() => setActiveProduct(null)}
        t={t}
      />

      <BasketSheet
        visible={basketSheetOpen}
        onClose={() => setBasketSheetOpen(false)}
        lines={basketLines}
        catalog={catalog}
        onChangeQuantity={updateBasketQuantity}
        quoting={checkoutQuoting}
        error={basketError}
        onCheckout={() => {
          void openCheckout();
        }}
        onRefresh={() => {
          void load();
        }}
        refreshing={loading}
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
        onCancelOrder={(orderId) => {
          void cancelPendingOrder(orderId);
        }}
        t={t}
      />

      <CheckoutSheet
        visible={checkoutQuote !== null}
        quote={checkoutQuote}
        submitting={checkoutSubmitting}
        error={checkoutError}
        mode={checkoutMode}
        attempted={checkoutAttempted}
        name={shippingName}
        phone={shippingPhone}
        address={shippingAddress}
        onChangeName={setShippingName}
        onChangePhone={setShippingPhone}
        onChangeAddress={setShippingAddress}
        onClose={() => {
          setCheckoutQuote(null);
          setCheckoutError(null);
          setCheckoutAttempted(false);
          setCheckoutMode('basket');
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
  inBasketQuantity: number;
  busy: boolean;
  onAdd: (quantity: number) => void;
  onBuyNow: (quantity: number) => void;
  onClose: () => void;
  t: TranslateFn;
};

/**
 * Product detail. Two exits, matching how people actually shop: "Add to
 * basket" to keep collecting, and "Buy now" to check out this single line
 * immediately. The quantity picker is local to the sheet so both buttons can
 * use it — the basket only changes when Add is pressed.
 */
function ProductDetailSheet({
  product,
  catalog,
  inBasketQuantity,
  busy,
  onAdd,
  onBuyNow,
  onClose,
  t,
}: ProductDetailSheetProps) {
  const [quantity, setQuantity] = useState(1);

  // A different product opens the sheet → start the picker over at one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (product) setQuantity(1);
  }, [product?.id]);

  if (!product) return null;

  const imageSource = productImageSource(product);
  const outOfStock = product.stock <= 0;
  const money = (value: number) =>
    catalog ? formatMoney(value, catalog.minorUnitDigits, catalog.currency) : '';
  const stockLabel = outOfStock
    ? t('more.shop.outOfStock')
    : product.stock <= 5
      ? t('more.shop.stockLeft', { count: product.stock })
      : t('more.shop.inStockCount', { count: product.stock });

  return (
    <ModalSheet
      visible={!!product}
      title={t('more.shop.productDetails')}
      onClose={onClose}
      busy={busy}
      footer={
        <View>
          <View className="mb-3 flex-row items-baseline justify-between">
            <Text className="text-[12px] text-muted">
              {t('more.shop.itemTotal')}
            </Text>
            <Text className="text-[18px] font-bold text-ink">
              {money(product.priceMinor * quantity)}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Button
              variant="secondary"
              label={t('more.shop.addToBasket')}
              onPress={() => onAdd(quantity)}
              disabled={outOfStock || busy}
              className="flex-1"
            />
            <Button
              label={busy ? t('more.shop.buyNowBusy') : t('more.shop.buyNow')}
              onPress={() => onBuyNow(quantity)}
              disabled={outOfStock || busy}
              className="flex-1"
            />
          </View>
          <Text className="mt-2 text-center text-[11px] text-muted">
            {outOfStock
              ? t('more.shop.outOfStockHint')
              : t('more.shop.buyNowNote')}
          </Text>
        </View>
      }
    >
      {imageSource ? (
        <Image
          source={imageSource}
          resizeMode="cover"
          style={{ width: '100%', height: 220, borderRadius: 14 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View className="h-52 items-center justify-center gap-1 rounded-[14px] bg-shop-image-bg">
          <Package color={shopColors.footText} size={38} />
          <Text className="text-[11px] text-muted">{t('more.shop.noImage')}</Text>
        </View>
      )}

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        {product.category ? (
          <View className="rounded-full border border-shop-tab-line bg-card px-2.5 py-1">
            <Text
              className="text-[9px] font-bold uppercase text-shop-foot-text"
              style={{ letterSpacing: 1.1 }}
            >
              {product.category}
            </Text>
          </View>
        ) : null}
        <View
          className="rounded-full px-2.5 py-1"
          style={{ backgroundColor: outOfStock ? 'transparent' : shopColors.mint }}
        >
          <Text
            className={`text-[10px] font-semibold ${
              outOfStock ? 'text-tone-danger' : 'text-shop-ink'
            }`}
            style={outOfStock ? undefined : { color: shopColors.mintInk }}
          >
            {stockLabel}
          </Text>
        </View>
      </View>

      <Text
        className="mt-2 text-[21px] font-bold leading-7 text-shop-ink"
        style={{ letterSpacing: -0.4 }}
      >
        {product.name}
      </Text>
      {product.brand ? (
        <Text className="mt-0.5 text-[12px] text-shop-product-body">
          {product.brand}
        </Text>
      ) : null}
      <Text className="mt-2.5 text-[20px] font-bold text-shop-ink">
        {money(product.priceMinor)}
      </Text>
      <Text className="mt-2 text-[13px] leading-5 text-shop-editorial-text">
        {product.description ?? t('more.shop.noDescription')}
      </Text>

      {outOfStock ? null : (
        <View className="mt-4 rounded-[14px] border border-shop-card-line bg-card px-3 py-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[12px] font-semibold text-ink">
              {t('more.shop.quantityLabel')}
            </Text>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={Math.max(1, product.stock)}
            />
          </View>
          {inBasketQuantity > 0 ? (
            <Text className="mt-2 text-[11px] text-muted">
              {t('more.shop.alreadyInBasket', { count: inBasketQuantity })}
            </Text>
          ) : null}
        </View>
      )}
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
  onRefresh: () => void;
  refreshing: boolean;
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
  onRefresh,
  refreshing,
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
              className="mb-3 rounded-[14px] border border-border bg-card p-3"
            >
              <View className="flex-row gap-3">
                {/* Thumbnail — the web cart line leads with a 64px product
                    image (`.shop-cart-line` grid). Imageless products get the
                    web's neutral Package placeholder, not a substitute photo. */}
                <BasketLineImage product={line.product} t={t} />
                <View className="flex-1">
                  <Text
                    className="text-[13px] font-semibold text-ink"
                    numberOfLines={2}
                  >
                    {line.product.name}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-muted">
                    {catalog
                      ? t('more.shop.each', {
                          price: formatMoney(
                            line.product.priceMinor,
                            catalog.minorUnitDigits,
                            catalog.currency,
                          ),
                        })
                      : ''}
                  </Text>
                  {catalog ? (
                    <Text className="mt-1 text-[13px] font-semibold text-ink">
                      {formatMoney(
                        line.product.priceMinor * line.quantity,
                        catalog.minorUnitDigits,
                        catalog.currency,
                      )}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => onChangeQuantity(line.product.id, 0)}
                  accessibilityRole="button"
                  accessibilityLabel={t('more.shop.removeA11y', {
                    name: line.product.name,
                  })}
                  hitSlop={8}
                  className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
                >
                  <Trash2 color={shopColors.footText} size={15} />
                </Pressable>
              </View>
              <View className="mt-2.5 flex-row items-center justify-between border-t border-border pt-2.5">
                <QuantityStepper
                  value={line.quantity}
                  onChange={(value) => onChangeQuantity(line.product.id, value)}
                  min={1}
                  max={Math.max(1, line.product.stock)}
                />
                <Text className="text-[10px] text-muted">
                  {line.quantity >= line.product.stock
                    ? t('more.shop.stockLeft', { count: line.product.stock })
                    : t('more.shop.inStockCount', { count: line.product.stock })}
                </Text>
              </View>
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

          {/* Same expectation-setting notes the web basket carries: totals
              firm up at checkout, and nothing is reserved until then. */}
          <Text className="mb-1 text-[11px] leading-4 text-muted">
            {t('more.shop.basketTotalsNote')}
          </Text>
          <Text className="mb-3 text-[11px] leading-4 text-muted">
            {t('more.shop.basketNote')}
          </Text>

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

          {/* Mirrors the web basket's "Refresh prices & availability" — the
              catalog reload updates line prices and stock caps. */}
          <Pressable
            onPress={onRefresh}
            disabled={refreshing}
            accessibilityRole="button"
            className="mt-2 flex-row items-center justify-center gap-1.5 rounded-[11px] border border-shop-card-line px-4 py-2.5 active:opacity-70"
            style={{ opacity: refreshing ? 0.55 : 1 }}
          >
            <RefreshCw color={shopColors.footText} size={13} />
            <Text className="text-[12px] font-medium text-shop-foot-text">
              {t('more.shop.refreshPrices')}
            </Text>
          </Pressable>
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
  onCancelOrder: (orderId: string) => void;
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
  onCancelOrder,
  t,
}: OrdersSheetProps) {
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);

  // Closing and reopening the sheet should never leave a row mid-confirmation.
  useEffect(() => {
    if (!visible) setConfirmingCancelId(null);
  }, [visible]);

  return (
    <ModalSheet visible={visible} title={t('more.shop.myOrders')} onClose={onClose}>
      {loading ? (
        <StateView variant="loading" title={t('more.shop.loading')} />
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
          // The row is a View, not a Pressable: the cancel affordance is a
          // sibling button. Nesting Pressables renders <button> inside
          // <button> on web, which React flags as invalid DOM nesting.
          <View
            key={order.orderId}
            className="mb-2 overflow-hidden rounded-xl border border-border bg-card"
          >
            <Pressable
              onPress={() => onSelect(order.orderId)}
              accessibilityRole="button"
              className="p-3 active:opacity-80"
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-semibold text-ink">
                  #{shortOrderRef(order.orderId)}
                </Text>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: orderChip(order).bg }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{ color: orderChip(order).ink }}
                  >
                    {order.fulfillmentStatus
                      ? t(`orderManagement.status.${order.fulfillmentStatus}`)
                      : t(`more.shop.orderStatus.${order.status}`)}
                  </Text>
                </View>
              </View>
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="flex-1 text-xs text-muted" numberOfLines={1}>
                  {order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')}
                </Text>
                <Text className="ml-2 text-[13px] font-semibold text-ink">
                  {formatMoney(order.totalMinor, order.minorUnitDigits, order.currency)}
                </Text>
              </View>
              <Text className="mt-1.5 text-[11px] text-muted">
                {t('more.shop.itemsCount', {
                  count: order.items.reduce((sum, item) => sum + item.quantity, 0),
                  plural: order.items.length === 1 ? '' : 's',
                })}{' '}
                · {formatDate(order.createdAt, true)}
              </Text>
            </Pressable>

            {order.status === 'pending_payment' ? (
              <View className="border-t border-border px-3 py-2">
                {confirmingCancelId === order.orderId ? (
                  <View className="flex-row items-center gap-2">
                    <Text className="flex-1 text-[11px] leading-4 text-muted">
                      {t('more.shop.cancelOrderBody')}
                    </Text>
                    <Pressable
                      onPress={() => setConfirmingCancelId(null)}
                      accessibilityRole="button"
                      className="rounded-full border border-border px-3 py-1.5 active:opacity-70"
                    >
                      <Text className="text-[11px] font-semibold text-ink">
                        {t('more.shop.keepOrder')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setConfirmingCancelId(null);
                        onCancelOrder(order.orderId);
                      }}
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
                  <Pressable
                    onPress={() => setConfirmingCancelId(order.orderId)}
                    accessibilityRole="button"
                    accessibilityLabel={t('more.shop.cancelOrder')}
                    className="self-start active:opacity-70"
                  >
                    <Text className="text-[11px] font-medium text-tone-danger underline">
                      {t('more.shop.cancelOrder')}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
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
  mode: 'basket' | 'buy-now';
  /** Set after the first submit attempt so empty fields can turn red. */
  attempted: boolean;
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
  mode,
  attempted,
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

  const money = (value: number) =>
    formatMoney(value, quote.minorUnitDigits, quote.currency);
  const itemCount = quote.lines.reduce((sum, line) => sum + line.quantity, 0);
  const nameMissing = attempted && name.trim().length === 0;
  const addressMissing = attempted && address.trim().length === 0;

  return (
    <ModalSheet
      visible={visible}
      title={t('more.shop.checkout')}
      onClose={onClose}
      busy={submitting}
      footer={
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-[10px] uppercase tracking-wide text-muted">
              {t('more.shop.total')}
            </Text>
            <Text className="text-[19px] font-bold text-ink">
              {money(quote.totalMinor)}
            </Text>
          </View>
          <Button
            label={submitting ? t('more.shop.placing') : t('more.shop.placeOrder')}
            loading={submitting}
            onPress={onPlace}
            className="flex-1"
          />
        </View>
      }
    >
      <Text className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {mode === 'buy-now'
          ? t('more.shop.checkoutFromBuyNow', {
              count: itemCount,
              plural: itemCount === 1 ? '' : 's',
            })
          : t('more.shop.checkoutFromBasket', {
              count: itemCount,
              plural: itemCount === 1 ? '' : 's',
            })}
      </Text>

      {error ? (
        <View className="mb-3 rounded-xl border border-tone-danger bg-card px-3 py-2">
          <Text className="text-[12px] text-tone-danger">{error}</Text>
        </View>
      ) : null}

      <View className="mb-4 rounded-[14px] border border-border bg-card p-3">
        {quote.lines.length === 0 ? (
          <Text className="text-xs text-muted">
            {t('more.shop.emptyCheckout')}
          </Text>
        ) : (
          quote.lines.map((line) => (
            <View key={line.productId} className="mb-2 flex-row items-center gap-3">
              <CheckoutLineImage productId={line.productId} t={t} />
              <View className="flex-1">
                <Text className="text-[12px] font-semibold text-ink" numberOfLines={2}>
                  {line.name}
                </Text>
                <Text className="mt-0.5 text-[11px] text-muted">
                  {t('more.shop.unitPrice', { price: money(line.unitPriceMinor) })} ·
                  ×{line.quantity}
                </Text>
              </View>
              <Text className="text-[13px] font-semibold text-ink">
                {money(line.lineTotalMinor)}
              </Text>
            </View>
          ))
        )}
        {quote.lines.length > 0 ? (
          <View className="mt-1 border-t border-border pt-2">
            <SummaryRow label={t('more.shop.subtotal')} value={money(quote.subtotalMinor)} />
            <SummaryRow label={t('more.shop.shipping')} value={money(quote.shippingMinor)} />
            <SummaryRow label={t('more.shop.tax')} value={money(quote.taxMinor)} />
            <View className="mt-1.5 border-t border-border pt-1.5">
              <SummaryRow label={t('more.shop.total')} bold value={money(quote.totalMinor)} />
            </View>
          </View>
        ) : null}
      </View>

      <Text className="mb-2 text-[13px] font-semibold text-ink">
        {t('more.shop.deliveryDetails')}
      </Text>
      <TextField
        label={t('more.shop.shippingNameLabel')}
        value={name}
        onChangeText={onChangeName}
        placeholder={t('more.shop.fullNamePlaceholder')}
        autoCapitalize="words"
        error={nameMissing ? t('more.shop.errors.shippingName') : undefined}
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
        error={addressMissing ? t('more.shop.errors.shippingAddress') : undefined}
      />

      <View className="mb-2 mt-1 rounded-[14px] border border-border bg-card px-3 py-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[13px] font-semibold text-ink">
            {t('more.shop.payment')}
          </Text>
          <View className="flex-row items-center gap-1.5 rounded-full bg-shop-mint px-2.5 py-1">
            <CreditCard color={shopColors.mintInk} size={12} />
            <Text
              className="text-[10px] font-semibold text-shop-ink"
              style={{ color: shopColors.mintInk }}
            >
              {t('more.shop.paymentSandbox')}
            </Text>
          </View>
        </View>
        <Text className="mt-1.5 text-[11px] leading-4 text-muted">
          {t('more.shop.payAfterPlace')}
        </Text>
      </View>
    </ModalSheet>
  );
}

/**
 * Checkout line thumbnail. The quote only carries ids and names, so the photo
 * comes from the bundled catalogue map; an unknown product keeps the neutral
 * Package placeholder rather than borrowing another product's picture.
 */
function CheckoutLineImage({
  productId,
  t,
}: {
  productId: string;
  t: TranslateFn;
}) {
  const source = PRODUCT_IMAGES[productId];
  if (!source) {
    return (
      <View className="h-10 w-10 items-center justify-center rounded-lg bg-shop-image-bg">
        <Package color={shopColors.footText} size={16} />
      </View>
    );
  }
  return (
    <Image
      source={source}
      resizeMode="cover"
      style={{ width: 40, height: 40, borderRadius: 8 }}
      accessibilityLabel={t('more.shop.items')}
      accessibilityIgnoresInvertColors
    />
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
 * Status chip colours for an order row: mint once money is in, citron while
 * the payment is still outstanding, muted once the order is dead.
 */
function orderChip(order: ShopOrder): { bg: string; ink: string } {
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return { bg: 'transparent', ink: shopColors.footText };
  }
  if (order.status === 'pending_payment') {
    return { bg: shopColors.basketBadge, ink: shopColors.mintInk };
  }
  return { bg: shopColors.mint, ink: shopColors.mintInk };
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

/**
 * Basket-line thumbnail with the web `ProductImage.vue` fallback: when a
 * product ships no usable image (or the URL fails to load), render the
 * neutral Package placeholder instead of a substitute photo.
 */
function BasketLineImage({
  product,
  t,
}: {
  product: ShopProduct;
  t: TranslateFn;
}) {
  const [failed, setFailed] = useState(false);
  const source = failed ? null : productImageSource(product);
  if (!source) {
    return (
      <View
        className="h-14 w-14 items-center justify-center rounded-lg bg-shop-image-bg"
        accessibilityRole="image"
        accessibilityLabel={t('more.shop.noImageFor', {
          name: product.name,
        })}
      >
        <Package color={shopColors.footText} size={22} />
      </View>
    );
  }
  return (
    <Image
      source={source}
      // Explicit size: bundled assets carry intrinsic pixel sizes that
      // react-native-web prefers over the `h-14 w-14` classes.
      style={{ width: 56, height: 56, borderRadius: 8 }}
      className="h-14 w-14 rounded-lg bg-shop-image-bg"
      resizeMode="cover"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}
