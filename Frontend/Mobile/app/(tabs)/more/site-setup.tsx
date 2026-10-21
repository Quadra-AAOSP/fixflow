import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Building2, Plus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { dashboardColors } from '@/constants/theme';
import { canManageSubsites } from '@/constants/access';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { useCurrentSite } from '@/stores/site';
import {
  createSubsite,
  listSubsites,
  updateSubsite,
  archiveSubsite,
} from '@/services/sites';
import type { Subsite } from '@/types';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

export default function SiteSetupScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();
  const { site, loading: siteLoading, error: siteError, refresh: refreshSite } = useCurrentSite();

  const canManage = canManageSubsites(user);

  const [subsites, setSubsites] = useState<Subsite[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!site) return;
    setError(null);
    setLoading(true);
    try {
      setSubsites(await listSubsites(site.id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [site?.id, t]);

  useEffect(() => {
    if (!site) return;
    void load();
  }, [site?.id, load]);

  function openEdit(row: Subsite) {
    setEditingId(row.id);
    setCreating(false);
    setLabel(row.label);
    setName(row.name);
    setDescription(row.description ?? '');
  }

  function openCreate() {
    setCreating(true);
    setEditingId(null);
    setLabel('');
    setName('');
    setDescription('');
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
    setLabel('');
    setName('');
    setDescription('');
  }

  async function saveForm() {
    if (!site) return;
    if (!label.trim() || !name.trim()) return;
    setBusy(true);
    try {
      if (creating) {
        await createSubsite(site.id, {
          label: label.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else if (editingId !== null) {
        await updateSubsite(site.id, editingId, {
          label: label.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
        });
      }
      cancelForm();
      await load();
    } catch (err) {
      Alert.alert(
        t('siteSetup.errors.couldNotSave'),
        err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotSave'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmArchive(row: Subsite) {
    Alert.alert(
      t('siteSetup.archiveConfirmTitle', { label: row.label }),
      t('siteSetup.archiveConfirmBody'),
      [
        { text: t('siteSetup.archiveConfirmCancel'), style: 'cancel' },
        {
          text: t('siteSetup.archiveConfirmOk'),
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveSubsite(site!.id, row.id);
              await load();
            } catch (err) {
              Alert.alert(
                t('siteSetup.errors.couldNotArchive'),
                err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotArchive'),
              );
            }
          },
        },
      ],
    );
  }

  // Gated screens — mirror the web `SiteSetupView.vue` guards.
  if (!canManage) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('siteSetup.title') }} />
        <StateView
          variant="empty"
          icon={Building2}
          title={t('siteSetup.adminOnlyTitle')}
          description={t('siteSetup.adminOnlyDesc')}
        />
      </Screen>
    );
  }
  if (!site) {
    if (siteLoading) {
      return (
        <Screen>
          <Stack.Screen options={{ title: t('siteSetup.title') }} />
          <StateView variant="loading" title={t('siteSetup.loadingBuildings')} />
        </Screen>
      );
    }
    if (siteError) {
      return (
        <Screen>
          <Stack.Screen options={{ title: t('siteSetup.title') }} />
          <StateView
            variant="error"
            description={siteError.message}
            actionLabel={t('assignments.errors.retry')}
            onAction={() => { void refreshSite(); }}
          />
        </Screen>
      );
    }
    return (
      <Screen>
        <Stack.Screen options={{ title: t('siteSetup.title') }} />
        <StateView
          variant="empty"
          icon={Building2}
          title={t('siteSetup.noSiteTitle')}
          description={t('siteSetup.noSiteDesc')}
        />
      </Screen>
    );
  }

  const active = (subsites ?? []).filter((s) => s.archivedAt === null);
  const archived = (subsites ?? []).filter((s) => s.archivedAt !== null);

  const editingRow = editingId !== null ? subsites?.find((r) => r.id === editingId) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('siteSetup.title') }} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('siteSetup.title')}
          onPress={() => router.back()}
          className="mb-2 flex-row items-center gap-1 self-start active:opacity-70"
        >
          <ArrowLeft color={dashboardColors.teal} size={15} />
          <Text
            className="text-[11px] font-semibold"
            style={{ color: dashboardColors.teal }}
          >
            {t('siteSetup.title')}
          </Text>
        </Pressable>

        <Text className="mb-4 text-[12px] leading-[1.8] text-dashboard-subtitle">
          {t('siteSetup.intro')}
        </Text>

        <Card className="mb-4">
          {loading ? (
            <Text className="text-[12px] text-dashboard-caption">
              {t('siteSetup.loadingBuildings')}
            </Text>
          ) : error ? (
            <Text className="text-[12px] text-tone-danger">{error}</Text>
          ) : (
            <>
              <ReadinessRow active={active.length} archived={archived.length} t={t} />

              {creating || editingRow ? (
                <EditForm
                  t={t}
                  creating={creating}
                  label={label}
                  name={name}
                  description={description}
                  onChangeLabel={setLabel}
                  onChangeName={setName}
                  onChangeDescription={setDescription}
                  onCancel={cancelForm}
                  onSave={saveForm}
                  busy={busy}
                />
              ) : null}

              {!creating && !editingRow ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('siteSetup.addBuilding')}
                  onPress={openCreate}
                  className="flex-row items-center justify-center gap-2 rounded-[11px] border border-dashboard-card-line bg-dashboard-card-bg px-4 py-3 active:opacity-80"
                >
                  <Plus color={dashboardColors.teal} size={18} strokeWidth={2.1} />
                  <Text className="text-[13px] font-semibold text-dashboard-teal">
                    {t('siteSetup.addBuilding')}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </Card>

        <Card padded={false}>
          <View className="px-4 pb-2 pt-4">
            <Text className="text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
              {t('siteSetup.buildingsHeader')}
            </Text>
            {subsites !== null && (
              <Text className="mt-0.5 text-[10px] text-dashboard-subtitle">
                {t('siteSetup.activeCount', { count: active.length })}
                {archived.length > 0
                  ? ` · ${t('siteSetup.archivedCount', { count: archived.length })}`
                  : ''}
              </Text>
            )}
          </View>
          {subsites === null || loading ? null : active.length === 0 && archived.length === 0 ? (
            <Text className="px-4 pb-4 text-center text-[11px] text-dashboard-caption">
              {t('siteSetup.noBuildings')}
            </Text>
          ) : (
            [
              ...active.map((s) => ({ row: s, archived: false })),
              ...archived.map((s) => ({ row: s, archived: true })),
            ].map((entry, idx) => (
              <View key={entry.row.id}>
                {idx > 0 ? (
                  <View className="mx-4 border-t border-dashboard-card-line" />
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={entry.row.label}
                  onPress={() => openEdit(entry.row)}
                  className="flex-row items-center justify-between px-4 py-3 active:opacity-80"
                >
                  <View className="flex-1">
                    <Text className="text-[12px] font-semibold text-ink">
                      {entry.row.label} · {entry.row.name}
                      {entry.archived ? t('siteSetup.archivedSuffix') : ''}
                    </Text>
                    {entry.row.description ? (
                      <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                        {entry.row.description}
                      </Text>
                    ) : null}
                  </View>
                  {!entry.archived ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('siteSetup.archiveConfirmTitle', { label: entry.row.label })}
                      onPress={() => confirmArchive(entry.row)}
                      className="h-7 w-7 items-center justify-center rounded-full active:opacity-70"
                    >
                      <X color={dashboardColors.statCoralDeep} size={14} />
                    </Pressable>
                  ) : null}
                </Pressable>
              </View>
            ))
          )}
        </Card>

        <Text className="mt-4 text-[10px] leading-[1.8] text-dashboard-caption">
          {t('siteSetup.helper')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function ReadinessRow({
  active, archived, t,
}: {
  active: number;
  archived: number;
  t: TranslateFn;
}) {
  const ready = active > 0;
  return (
    <View
      className="mb-3 rounded-md border px-3 py-2"
      style={{
        backgroundColor: ready
          ? dashboardColors.statMintSoft
          : dashboardColors.statCitronSoft,
        borderColor: ready
          ? dashboardColors.statMintSoft
          : dashboardColors.statCitronSoft,
      }}
    >
      <Text
        className="text-[12px] font-semibold"
        style={{
          color: ready
            ? dashboardColors.statMintDeep
            : dashboardColors.statCitronDeep,
        }}
      >
        {ready
          ? t('siteSetup.readinessReady')
          : t('siteSetup.readinessSetupRequired')}
      </Text>
      <Text className="mt-0.5 text-[10px] text-dashboard-caption">
        {ready
          ? t('siteSetup.readinessReadyDesc', { count: active, plural: active === 1 ? '' : 's' })
          : t('siteSetup.readinessSetupRequiredDesc')}
      </Text>
    </View>
  );
}

function EditForm({
  t, creating, label, name, description,
  onChangeLabel, onChangeName, onChangeDescription,
  onCancel, onSave, busy,
}: {
  t: TranslateFn;
  creating: boolean;
  label: string; name: string; description: string;
  onChangeLabel: (v: string) => void;
  onChangeName: (v: string) => void;
  onChangeDescription: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  const valid = label.trim().length > 0 && name.trim().length > 0;
  return (
    <View className="mb-3 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3">
      <Text className="mb-2 text-[12px] font-semibold text-ink">
        {creating ? t('siteSetup.addBuilding') : t('siteSetup.editBuilding', { label })}
      </Text>
      <TextField
        label={t('siteSetup.labelField')}
        value={label}
        onChangeText={onChangeLabel}
        placeholder={t('siteSetup.labelPlaceholder')}
      />
      <TextField
        label={t('siteSetup.nameField')}
        value={name}
        onChangeText={onChangeName}
        placeholder={t('siteSetup.namePlaceholder')}
      />
      <TextField
        label={t('siteSetup.descField')}
        value={description}
        onChangeText={onChangeDescription}
        multiline
        numberOfLines={2}
        placeholder={t('siteSetup.descPlaceholder')}
      />
      {!valid ? (
        <Text className="mb-2 text-[10px] text-tone-danger">
          {t('siteSetup.buildingRequired')}
        </Text>
      ) : null}
      <View className="mt-1 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('siteSetup.cancelEdit')}
          onPress={onCancel}
          className="flex-1 rounded-md border border-dashboard-card-line bg-dashboard-card-bg py-2 active:opacity-80"
        >
          <Text className="text-center text-[11px] font-semibold text-dashboard-caption">
            {t('siteSetup.cancelEdit')}
          </Text>
        </Pressable>
        <Button
          label={creating ? t('siteSetup.addBuildingButton') : t('siteSetup.saveChanges')}
          onPress={onSave}
          loading={busy}
          disabled={!valid || busy}
          className="flex-1"
        />
      </View>
    </View>
  );
}
