import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { ArrowLeft, Building2, Check, Plus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
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
  getReportingSetup,
  createSubsiteAlert,
  listSubsiteAlerts,
  resolveSubsiteAlert as resolveSubsiteRequest,
  updateSite,
  uploadSiteDocument,
  type SitePayload,
} from '@/services/sites';
import type { ContractStatus, SiteType, Subsite, ReportingSetup, SubsiteAlert } from '@/types';
import { useToast } from '@/components/ui/useToastContext';
import * as DocumentPicker from 'expo-document-picker';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;
type SetupStep = 'buildings' | 'site' | 'terms';

const SETUP_STEPS: SetupStep[] = ['buildings', 'site', 'terms'];

const SITE_TYPES: { value: SiteType; labelKey: string }[] = [
  { value: 'school', labelKey: 'more.sites.types.school' },
  { value: 'hostel', labelKey: 'more.sites.types.hostel' },
  { value: 'hotel', labelKey: 'more.sites.types.hotel' },
];

const POOL_STATUSES: { value: ContractStatus; labelKey: string }[] = [
  { value: 'contracted', labelKey: 'more.sites.contractStatuses.contracted' },
  { value: 'uncontracted', labelKey: 'more.sites.contractStatuses.uncontracted' },
];

export default function SiteSetupScreen() {
  const { t } = useTranslation('common');
  const { showToast } = useToast();
  const router = useRouter();
  const { user, refresh: refreshAuth } = useAuth();
  const { site, loading: siteLoading, error: siteError, refresh: refreshSite } = useCurrentSite();

  const canManage = canManageSubsites(user);

  const [step, setStep] = useState<SetupStep>('buildings');
  const [subsites, setSubsites] = useState<Subsite[] | null>(null);
  const [subsiteAlerts, setSubsiteAlerts] = useState<SubsiteAlert[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportingSetup, setReportingSetup] = useState<ReportingSetup | null>(null);
  const [suggestingBuilding, setSuggestingBuilding] = useState(false);
  const [missingBuildingName, setMissingBuildingName] = useState('');
  const [missingBuildingDescription, setMissingBuildingDescription] = useState('');
  const [suggestionSuccess, setSuggestionSuccess] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const [siteName, setSiteName] = useState('');
  const [siteType, setSiteType] = useState<SiteType>('school');
  const [sitePool, setSitePool] = useState<ContractStatus>('uncontracted');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [termsText, setTermsText] = useState('');
  const [contractTermsText, setContractTermsText] = useState('');
  const [siteStepSaved, setSiteStepSaved] = useState(false);
  const [stepSeeded, setStepSeeded] = useState(false);

  const load = useCallback(async () => {
    if (!site) return;
    setError(null);
    setLoading(true);
    try {
      const subsites = await listSubsites(site.id);
      setSubsites(subsites);
      const alerts = await listSubsiteAlerts(site.id);
      setSubsiteAlerts(alerts);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [site?.id, t]);

  const loadReportingSetup = useCallback(async () => {
    if (!site) return;
    setLoading(true);
    setError(null);
    try {
      const setup = await getReportingSetup(site.id);
      setReportingSetup(setup);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotLoadSetup'),
      );
    } finally {
      setLoading(false);
    }
  }, [site?.id, t]);

  useEffect(() => {
    if (!site) return;
    void load();
    void loadReportingSetup();
  }, [site?.id, load, loadReportingSetup]);

  useEffect(() => {
    if (!site) return;
    setSiteName(site.name);
    setSiteType(site.type);
    setSitePool(site.contractStatus);
    setSiteAddress(site.address ?? '');
    setSiteDescription(site.description ?? '');
    setTermsText(site.termsText ?? '');
    setContractTermsText(site.contractTermsText ?? '');
  }, [site?.id, site?.updatedAt]);

  const buildingsDone = useMemo(
    () => (subsites ?? []).some((row) => row.archivedAt === null),
    [subsites],
  );
  // Site step is "done" only after the admin saves it in this wizard (or terms
  // already exist from a prior edit). Prefill alone must not skip confirmation.
  const termsDone = Boolean(
    site?.termsDocumentPresent && site?.contractTermsDocumentPresent,
  );
  // Site step unlocks terms only after an explicit save in this wizard, or when
  // documents are already on file from a prior completed setup.
  const siteDone = siteStepSaved || termsDone;

  useEffect(() => {
    if (stepSeeded || subsites === null || !site) return;
    if (!buildingsDone) setStep('buildings');
    else if (!siteDone) setStep('site');
    else if (!termsDone) setStep('terms');
    else setStep('buildings');
    setStepSeeded(true);
  }, [stepSeeded, subsites, site, buildingsDone, siteDone, termsDone]);

  async function saveSiteDetails() {
    if (!site || !siteName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const payload: SitePayload = {
        name: siteName.trim(),
        type: siteType,
        contractStatus: sitePool,
        address: siteAddress.trim() || undefined,
        description: siteDescription.trim() || undefined,
        imageUrl: site.imageUrl ?? undefined,
        contractFlatFeeMinor: site.contractFlatFeeMinor,
        contractFeeCurrency: site.contractFeeCurrency,
        termsText: termsText.trim() || null,
        contractTermsText: contractTermsText.trim() || null,
      };
      await updateSite(site.id, payload);
      await refreshSite();
      setSiteStepSaved(true);
      showToast(t('siteSetup.siteSaved'), 'success');
      setStep('terms');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('more.sites.errors.couldNotSave');
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function pickDocument(kind: 'terms' | 'contract') {
    if (!site || busy) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setBusy(true);
    setError(null);
    try {
      const updated = await uploadSiteDocument(site.id, kind, {
        uri: asset.uri,
        name: asset.name || `${kind}.txt`,
        mimeType: asset.mimeType,
      });
      // Prefer the upload response so the path/name shows immediately.
      if (kind === 'terms') {
        setTermsText(updated.termsDocumentName || updated.termsText || asset.name || '');
      } else {
        setContractTermsText(
          updated.contractTermsDocumentName || updated.contractTermsText || asset.name || '',
        );
      }
      await refreshSite();
      await refreshAuth();
      showToast(t('siteSetup.documentUploaded'), 'success');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotUpload');
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function finishSetup() {
    if (!site) return;
    if (!site.termsDocumentPresent || !site.contractTermsDocumentPresent) {
      setError(t('siteSetup.documentsRequired'));
      return;
    }
    await refreshAuth();
    showToast(t('siteSetup.termsSaved'), 'success');
    router.replace('/');
  }

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
      await handleSubsiteAction();
      showToast(t('siteSetup.successSave'), 'success');
      cancelForm();
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotSave');
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setBusy(false);
    }
  }


  async function suggestMissingBuilding() {
    if (!site || !missingBuildingName.trim()) return;
    setBusy(true);
    setSuggestionError(null);
    try {
      await createSubsiteAlert(site.id, missingBuildingName.trim());
      setSuggestionSuccess(true);
      setMissingBuildingName('');
      setMissingBuildingDescription('');
      // Refresh alerts after suggestion
      const alerts = await listSubsiteAlerts(site.id);
      setSubsiteAlerts(alerts);
      showToast(t('siteSetup.successSuggest'), 'success');
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotSuggest');
      setSuggestionError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function resolveSubsiteAlert(alertId: number) {
    if (!site) return;
    setBusy(true);
    setError(null);
    try {
      await resolveSubsiteRequest(site.id, alertId);
      // Refresh alerts after resolution
      const alerts = await listSubsiteAlerts(site.id);
      setSubsiteAlerts(alerts);
      setSuggestionSuccess(true);
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotResolve');
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setBusy(false);
    }
  }

  function openSuggestBuilding() {
    setSuggestingBuilding(true);
    setSuggestionSuccess(false);
    setSuggestionError(null);
  }

  function closeSuggestBuilding() {
    setSuggestingBuilding(false);
    setMissingBuildingName('');
    setMissingBuildingDescription('');
  }
  async function handleSubsiteAction() {
    if (creating) {
      await createSubsite(site!.id, {
        label: label.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } else if (editingId !== null) {
      await updateSubsite(site!.id, editingId, {
        label: label.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
    }
    await load();
    await refreshAuth();
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
              showToast(t('siteSetup.successArchive'), 'success');
            } catch (err) {
              const errorMessage = err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotArchive');
              setError(errorMessage);
              showToast(errorMessage, 'error');
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

  const active = (subsites ?? []).filter((s: Subsite) => s.archivedAt === null);
  const archived = (subsites ?? []).filter((s: Subsite) => s.archivedAt !== null);

  const editingRow = editingId !== null ? subsites?.find((r: Subsite) => r.id === editingId) : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('siteSetup.title') }} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('siteSetup.title')}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/more');
          }}
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

        <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
          {t('siteSetup.intro')}
        </Text>

        <SetupStepBar
          step={step}
          buildingsDone={buildingsDone}
          siteDone={siteDone}
          termsDone={termsDone}
          t={t}
          onSelect={(next) => {
            if (next === 'site' && !buildingsDone) return;
            if (next === 'terms' && (!buildingsDone || !siteDone)) return;
            setStep(next);
          }}
        />

        {step === 'buildings' ? (
          <>
            <Text className="mb-3 text-[12px] leading-[1.7] text-dashboard-subtitle">
              {t('siteSetup.buildingsIntro')}
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
                      onSave={async () => {
                        try {
                          await saveForm();
                        } catch (err) {
                          console.error('Error in saveForm:', err);
                        }
                      }}
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
                    {subsites.length} {t('siteSetup.buildingsCount', { count: subsites.length, plural: subsites.length === 1 ? '' : 's' })}
                    {' · '}
                    {t('siteSetup.activeCount', { count: active.length })}
                    {archived.length > 0
                      ? ` · ${t('siteSetup.archivedCount', { count: archived.length })}`
                      : ''}
                  </Text>
                )}

                <Text className="mb-2 mt-3 text-[15px] font-semibold text-ink" style={{ letterSpacing: -0.3 }}>
                  {t('siteSetup.missingBuildings')}
                </Text>
                {subsiteAlerts !== null && subsiteAlerts.length > 0 ? (
                  <Card padded={false} className="mb-4">
                    {subsiteAlerts.map((alert) => (
                      <View
                        key={alert.id}
                        className="border-t border-dashboard-card-line px-4 py-3"
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="text-sm font-semibold text-ink" numberOfLines={2}>
                            {alert.note}
                          </Text>
                          <Pressable
                            onPress={async () => {
                              try {
                                await resolveSubsiteAlert(alert.id);
                                showToast(t('siteSetup.successResolve'), 'success');
                              } catch (err) {
                                const errorMessage = err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotResolve');
                                setError(errorMessage);
                                showToast(errorMessage, 'error');
                              }
                            }}
                            accessibilityRole="button"
                            className="flex-row items-center gap-1 active:opacity-70"
                          >
                            <Text className="text-[11px] font-medium text-tone-success underline">
                              {t('siteSetup.resolve')}
                            </Text>
                          </Pressable>
                        </View>
                        <Text className="mt-1 text-[10px] text-dashboard-subtitle">
                          {t('siteSetup.createdAt', { date: alert.createdAt })}
                        </Text>
                      </View>
                    ))}
                  </Card>
                ) : (
                  <Card className="mb-4">
                    <Text className="p-4 text-center text-dashboard-subtitle">
                      {t('siteSetup.noMissingBuildings')}
                    </Text>
                  </Card>
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
                    <View className="flex-row items-center justify-between px-4 py-3">
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={entry.row.label}
                        onPress={() => openEdit(entry.row)}
                        className="flex-1 active:opacity-80"
                      >
                      <View>
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
                      </Pressable>
                      {!entry.archived ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('siteSetup.archiveConfirmTitle', { label: entry.row.label })}
                          onPress={async () => {
                            try {
                              await archiveSubsite(site!.id, entry.row.id);
                              await load();
                              await refreshAuth();
                              showToast(t('siteSetup.successArchive'), 'success');
                            } catch (err) {
                              const errorMessage = err instanceof ApiError ? err.message : t('siteSetup.errors.couldNotArchive');
                              setError(errorMessage);
                              showToast(errorMessage, 'error');
                            }
                          }}
                          className="h-7 w-7 items-center justify-center rounded-full active:opacity-70"
                        >
                          <X color={dashboardColors.statCoralDeep} size={14} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </Card>

            {buildingsDone ? (
              <Button
                className="mt-4"
                label={t('siteSetup.continueSite')}
                onPress={() => setStep('site')}
              />
            ) : null}

            <Text className="mt-4 text-[10px] leading-[1.8] text-dashboard-caption">
              {t('siteSetup.helper')}
            </Text>
          </>
        ) : null}

        {step === 'site' ? (
          <Card className="mb-4">
            <Text className="mb-3 text-[12px] leading-[1.7] text-dashboard-subtitle">
              {t('siteSetup.siteIntro')}
            </Text>
            <TextField
              label={t('siteSetup.siteNameLabel')}
              value={siteName}
              onChangeText={setSiteName}
              autoCapitalize="words"
            />
            <Picker
              label={t('more.sites.typeLabel')}
              value={siteType}
              onChange={(value) => setSiteType(value as SiteType)}
              options={SITE_TYPES.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
            />
            <Picker
              label={t('more.sites.contractStatusLabel')}
              value={sitePool}
              onChange={(value) => setSitePool(value as ContractStatus)}
              options={POOL_STATUSES.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
            />
            <Text className="mb-3 -mt-2 text-[11px] leading-[1.6] text-dashboard-caption">
              {t('more.sites.contractStatusHint')}
            </Text>
            <TextField
              label={t('siteSetup.siteAddressLabel')}
              value={siteAddress}
              onChangeText={setSiteAddress}
              autoCapitalize="words"
            />
            <TextField
              label={t('siteSetup.siteDescriptionLabel')}
              value={siteDescription}
              onChangeText={setSiteDescription}
              multiline
              numberOfLines={3}
            />
            {error ? <Text className="mb-2 text-[12px] text-tone-danger">{error}</Text> : null}
            <View className="mt-1 flex-row gap-2">
              <Button
                className="flex-1"
                variant="secondary"
                label={t('siteSetup.backBuildings')}
                onPress={() => setStep('buildings')}
              />
              <Button
                className="flex-1"
                label={t('siteSetup.saveSiteDetails')}
                loading={busy}
                disabled={busy || !siteName.trim() || !siteAddress.trim()}
                onPress={() => void saveSiteDetails()}
              />
            </View>
          </Card>
        ) : null}

        {step === 'terms' ? (
          <Card className="mb-4">
            <Text className="mb-3 text-[12px] leading-[1.7] text-dashboard-subtitle">
              {t('siteSetup.termsIntro')}
            </Text>
            <DocumentUploadRow
              label={t('more.sites.termsLabel')}
              filename={site?.termsDocumentName}
              present={Boolean(site?.termsDocumentPresent)}
              busy={busy}
              t={t}
              onPick={() => void pickDocument('terms')}
            />
            <DocumentUploadRow
              label={t('more.sites.contractTermsLabel')}
              filename={site?.contractTermsDocumentName}
              present={Boolean(site?.contractTermsDocumentPresent)}
              busy={busy}
              t={t}
              onPick={() => void pickDocument('contract')}
            />
            <Text className="mb-3 text-[11px] leading-[1.6] text-dashboard-caption">
              {t('siteSetup.termsCompleteHint')}
            </Text>
            {error ? <Text className="mb-2 text-[12px] text-tone-danger">{error}</Text> : null}
            <View className="mt-1 flex-row gap-2">
              <Button
                className="flex-1"
                variant="secondary"
                label={t('siteSetup.backSite')}
                onPress={() => setStep('site')}
              />
              <Button
                className="flex-1"
                label={t('siteSetup.finishSetup')}
                loading={busy}
                disabled={busy || !termsDone}
                onPress={() => void finishSetup()}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SetupStepBar({
  step,
  buildingsDone,
  siteDone,
  termsDone,
  t,
  onSelect,
}: {
  step: SetupStep;
  buildingsDone: boolean;
  siteDone: boolean;
  termsDone: boolean;
  t: TranslateFn;
  onSelect: (step: SetupStep) => void;
}) {
  const done = { buildings: buildingsDone, site: siteDone, terms: termsDone };
  return (
    <View className="mb-3 overflow-hidden rounded-[10px] border border-dashboard-card-line bg-dashboard-card-bg">
      <Text
        className="border-b border-dashboard-card-line px-3 py-1.5 text-[9px] font-semibold uppercase text-dashboard-caption"
        style={{ letterSpacing: 0.7 }}
      >
        {t('siteSetup.steps.kicker')}
      </Text>
      <View className="flex-row">
        {SETUP_STEPS.map((id, index) => {
          const active = step === id;
          const complete = done[id];
          const locked =
            (id === 'site' && !buildingsDone) ||
            (id === 'terms' && (!buildingsDone || !siteDone));
          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              disabled={locked}
              onPress={() => onSelect(id)}
              className={`flex-1 items-center px-1.5 py-2 ${index > 0 ? 'border-l border-dashboard-card-line' : ''} ${locked ? 'opacity-45' : 'active:opacity-70'}`}
              style={{
                backgroundColor: active ? dashboardColors.statMintSoft : undefined,
              }}
            >
              <View
                className="mb-1 h-5 w-5 items-center justify-center rounded-full"
                style={{
                  backgroundColor: complete
                    ? dashboardColors.statMintDeep
                    : active
                      ? dashboardColors.teal
                      : dashboardColors.cardLine,
                }}
              >
                {complete ? (
                  <Check color="#fff" size={11} strokeWidth={2.4} />
                ) : (
                  <Text className="text-[9px] font-bold text-ink">{index + 1}</Text>
                )}
              </View>
              <Text
                className="text-center text-[10px] font-semibold"
                style={{ color: active ? dashboardColors.statMintDeep : dashboardColors.subtitle }}
              >
                {t(`siteSetup.steps.${id}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DocumentUploadRow({
  label,
  filename,
  present,
  busy,
  t,
  onPick,
}: {
  label: string;
  filename: string | null | undefined;
  present: boolean;
  busy: boolean;
  t: TranslateFn;
  onPick: () => void;
}) {
  return (
    <View className="mb-3 rounded-lg border border-dashboard-card-line px-3 py-2.5">
      <Text className="mb-1 text-[12px] font-semibold text-ink">{label}</Text>
      <Text className="mb-2 text-[11px] leading-[1.5] text-dashboard-caption">
        {present
          ? t('siteSetup.documentOnFile', { name: filename || t('siteSetup.documentFallback') })
          : t('siteSetup.documentMissing')}
      </Text>
      <Button
        variant="secondary"
        label={present ? t('siteSetup.replaceDocument') : t('siteSetup.uploadDocument')}
        loading={busy}
        disabled={busy}
        onPress={onPick}
      />
    </View>
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
          onPress={async () => {
            try {
              await onSave();
            } catch (err) {
              console.error('Error in saveForm:', err);
            }
          }}
          loading={busy}
          disabled={!valid || busy}
          className="flex-1"
        />
      </View>
    </View>
  );
}
