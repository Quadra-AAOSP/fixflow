import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { ListFilter, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteSiteRule,
  listAllSiteRules,
  listSiteRules,
  saveSiteRule,
} from '@/services/siteRules';
import type { SiteRule, SiteType } from '@/types';

const TYPES: SiteType[] = ['school', 'hostel', 'hotel'];

type Filter = SiteType | 'all';

/**
 * Site category taxonomy panel. Used standalone (legacy route redirects to the
 * Sites hub) and embedded as a tab on `sites.tsx`.
 */
export function SiteRulesPanel({ embedded = false, ownSiteType }: { embedded?: boolean; ownSiteType?: SiteType }) {
  const { t } = useTranslation('common');
  const { user } = useAuth();
  const canEdit = user?.role === 'super_admin';
  const allowed = user?.role === 'admin' || canEdit;

  const [rules, setRules] = useState<SiteRule[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState(false);
  const [id, setId] = useState<number | null>(null);
  const [siteType, setSiteType] = useState<SiteType>('school');
  const [category, setCategory] = useState('');
  const [weight, setWeight] = useState('0');
  const [order, setOrder] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const request = canEdit ? listAllSiteRules : ownSiteType ? () => listSiteRules(ownSiteType) : null;
    if (!allowed || !request) return;
    setBusy(true);
    setError(null);
    try {
      setRules(await request());
    } catch {
      setError(t('more.siteRules.loadFailed'));
    } finally {
      setBusy(false);
    }
  }, [allowed, canEdit, ownSiteType, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function edit(rule?: SiteRule) {
    if (!canEdit) return;
    setId(rule?.id ?? null);
    setSiteType(rule?.siteType ?? (filter === 'all' ? 'school' : filter));
    setCategory(rule?.category ?? '');
    setWeight(String(rule?.urgencyWeight ?? 0));
    setOrder(String(rule?.sortOrder ?? 0));
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (busy || !canEdit) return;
    if (
      !category.trim() ||
      !/^-?\d+$/.test(weight) ||
      !/^-?\d+$/.test(order) ||
      ![Number(weight), Number(order)].every(
        (value) =>
          Number.isInteger(value) &&
          value >= -2147483648 &&
          value <= 2147483647,
      )
    ) {
      setError(t('more.siteRules.validation'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await saveSiteRule(id, {
        siteType,
        category: category.trim(),
        urgencyWeight: Number(weight),
        sortOrder: Number(order),
      });
      setRules((old) => [
        ...(old ?? []).filter((rule) => rule.id !== saved.id),
        saved,
      ]);
      setEditing(false);
    } catch {
      setError(t('more.siteRules.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(rule: SiteRule) {
    if (busy || !canEdit) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSiteRule(rule.id);
      setRules((old) => (old ?? []).filter((item) => item.id !== rule.id));
    } catch {
      setError(t('more.siteRules.deleteFailed'));
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => {
    const list = (rules ?? []).filter(
      (rule) => canEdit
        ? filter === 'all' || rule.siteType === filter
        : rule.siteType === ownSiteType,
    );
    return [...list].sort(
      (a, b) =>
        a.siteType.localeCompare(b.siteType) || a.sortOrder - b.sortOrder,
    );
  }, [rules, filter, canEdit, ownSiteType]);

  const filterOptions = [
    { value: 'all' as const, label: t('more.siteRules.all') },
    ...TYPES.map((type) => ({
      value: type,
      label: t(`more.sites.types.${type}`),
    })),
  ];

  if (!allowed) {
    const denied = (
      <StateView
        variant="empty"
        icon={ListFilter}
        title={t('more.siteRules.accessDeniedTitle')}
        description={t('more.siteRules.accessDeniedDesc')}
      />
    );
    return embedded ? denied : <Screen>{denied}</Screen>;
  }

  const body = (
      <ScrollView
        contentContainerClassName={embedded ? 'pb-12' : 'px-5 pb-12 pt-4'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {embedded ? null : (
        <PageHeader
          kicker={t('more.siteRules.kicker')}
          title={t('more.siteRules.title')}
          subtitle={t('more.siteRules.subtitle')}
          icon={ListFilter}
        >
          <View className="flex-row items-center gap-2">
            <Pill
              tone="mint"
              label={t('more.siteRules.count', {
                count: rules?.length ?? 0,
                plural: (rules?.length ?? 0) === 1 ? '' : 's',
              })}
            />
            <Text className="flex-1 text-[10.5px] leading-[1.5] text-dashboard-caption">
              {t('more.siteRules.intro')}
            </Text>
          </View>
        </PageHeader>
        )}

        {error ? (
          <View className="mb-3 rounded-lg bg-dashboard-error-bg px-3 py-2">
            <Text
              accessibilityRole="alert"
              className="text-[11px] leading-[1.7] text-dashboard-error-text"
            >
              {error}
            </Text>
            {rules === null ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void load()}
                className="mt-1.5 self-start active:opacity-70"
              >
                <Text className="text-[11px] font-semibold text-dashboard-error-text">
                  {t('more.siteRules.retry')} →
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!canEdit ? (
          <Text className="mb-3 text-sm text-dashboard-caption">
            {t('more.siteRules.readOnly')}
          </Text>
        ) : null}

        {canEdit && editing ? (
          <Card className="mb-4">
            <View className="mb-3 flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="text-[13px] font-semibold text-ink">
                  {id === null
                    ? t('more.siteRules.addCategory')
                    : t('more.siteRules.editRule')}
                </Text>
                <Text className="mt-0.5 text-[10.5px] leading-[1.6] text-dashboard-caption">
                  {t('more.siteRules.editorHint')}
                </Text>
              </View>
              <Pill
                tone="citron"
                label={id === null ? t('more.siteRules.new') : `#${id}`}
              />
            </View>

            <Text className="mb-1.5 text-[11px] font-semibold text-dashboard-subtitle">
              {t('more.siteRules.siteType')}
            </Text>
            <SegmentedControl
              className="mb-3"
              value={siteType}
              onChange={(value) => setSiteType(value)}
              options={TYPES.map((type) => ({
                value: type,
                label: t(`more.sites.types.${type}`),
              }))}
              disabled={busy}
            />

            <TextField
              label={t('more.siteRules.categoryCode')}
              value={category}
              onChangeText={setCategory}
              maxLength={128}
              editable={!busy}
              autoCapitalize="none"
            />

            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField
                  label={t('more.siteRules.urgencyWeight')}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numbers-and-punctuation"
                  editable={!busy}
                />
              </View>
              <View className="flex-1">
                <TextField
                  label={t('more.siteRules.sortOrder')}
                  value={order}
                  onChangeText={setOrder}
                  keyboardType="numbers-and-punctuation"
                  editable={!busy}
                />
              </View>
            </View>

            <Button
              label={t('more.siteRules.saveRule')}
              onPress={() => void save()}
              loading={busy}
            />
            <Button
              className="mt-2"
              variant="secondary"
              label={t('more.siteRules.cancel')}
              onPress={() => setEditing(false)}
              disabled={busy}
            />
          </Card>
        ) : canEdit ? (
          <Button
            label={t('more.siteRules.addCategory')}
            onPress={() => edit()}
            disabled={busy}
            className="mb-4"
          />
        ) : null}

        {canEdit ? <SegmentedControl
          className="mb-4"
          value={filter}
          onChange={(value) => setFilter(value)}
          options={filterOptions}
        /> : null}

        {rules === null && busy ? (
          <StateView variant="loading" title={t('more.siteRules.loading')} />
        ) : visible.length === 0 ? (
          <StateView
            variant="empty"
            icon={ListFilter}
            title={t('more.siteRules.emptyTitle')}
            description={canEdit ? t('more.siteRules.emptyDesc') : undefined}
            actionLabel={canEdit ? t('more.siteRules.addCategory') : undefined}
            onAction={canEdit ? () => edit() : undefined}
          />
        ) : (
          <View className="gap-2.5">
            {visible.map((rule) => (
              <Card key={rule.id}>
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-[14px] font-semibold text-ink">
                      {rule.category}
                    </Text>
                    <View className="mt-1.5 flex-row items-center gap-2">
                      <Pill
                        tone="neutral"
                        label={t(`more.sites.types.${rule.siteType}`)}
                      />
                      <Text className="text-[10.5px] text-dashboard-caption">
                        {t('more.siteRules.ordering', {
                          order: rule.sortOrder,
                        })}
                      </Text>
                    </View>
                  </View>
                  <View
                    className="items-center justify-center rounded-lg px-3 py-2"
                    style={{ backgroundColor: dashboardColors.statMintSoft }}
                  >
                    <Text
                      className="text-[15px] font-bold"
                      style={{ color: dashboardColors.statMintDeep }}
                    >
                      {rule.urgencyWeight}
                    </Text>
                    <Text
                      className="text-[8.5px] font-semibold uppercase"
                      style={{ color: dashboardColors.statMintDeep, letterSpacing: 0.5 }}
                    >
                      {t('more.siteRules.weightShort')}
                    </Text>
                  </View>
                </View>

                {canEdit ? <View className="mt-3 flex-row gap-2 border-t border-dashboard-card-line pt-3">
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => edit(rule)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-dashboard-card-line py-2 active:opacity-70"
                  >
                    <Pencil color={dashboardColors.teal} size={13} />
                    <Text className="text-[11px] font-semibold text-ink">
                      {t('more.siteRules.edit')}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(
                        t('more.siteRules.deleteTitle'),
                        t('more.siteRules.deleteMessage', {
                          category: rule.category,
                          type: t(`more.sites.types.${rule.siteType}`),
                        }),
                        [
                          { text: t('more.siteRules.cancel'), style: 'cancel' },
                          {
                            text: t('more.siteRules.deleteConfirm'),
                            style: 'destructive',
                            onPress: () => void remove(rule),
                          },
                        ],
                      )
                    }
                    className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-dashboard-card-line py-2 active:opacity-70"
                  >
                    <Trash2 color={dashboardColors.statCoralDeep} size={13} />
                    <Text
                      className="text-[11px] font-semibold"
                      style={{ color: dashboardColors.statCoralDeep }}
                    >
                      {t('more.siteRules.delete')}
                    </Text>
                  </Pressable>
                </View> : null}
              </Card>
            ))}
          </View>
        )}

        {canEdit ? <View className="mt-4 flex-row items-start gap-2">
          <Plus color={dashboardColors.statMintDeep} size={13} />
          <Text className="flex-1 text-[10px] leading-[1.6] text-dashboard-caption">
            {t('more.siteRules.footerHint')}
          </Text>
        </View> : null}
      </ScrollView>
  );

  return embedded ? body : <Screen>{body}</Screen>;
}

/** Legacy route — category lives as a tab on the Sites hub. */
export default function SiteRulesScreen() {
  return <Redirect href={{ pathname: '/more/sites', params: { tab: 'category' } }} />;
}
