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
  ShoppingBasket,
} from 'lucide-react-native';

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
import { themeColors } from '@/constants/theme';
import { ApiError } from '@/lib/apiClient';
import {
  completeDevPayment,
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
import { formatDate, formatMoney } from '@/utils/format';

const ALL_CATEGORIES = 'all';

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
        err instanceof ApiError ? err.message : 'Could not load the catalog.',
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
        err instanceof ApiError ? err.message : 'Could not load your orders.',
      );
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (ordersSheetOpen) void loadOrders();
  }, [ordersSheetOpen, loadOrders]);

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
    setCheckoutQuoting(true);
    setBasketError(null);
    try {
      const quote = await quoteCheckout(toCartPayload(basketLines));
      setCheckoutQuote(quote);
      setBasketSheetOpen(false);
    } catch (err) {
      // Surface the failure inside the basket sheet so the user can retry.
      setBasketError(
        err instanceof ApiError ? err.message : 'Could not refresh the quote.',
      );
    } finally {
      setCheckoutQuoting(false);
    }
  }

  async function placeOrder() {
    if (!checkoutQuote) return;
    if (shippingName.trim().length === 0) {
      setCheckoutError('Shipping name is required.');
      return;
    }
    if (shippingAddress.trim().length === 0) {
      setCheckoutError('Shipping address is required.');
      return;
    }
    if (!user) {
      setCheckoutError('Sign in to complete checkout.');
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
          : 'Could not place the order.',
      );
    } finally {
      setCheckoutSubmitting(false);
    }
  }

  return (
    <Screen className="px-0 pt-0">
      <View className="absolute right-5 top-4 z-10">
        <Pressable
          onPress={() => setOrdersSheetOpen(true)}
          accessibilityRole="button"
          className="rounded-full border border-border bg-card px-3 py-1.5 active:opacity-80"
        >
          <Text className="text-xs font-medium text-primary">My orders</Text>
        </Pressable>
      </View>

      <View className="px-5 pt-4">
        <View className="mb-3 flex-row items-center gap-2">
          <View className="flex-1">
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Search products…"
            />
          </View>
          <Pressable
            onPress={() => setBasketSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`Open basket, ${basketTotalCount} ${
              basketTotalCount === 1 ? 'item' : 'items'
            }`}
            className="relative h-12 w-12 items-center justify-center rounded-lg border border-border bg-card active:opacity-80"
          >
            <ShoppingBasket color={palette.primary} size={20} />
            {basketTotalCount > 0 ? (
              <View className="absolute -right-1 -top-1 min-w-5 items-center justify-center rounded-full bg-primary px-1.5">
                <Text className="text-[10px] font-bold text-primary-foreground">
                  {basketTotalCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
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
                ? 'border-primary bg-primary'
                : 'border-border bg-card'
            }`}
          >
            <Text
              className={`text-xs font-medium ${
                inStockOnly ? 'text-primary-foreground' : 'text-muted'
              }`}
            >
              In stock only
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
                    ? 'border-primary bg-primary'
                    : 'border-border bg-card'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    selected ? 'text-primary-foreground' : 'text-muted'
                  }`}
                >
                  {value === ALL_CATEGORIES ? 'All' : value}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View className="mb-3 flex-row items-end justify-between">
          <Text className="mb-3 text-xs text-muted">
            {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
          </Text>
          <View className="w-44">
            <Picker
              label="Sort"
              value={sort}
              onChange={(value) => setSort(value as ShopSortKey)}
              options={SHOP_SORT_OPTIONS}
            />
          </View>
        </View>
      </View>

      {error && catalog === null ? (
        <StateView
          variant="error"
          title="Could not load the catalog"
          description={error}
          actionLabel="Retry"
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
          title="No products match"
          description="Try a different category, clear the search, or disable the stock filter."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-5 pb-32"
          ItemSeparatorComponent={() => <View className="h-3" />}
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
            className="flex-row items-center justify-between rounded-full bg-primary px-5 py-3 active:opacity-80"
          >
            <View className="flex-row items-center gap-2">
              <ShoppingBasket color={palette.primaryForeground} size={18} />
              <Text className="text-sm font-semibold text-primary-foreground">
                {basketTotalCount}{' '}
                {basketTotalCount === 1 ? 'item' : 'items'} ·{' '}
                {catalog
                  ? formatMoney(
                      basketSubtotalMinor,
                      catalog.minorUnitDigits,
                      catalog.currency,
                    )
                  : ''}
              </Text>
            </View>
            <Text className="text-sm font-semibold text-primary-foreground">
              Review →
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
        onDevComplete={async (orderId) => {
          try {
            await completeDevPayment(orderId);
            setBasket({});
            router.replace(`/more/shop/${orderId}`);
          } catch (err) {
            setCheckoutError(
              err instanceof ApiError
                ? err.message
                : 'Could not complete the dev payment.',
            );
          }
        }}
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
};

function ProductDetailSheet({
  product,
  catalog,
  quantity,
  onChangeQuantity,
  onClose,
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
          <Text className="text-xs text-muted">No image available</Text>
        </View>
      )}
      {product.brand ? (
        <Text className="mt-3 text-xs uppercase tracking-wide text-muted">
          {product.brand}
        </Text>
      ) : null}
      <Text className="mt-2 text-base text-ink">
        {product.description ?? 'No description provided.'}
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
          {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
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
            ? `${quantity} in basket`
            : 'Tap + to add to your basket'}
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
}: BasketSheetProps) {
  return (
    <ModalSheet visible={visible} title="Basket" onClose={onClose} busy={quoting}>
      {lines.length === 0 ? (
        <StateView
          variant="empty"
          icon={ShoppingBasket}
          title="Your basket is empty"
          description="Tap a product to add it."
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
              </View>
              <QuantityStepper
                value={line.quantity}
                onChange={(value) => onChangeQuantity(line.product.id, value)}
                max={Math.max(1, line.product.stock)}
              />
            </View>
          ))}

          {catalog ? (
            <View className="mb-3 flex-row items-center justify-between rounded-lg bg-border/30 px-3 py-2">
              <Text className="text-xs font-medium text-muted">Subtotal</Text>
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
              label={quoting ? 'Quoting…' : 'Continue to checkout'}
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
};

function OrdersSheet({
  visible,
  onClose,
  orders,
  loading,
  error,
  onRetry,
  onSelect,
}: OrdersSheetProps) {
  const palette = themeColors();
  return (
    <ModalSheet visible={visible} title="My orders" onClose={onClose}>
      {loading ? (
        <View className="py-6">
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : error ? (
        <StateView
          variant="error"
          title="Could not load orders"
          description={error}
          actionLabel="Retry"
          onAction={onRetry}
        />
      ) : !orders || orders.length === 0 ? (
        <StateView
          variant="empty"
          title="No orders yet"
          description="Orders you place will appear here."
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
              {order.items.length}{' '}
              {order.items.length === 1 ? 'item' : 'items'} ·{' '}
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
  onDevComplete: (orderId: string) => Promise<void>;
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
  onDevComplete,
}: CheckoutSheetProps) {
  // The dev-complete button is only shown after the order is placed (the
  // caller passes the `onDevComplete` handler that handles the redirect).
  // Because the sheet closes once the order exists, the button is wired via
  // the parent. We expose a helper prop here so the type stays explicit.
  void onDevComplete;
  if (!visible || !quote) return null;
  return (
    <ModalSheet
      visible={visible}
      title="Checkout"
      onClose={onClose}
      busy={submitting}
      footer={
        <Button
          label={submitting ? 'Placing…' : 'Place order'}
          loading={submitting}
          onPress={onPlace}
        />
      }
    >
      <View className="mb-3 rounded-xl border border-border bg-card p-3">
        <Text className="text-sm font-semibold text-ink">Order summary</Text>
        {quote.lines.length === 0 ? (
          <Text className="mt-2 text-xs text-muted">
            Add at least one item to your basket before checking out.
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
              label="Subtotal"
              value={formatMoney(
                quote.subtotalMinor,
                quote.minorUnitDigits,
                quote.currency,
              )}
            />
            <SummaryRow
              label="Shipping"
              value={formatMoney(
                quote.shippingMinor,
                quote.minorUnitDigits,
                quote.currency,
              )}
            />
            <SummaryRow
              label="Tax"
              value={formatMoney(
                quote.taxMinor,
                quote.minorUnitDigits,
                quote.currency,
              )}
            />
            <View className="mt-2 border-t border-border pt-2">
              <SummaryRow
                label="Total"
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
        label="Shipping name"
        value={name}
        onChangeText={onChangeName}
        placeholder="Full name"
        autoCapitalize="words"
      />
      <TextField
        label="Phone (optional)"
        value={phone}
        onChangeText={onChangePhone}
        keyboardType="phone-pad"
      />
      <TextField
        label="Shipping address"
        value={address}
        onChangeText={onChangeAddress}
        placeholder="Street, city, postcode"
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
