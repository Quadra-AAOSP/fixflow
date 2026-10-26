import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, PackagePlus, PackageSearch, Pencil, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/hooks/useAuth';
import { canManageShop } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { ApiError, toErrorMessage } from '@/lib/apiClient';
import {
  adminCreateProduct,
  adminDeleteProduct,
  adminListProducts,
  adminUpdateProduct,
} from '@/services/shop';
import type { ShopAdminProduct } from '@/types';
import { formatMoney } from '@/utils/format';

const MINOR_UNIT_DIGITS = 2;
const CURRENCY = 'CNY';

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
    price: (product.priceMinor / 10 ** MINOR_UNIT_DIGITS).toFixed(MINOR_UNIT_DIGITS),
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

  const [products, setProducts] = useState<ShopAdminProduct[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [logout, t]);

  useFocusEffect(
    useCallback(() => {
      if (allowed) void load();
    }, [allowed, load]),
  );

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
    if (!Number.isFinite(priceMajor) || priceMajor < 0 || !Number.isInteger(stock) || stock < 0) {
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
          imageUrl: form.imageUrl.trim() || null,
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
          imageUrl: form.imageUrl.trim() || null,
          priceMinor,
          stock,
          active: form.active,
        });
      }
      setFormVisible(false);
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
                await load();
              } catch (err) {
                setLoadError(
                  toErrorMessage(err, {
                    fallback: t('more.shopAdmin.deleteFailed'),
                  }),
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

  if (loading && !products) {
    return (
      <Screen>
        <StateView variant="loading" title={t('more.shopAdmin.loading')} />
      </Screen>
    );
  }

  if (loadError && !products) {
    return (
      <Screen>
        <StateView
          variant="error"
          title={t('more.shopAdmin.loadFailed')}
          description={loadError}
          actionLabel={t('reports.detail.retry')}
          onAction={() => void load()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 px-5 pt-4">
        <View className="mb-4 flex-row items-center gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('more.shopAdmin.back')}
            className="rounded-full bg-surface-secondary p-2"
            onPress={() => router.back()}
          >
            <ArrowLeft color={dashboardColors.statMintDeep} size={20} />
          </Pressable>
          <Text className="flex-1 text-2xl font-bold text-ink">
            {t('more.shopAdmin.title')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('more.shopAdmin.newProduct')}
            className="rounded-full bg-surface-secondary p-2"
            onPress={openCreate}
          >
            <PackagePlus color={dashboardColors.statMintDeep} size={20} />
          </Pressable>
        </View>

        {loadError ? (
          <Text className="mb-2 text-sm text-red-500">{loadError}</Text>
        ) : null}

        <FlatList
          data={products ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32, gap: 10 }}
          ListEmptyComponent={
            <StateView
              variant="empty"
              icon={PackageSearch}
              title={t('more.shopAdmin.emptyTitle')}
              description={t('more.shopAdmin.emptyDesc')}
            />
          }
          renderItem={({ item }) => (
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-ink">
                    {item.name}
                  </Text>
                  <Text className="mt-0.5 text-xs text-dashboard-subtitle">
                    {item.id}
                    {item.category ? ` · ${item.category}` : ''}
                  </Text>
                  <Text className="mt-1 text-sm text-ink">
                    {formatMoney(item.priceMinor, MINOR_UNIT_DIGITS, CURRENCY)}
                    {` · ${t('more.shopAdmin.stock', { count: item.stock })}`}
                  </Text>
                  <Text
                    className={`mt-0.5 text-xs ${
                      item.active ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {item.active
                      ? t('more.shopAdmin.active')
                      : t('more.shopAdmin.inactive')}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('more.shopAdmin.edit')}
                  className="rounded-full bg-surface-secondary p-2"
                  onPress={() => openEdit(item)}
                >
                  <Pencil color={dashboardColors.statMintDeep} size={18} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('more.shopAdmin.delete')}
                  className="rounded-full bg-surface-secondary p-2"
                  onPress={() => onDelete(item)}
                >
                  <Trash2 color="#dc2626" size={18} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      </View>

      <ModalSheet
        onClose={() => setFormVisible(false)}
        title={
          editing
            ? t('more.shopAdmin.editTitle')
            : t('more.shopAdmin.newTitle')
        }
        visible={formVisible}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <View className="gap-3 pb-6">
            {!editing ? (
              <TextField
                label={t('more.shopAdmin.fieldId')}
                onChangeText={(v) => setForm((f) => ({ ...f, id: v }))}
                placeholder={t('more.shopAdmin.fieldIdPlaceholder')}
                value={form.id}
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
            <TextField
              label={t('more.shopAdmin.fieldImageUrl')}
              onChangeText={(v) => setForm((f) => ({ ...f, imageUrl: v }))}
              value={form.imageUrl}
            />
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
              <Text className="text-sm text-red-500">{formError}</Text>
            ) : null}
            <Button
              disabled={saving}
              label={
                saving
                  ? t('more.shopAdmin.saving')
                  : editing
                    ? t('more.shopAdmin.save')
                    : t('more.shopAdmin.create')
              }
              onPress={() => void onSave()}
            />
          </View>
        </ScrollView>
      </ModalSheet>
    </Screen>
  );
}
