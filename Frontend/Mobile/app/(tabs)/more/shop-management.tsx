import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  PackageCheck,
  PackagePlus,
  PackageSearch,
  Pencil,
  Plus,
  ReceiptText,
  Store,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { StatCard } from '@/components/ui/StatCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/useToastContext';
import { useAuth } from '@/hooks/useAuth';
import { canManageShop } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { ApiError, toErrorMessage } from '@/lib/apiClient';
import { productImageSource } from '@/utils/shopImages';
import {
  adminCreateProduct,
  adminDeleteProduct,
  adminListProducts,
  adminUpdateProduct,
  loadShopAnalytics,
  type ShopAnalytics,
  type ShopAnalyticsTopProduct,
} from '@/services/shop';
import type { ShopAdminProduct } from '@/types';
import { formatMoney } from '@/utils/format';

const MINOR_UNIT_DIGITS = 2;
const CURRENCY = 'CNY';
/** At or below this count the stock line turns citron ("low stock"). */
const LOW_STOCK_THRESHOLD = 10;

type CatalogFilter = 'all' | 'active' | 'inactive';

type FormState = {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  imageUrl: string;
  /** Entered in major units (e.g. 12.50); converted to minor on submit. */
  price: string;
  stock: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  id: '',
  name: '',
  description: '',
  category: '',
  brand: '',
  imageUrl: '',
  price: '',
  stock: '',
  active: true,
};

function toForm(product: ShopAdminProduct): FormState {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? '',
    category: product.category ?? '',
    brand: product.brand ?? '',
    imageUrl: product.imageUrl ?? '',
    price: (product.priceMinor / 10 ** MINOR_UNIT_DIGITS).toFixed(
      MINOR_UNIT_DIGITS,
    ),
    stock: String(product.stock),
    active: product.active,
  };
}

/**
 * Shop-manager product CRUD (`manageShop` capability) backed by
 * `/api/admin/shop/products`. Reached from More → Shop management.
 */
export default function ShopManagementScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState<ShopAdminProduct[] | null>(null);
  const [analytics, setAnalytics] = useState<ShopAnalytics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<CatalogFilter>('all');
  const [query, setQuery] = useState('');

  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<ShopAdminProduct | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allowed = canManageShop(user);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setProducts(await adminListProducts());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout().catch(() => {});
        return;
      }
      setLoadError(
        toErrorMessage(err, { fallback: t('more.shopAdmin.loadFailed') }),
      );
    } finally {
      setLoading(false);
    }
    // Sales analytics are a bonus panel — a failure here hides the stats
    // without blocking catalogue management.
    try {
      setAnalytics(await loadShopAnalytics());
    } catch {
      setAnalytics(null);
    }
  }, [logout, t]);

  useFocusEffect(
    useCallback(() => {
      if (allowed) void load();
    }, [allowed, load]),
  );

  const activeCount = useMemo(
    () => (products ?? []).filter((product) => product.active).length,
    [products],
  );
  const outOfStockCount = useMemo(
    () => (products ?? []).filter((product) => product.stock === 0).length,
    [products],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (products ?? []).filter((product) => {
      if (filter === 'active' && !product.active) return false;
      if (filter === 'inactive' && product.active) return false;
      if (!needle) return true;
      return [product.name, product.id, product.category ?? '', product.brand ?? '']
        .some((field) => field.toLowerCase().includes(needle));
    });
  }, [products, filter, query]);

  const isNarrowed = query.trim().length > 0 || filter !== 'all';

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormVisible(true);
  }

  function openEdit(product: ShopAdminProduct) {
    setEditing(product);
    setForm(toForm(product));
    setFormError(null);
    setFormVisible(true);
  }

  async function onSave() {
    const priceMajor = Number(form.price);
    const stock = Number(form.stock);
    if (form.id.trim().length === 0 && !editing) {
      setFormError(t('more.shopAdmin.idRequired'));
      return;
    }
    if (form.name.trim().length === 0 || form.category.trim().length === 0) {
      setFormError(t('more.shopAdmin.nameCategoryRequired'));
      return;
    }
    const trimmedImage = form.imageUrl.trim();
    if (trimmedImage.length > 0 && !/^https?:\/\//.test(trimmedImage)) {
      setFormError(t('more.shopAdmin.imageUrlInvalid'));
      return;
    }
    if (
      !Number.isFinite(priceMajor) ||
      priceMajor < 0 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setFormError(t('more.shopAdmin.priceStockInvalid'));
      return;
    }

    const priceMinor = Math.round(priceMajor * 10 ** MINOR_UNIT_DIGITS);
    setFormError(null);
    setSaving(true);
    try {
      if (editing) {
        await adminUpdateProduct(editing.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          brand: form.brand.trim() || null,
          imageUrl: trimmedImage || null,
          priceMinor,
          stock,
          active: form.active,
        });
      } else {
        await adminCreateProduct({
          id: form.id.trim(),
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          brand: form.brand.trim() || null,
          imageUrl: trimmedImage || null,
          priceMinor,
          stock,
          active: form.active,
        });
      }
      setFormVisible(false);
      showToast(
        t('more.shopAdmin.saved', { name: form.name.trim() }),
        'success',
      );
      await load();
    } catch (err) {
      setFormError(
        toErrorMessage(err, { fallback: t('more.shopAdmin.saveFailed') }),
      );
    } finally {
      setSaving(false);
    }
  }

  function onDelete(product: ShopAdminProduct) {
    Alert.alert(
      t('more.shopAdmin.deleteTitle'),
      t('more.shopAdmin.deleteMessage', { name: product.name }),
      [
        { text: t('more.shopAdmin.cancel'), style: 'cancel' },
        {
          text: t('more.shopAdmin.delete'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await adminDeleteProduct(product.id);
                showToast(
                  t('more.shopAdmin.deleted', { name: product.name }),
                  'success',
                );
                await load();
              } catch (err) {
                showToast(
                  toErrorMessage(err, {
                    fallback: t('more.shopAdmin.deleteFailed'),
                  }),
                  'error',
                );
              }
            })();
          },
        },
      ],
    );
  }

  if (!allowed) {
    return (
      <Screen>
        <StateView
          variant="error"
          title={t('more.shopAdmin.noAccessTitle')}
          description={t('more.shopAdmin.noAccessDesc')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 32,
        }}
        ListHeaderComponent={
          <>
            <PageHeader
              kicker={t('more.shopAdmin.kicker')}
              title={t('more.shopAdmin.title')}
              subtitle={t('more.shopAdmin.subtitle')}
              icon={Store}
            >
              <View className="flex-row flex-wrap items-center gap-2">
                <Pill
                  tone="mint"
                  label={t('more.shopAdmin.productsCount', {
                    count: products?.length ?? 0,
                    plural: (products?.length ?? 0) === 1 ? '' : 's',
                  })}
                />
                {outOfStockCount > 0 ? (
                  <Pill
                    tone="coral"
                    label={t('more.shopAdmin.outOfStockCount', {
                      count: outOfStockCount,
                    })}
                  />
                ) : null}
              </View>
            </PageHeader>

            {analytics ? <SalesStats analytics={analytics} t={t} /> : null}

            <Card className="mb-4">
              <SegmentedControl<CatalogFilter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: t('more.shopAdmin.filterAll') },
                  { value: 'active', label: t('more.shopAdmin.filterActive') },
                  {
                    value: 'inactive',
                    label: t('more.shopAdmin.filterInactive'),
                  },
                ]}
              />
              <SearchField
                value={query}
                onChangeText={setQuery}
                placeholder={t('more.shopAdmin.searchPlaceholder')}
                className="mt-3"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('more.shopAdmin.newProduct')}
                onPress={openCreate}
                className="mt-3 flex-row items-center justify-center gap-2 rounded-[11px] border px-4 py-3 active:opacity-90"
                style={{
                  backgroundColor: dashboardColors.ctaBg,
                  borderColor: dashboardColors.ctaBorder,
                }}
              >
                <Plus color={dashboardColors.ctaText} size={17} strokeWidth={2.4} />
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: dashboardColors.ctaText }}
                >
                  {t('more.shopAdmin.newProductCta')}
                </Text>
              </Pressable>
            </Card>

            {loadError ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mb-3 text-[12px] text-tone-danger"
              >
                {loadError}
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          loading && products === null ? (
            <StateView variant="loading" title={t('more.shopAdmin.loading')} />
          ) : loadError && products === null ? (
            <StateView
              variant="error"
              title={t('more.shopAdmin.loadFailed')}
              description={loadError}
              actionLabel={t('reports.detail.retry')}
              onAction={() => void load()}
            />
          ) : isNarrowed ? (
            <StateView
              variant="empty"
              icon={PackageSearch}
              title={t('more.shopAdmin.noResultsTitle')}
              description={t('more.shopAdmin.noResultsDesc')}
            />
          ) : (
            <StateView
              variant="empty"
              icon={PackageSearch}
              title={t('more.shopAdmin.emptyTitle')}
              description={t('more.shopAdmin.emptyDesc')}
            />
          )
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            t={t}
            onEdit={() => openEdit(item)}
            onDelete={() => onDelete(item)}
          />
        )}
      />

      <ModalSheet
        onClose={() => setFormVisible(false)}
        title={
          editing
            ? t('more.shopAdmin.editTitle')
            : t('more.shopAdmin.newTitle')
        }
        visible={formVisible}
        busy={saving}
        footer={
          <Button
            disabled={saving}
            label={
              saving
                ? t('more.shopAdmin.saving')
                : editing
                  ? t('more.shopAdmin.save')
                  : t('more.shopAdmin.create')
            }
            loading={saving}
            onPress={() => void onSave()}
          />
        }
      >
        <View className="gap-3 pb-2">
          <FormSectionLabel>{t('more.shopAdmin.sectionBasics')}</FormSectionLabel>
          {!editing ? (
            <TextField
              label={t('more.shopAdmin.fieldId')}
              onChangeText={(v) => setForm((f) => ({ ...f, id: v }))}
              placeholder={t('more.shopAdmin.fieldIdPlaceholder')}
              value={form.id}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : null}
          <TextField
            label={t('more.shopAdmin.fieldName')}
            onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            value={form.name}
          />
          <TextField
            label={t('more.shopAdmin.fieldDescription')}
            multiline
            onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
            value={form.description}
          />

          <FormSectionLabel>
            {t('more.shopAdmin.sectionClassification')}
          </FormSectionLabel>
          <TextField
            label={t('more.shopAdmin.fieldCategory')}
            onChangeText={(v) => setForm((f) => ({ ...f, category: v }))}
            value={form.category}
          />
          <TextField
            label={t('more.shopAdmin.fieldBrand')}
            onChangeText={(v) => setForm((f) => ({ ...f, brand: v }))}
            value={form.brand}
          />

          <FormSectionLabel>{t('more.shopAdmin.sectionMedia')}</FormSectionLabel>
          <TextField
            label={t('more.shopAdmin.fieldImageUrl')}
            onChangeText={(v) => setForm((f) => ({ ...f, imageUrl: v }))}
            value={form.imageUrl}
            placeholder="https://"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <FormSectionLabel>
            {t('more.shopAdmin.sectionPricing')}
          </FormSectionLabel>
          <TextField
            keyboardType="decimal-pad"
            label={t('more.shopAdmin.fieldPrice')}
            onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
            value={form.price}
          />
          <TextField
            keyboardType="number-pad"
            label={t('more.shopAdmin.fieldStock')}
            onChangeText={(v) => setForm((f) => ({ ...f, stock: v }))}
            value={form.stock}
          />
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-ink">
              {t('more.shopAdmin.fieldActive')}
            </Text>
            <Switch
              onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
              value={form.active}
            />
          </View>

          {formError ? (
            <Text accessibilityLiveRegion="polite" className="text-sm text-tone-danger">
              {formError}
            </Text>
          ) : null}
        </View>
      </ModalSheet>
    </Screen>
  );
}

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

/** Sales overview: headline stat tiles plus the all-time best-sellers list. */
function SalesStats({ analytics, t }: { analytics: ShopAnalytics; t: TranslateFn }) {
  const products = analytics.products ?? {};
  const outOfStock = products.outOfStock ?? 0;
  const revenueLabel =
    (analytics.revenue ?? [])
      .map((entry) =>
        formatMoney(entry.totalMinor, entry.minorUnitDigits, entry.currency),
      )
      .join(' · ') || '—';
  const topProducts: ShopAnalyticsTopProduct[] = analytics.topProducts ?? [];

  return (
    <>
      <View className="mb-4 gap-3">
        <View className="flex-row gap-3">
          <StatCard
            tone="mint"
            icon={Wallet}
            label={t('more.shopAdmin.statRevenue')}
            value={revenueLabel}
            note={t('more.shopAdmin.statRevenueNote')}
          />
          <StatCard
            tone="citron"
            icon={TrendingUp}
            label={t('more.shopAdmin.statUnitsSold')}
            value={analytics.unitsSold ?? 0}
            note={t('more.shopAdmin.statUnitsSoldNote')}
          />
        </View>
        <View className="flex-row gap-3">
          <StatCard
            tone="mint"
            icon={PackageCheck}
            label={t('more.shopAdmin.statInStock')}
            value={products.inStock ?? 0}
            note={t('more.shopAdmin.statInStockNote', { count: outOfStock })}
          />
          <StatCard
            tone="citron"
            icon={ReceiptText}
            label={t('more.shopAdmin.statOrders')}
            value={analytics.totalOrders}
            note={t('more.shopAdmin.statOrdersNote')}
          />
        </View>
      </View>

      <Card className="mb-4">
        <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
          {t('more.shopAdmin.topSellersTitle')}
        </Text>
        <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
          {t('more.shopAdmin.topSellersHint')}
        </Text>
        {topProducts.length === 0 ? (
          <Text className="mt-3 text-[12px] text-dashboard-caption">
            {t('more.shopAdmin.topSellersEmpty')}
          </Text>
        ) : (
          <View className="mt-1">
            {topProducts.map((product, index) => (
              <View
                key={product.productId}
                className={`flex-row items-center gap-3 py-2.5 ${
                  index > 0 ? 'border-t border-dashboard-card-line' : ''
                }`}
              >
                <View
                  className="h-7 w-7 items-center justify-center rounded-full"
                  style={{
                    backgroundColor:
                      index === 0
                        ? dashboardColors.statCitronSoft
                        : dashboardColors.statMintSoft,
                  }}
                >
                  <Text
                    className="text-[11px] font-bold"
                    style={{
                      color:
                        index === 0
                          ? dashboardColors.statCitronDeep
                          : dashboardColors.statMintDeep,
                    }}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    numberOfLines={1}
                    className="text-[12px] font-semibold text-ink"
                  >
                    {product.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="mt-0.5 text-[10px] text-dashboard-caption"
                  >
                    {product.category ?? product.productId}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className="text-[11px] font-semibold"
                    style={{ color: dashboardColors.statMintDeep }}
                  >
                    {formatMoney(
                      product.revenueMinor,
                      product.minorUnitDigits,
                      product.currency,
                    )}
                  </Text>
                  <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                    {t('more.shopAdmin.topUnits', { count: product.units })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </>
  );
}

function FormSectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="mt-2 text-[10px] font-semibold uppercase"
      style={{ color: dashboardColors.caption, letterSpacing: 0.8 }}
    >
      {children}
    </Text>
  );
}

function ProductThumb({
  product,
  t,
}: {
  product: ShopAdminProduct;
  t: TranslateFn;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [product.id, product.imageUrl]);

  // Bundled photo first, then the URL an admin may have typed in.
  const source = failed ? null : productImageSource(product);

  if (!source) {
    return (
      <View
        className="h-12 w-12 items-center justify-center rounded-[10px]"
        style={{ backgroundColor: dashboardColors.statMintSoft }}
      >
        <PackageSearch color={dashboardColors.statMintDeep} size={18} />
      </View>
    );
  }
  return (
    <Image
      source={source}
      onError={() => setFailed(true)}
      resizeMode="cover"
      accessibilityLabel={t('more.shopAdmin.imageA11y', { name: product.name })}
      accessibilityRole="image"
      // Explicit size: a bundled asset carries its own pixel dimensions, and
      // react-native-web lets those win over the `h-12 w-12` classes.
      style={{ width: 48, height: 48, borderRadius: 10 }}
      className="h-12 w-12 rounded-[10px]"
    />
  );
}

function stockLine(
  product: ShopAdminProduct,
  t: TranslateFn,
): { label: string; color: string } {
  if (product.stock === 0) {
    return { label: t('more.shopAdmin.outOfStock'), color: dashboardColors.statCoralDeep };
  }
  if (product.stock <= LOW_STOCK_THRESHOLD) {
    return {
      label: t('more.shopAdmin.lowStock', { count: product.stock }),
      color: dashboardColors.statCitronDeep,
    };
  }
  return {
    label: t('more.shopAdmin.stock', { count: product.stock }),
    color: dashboardColors.caption,
  };
}

function ProductCard({
  product,
  t,
  onEdit,
  onDelete,
}: {
  product: ShopAdminProduct;
  t: TranslateFn;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stock = stockLine(product, t);
  return (
    <Card className="mb-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('more.shopAdmin.edit')}
        onPress={onEdit}
        className="active:opacity-80"
      >
        <View className="flex-row items-start gap-3">
          <ProductThumb product={product} t={t} />
          <View className="flex-1">
            <View className="flex-row items-center justify-between gap-2">
              <Text
                numberOfLines={1}
                className="flex-1 text-[13px] font-semibold text-ink"
              >
                {product.name}
              </Text>
              <Pill
                tone={product.active ? 'mint' : 'neutral'}
                label={
                  product.active
                    ? t('more.shopAdmin.active')
                    : t('more.shopAdmin.inactive')
                }
              />
            </View>
            <Text
              numberOfLines={1}
              className="mt-0.5 text-[10px] text-dashboard-caption"
            >
              {product.id}
              {product.category ? ` · ${product.category}` : ''}
              {product.brand ? ` · ${product.brand}` : ''}
            </Text>
            <View className="mt-1.5 flex-row items-center gap-2">
              <Text
                className="text-[13px] font-bold"
                style={{ color: dashboardColors.statMintDeep }}
              >
                {formatMoney(product.priceMinor, MINOR_UNIT_DIGITS, CURRENCY)}
              </Text>
              <Text className="text-[10px]" style={{ color: stock.color }}>
                {stock.label}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      <View className="mt-2.5 flex-row items-center justify-end gap-2 border-t border-dashboard-card-line pt-2.5">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('more.shopAdmin.edit')}
          onPress={onEdit}
          className="rounded-full bg-surface-secondary p-2 active:opacity-70"
        >
          <Pencil color={dashboardColors.statMintDeep} size={16} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('more.shopAdmin.delete')}
          onPress={onDelete}
          className="rounded-full bg-surface-secondary p-2 active:opacity-70"
        >
          <Trash2 color={dashboardColors.statCoralDeep} size={16} />
        </Pressable>
      </View>
    </Card>
  );
}
