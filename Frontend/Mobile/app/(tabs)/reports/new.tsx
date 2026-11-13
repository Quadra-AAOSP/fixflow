import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Camera,
  House,
  ImagePlus,
  Plus,
  Sparkles,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { TriageChat } from '@/components/chat/TriageChat';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import {
  SegmentedControl,
  type SegmentedOption,
} from '@/components/ui/SegmentedControl';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { dashboardColors } from '@/constants/theme';
import { useToast } from '@/components/ui/useToastContext';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { MAX_PHOTO_COUNT, MAX_PHOTO_SIZE_BYTES, uploadPhoto } from '@/services/photos';
import { createReport } from '@/services/reports';
import { enqueueReport } from '@/lib/offlineQueue';
import { isNetworkFailure } from '@/services/offlineReports';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { listJoinableSites } from '@/services/auth';
import { listSiteRules } from '@/services/siteRules';
import { listSubsites, createSubsiteAlert } from '@/services/sites';
import type {
  JoinableSite,
  ReportPhoto,
  ReportVisibility,
  SiteRule,
  SiteType,
  Subsite,
  TriageSuggestedFields,
  Urgency,
} from '@/types';
import { useCurrentSite } from '@/stores/site';
import { humanize } from '@/utils/format';
import { urgencyLabels } from '@/utils/maintenance';

type PickedPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

const URGENCY_OPTIONS: SegmentedOption<Urgency>[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const VISIBILITY_OPTIONS: SegmentedOption<ReportVisibility>[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

function extFromUri(uri: string): string {
  const match = uri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

function mimeForUri(uri: string, fallback?: string): string {
  const candidate = (fallback ?? '').toLowerCase();
  if (candidate === 'image/png' || candidate === 'image/jpeg' || candidate === 'image/jpg') {
    return candidate === 'image/jpg' ? 'image/jpeg' : candidate;
  }
  const ext = extFromUri(uri);
  if (ext === 'png') return 'image/png';
  return 'image/jpeg';
}

export default function NewReportScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();
  const { site, loading: siteLoading, error: siteError, refresh: refreshSite } = useCurrentSite();
  const { showToast } = useToast();
  const { refreshPending } = useConnectivity();
  const recorder = useAudioRecorder();

  const canCreate = user?.capabilities.createReport ?? false;

  // Form state
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [subsiteId, setSubsiteId] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [urgencyReason, setUrgencyReason] = useState('');
  const [visibility, setVisibility] = useState<ReportVisibility>('public');

  // Lookup data
  const [subsites, setSubsites] = useState<Subsite[]>([]);
  const [rules, setRules] = useState<SiteRule[]>([]);
  const [loadingSubsites, setLoadingSubsites] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [subsiteError, setSubsiteError] = useState<string | null>(null);
  const [ruleError, setRuleError] = useState<string | null>(null);

  // Photos
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Triage
  const [triageOpen, setTriageOpen] = useState(false);

  // Missing-building suggestion
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionBusy, setSuggestionBusy] = useState(false);

  // Anyone who can file may pick the site the issue is at; the account site is
  // only the default. The public site directory lists every existing site.
  const canPickSite =
    user?.role === 'reporter' ||
    user?.role === 'staff' ||
    user?.role === 'admin' ||
    user?.role === 'super_admin';
  const [siteOptions, setSiteOptions] = useState<JoinableSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [siteListError, setSiteListError] = useState<string | null>(null);

  useEffect(() => {
    if (!canPickSite) return;
    let active = true;
    listJoinableSites()
      .then((list) => {
        if (active) setSiteOptions(list);
      })
      .catch((err: unknown) => {
        if (active) {
          setSiteListError(
            err instanceof ApiError ? err.message : t('reports.new.siteLoadFail'),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [canPickSite, t]);

  const activeSite = useMemo(() => {
    if (canPickSite && selectedSiteId) {
      const picked = siteOptions.find((o) => String(o.id) === selectedSiteId);
      if (picked) return { id: picked.id, name: picked.name, type: picked.type };
    }
    return site ? { id: site.id, name: site.name, type: site.type } : null;
  }, [canPickSite, selectedSiteId, siteOptions, site]);

  // Accounts registered without a site (reporters) still need a working
  // default: pick the first listed site until they choose one.
  useEffect(() => {
    if (selectedSiteId || site) return;
    const first = siteOptions[0];
    if (first) setSelectedSiteId(String(first.id));
  }, [selectedSiteId, site, siteOptions]);

  const activeSubsites = useMemo(
    () => subsites.filter((s) => s.archivedAt == null),
    [subsites],
  );

  const loadSubsites = useCallback(async (siteId: number) => {
    setLoadingSubsites(true);
    setSubsiteError(null);
    try {
      const result = await listSubsites(siteId);
      setSubsites(result);
    } catch (err) {
      setSubsiteError(
        err instanceof ApiError ? err.message : t('reports.new.buildingLoadFail'),
      );
    } finally {
      setLoadingSubsites(false);
    }
  }, [t]);

  const loadRules = useCallback(async (siteType: SiteType) => {
    setLoadingRules(true);
    setRuleError(null);
    try {
      const result = await listSiteRules(siteType);
      setRules(result);
    } catch (err) {
      setRuleError(
        err instanceof ApiError ? err.message : t('reports.new.categoryLoadFail'),
      );
    } finally {
      setLoadingRules(false);
    }
  }, [t]);

  useEffect(() => {
    if (!activeSite) return;
    void loadSubsites(activeSite.id);
    void loadRules(activeSite.type);
  }, [activeSite?.id, activeSite?.type, loadSubsites, loadRules]);

  const categoryOptions = useMemo(
    () => rules.map((r) => ({ value: r.category, label: humanize(r.category) })),
    [rules],
  );

  const subsiteOptions = useMemo(
    () =>
      activeSubsites.map((s) => ({
        value: String(s.id),
        label: s.label ? `${s.label} — ${s.name}` : s.name,
      })),
    [activeSubsites],
  );

  function applyTriage(fields: TriageSuggestedFields) {
    if (fields.category && !category) setCategory(fields.category);
    if (fields.urgency && !urgency) setUrgency(fields.urgency);
    if (fields.descriptionDraft && !description.trim()) {
      setDescription(fields.descriptionDraft);
    }
  }

  async function pickPhotos(source: 'gallery' | 'camera') {
    if (photos.length >= MAX_PHOTO_COUNT) {
      showToast(t('reports.new.photos.limitReached', { max: MAX_PHOTO_COUNT }), 'info');
      return;
    }

    const permissionResult =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      showToast(t('reports.new.photos.permissionDenied'), 'error');
      return;
    }

    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      selectionLimit: 1,
      quality: 0.7,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);

    if (result.canceled || !result.assets?.length) return;

    const accepted: PickedPhoto[] = [];
    for (const asset of result.assets) {
      if (accepted.length + photos.length >= MAX_PHOTO_COUNT) break;
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
        showToast(
          t('reports.new.photos.tooLarge', { size: (MAX_PHOTO_SIZE_BYTES / (1024 * 1024)).toFixed(1) }),
          'error',
        );
        continue;
      }
      accepted.push({
        uri: asset.uri,
        fileName: asset.fileName ?? `photo.${extFromUri(asset.uri)}`,
        mimeType: mimeForUri(asset.uri, asset.mimeType),
        fileSize: asset.fileSize ?? 0,
      });
    }

    if (accepted.length) {
      setPhotos((prev) => [...prev, ...accepted]);
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function validate(): string | null {
    if (!activeSite) return t('reports.new.siteRequired');
    if (!description.trim()) return t('reports.new.descErrors.required');
    if (description.trim().length < 10) return t('reports.new.descErrors.tooShort');
    if (description.length > 10000) return t('reports.new.descErrors.tooLong');
    if (address.length > 512) return t('reports.new.addressTooLong');
    if (!category) return t('reports.new.categoryError');
    if (activeSubsites.length > 0 && !subsiteId) return t('reports.new.buildingError');
    if (!urgency) return t('reports.new.urgencyError');
    return null;
  }

  async function handleSubmit() {
    if (!activeSite) {
      setSubmitError(t('reports.new.noSiteTitle'));
      return;
    }
    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      showToast(validationError, 'error');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // validate() guarantees category and urgency are non-null at this point.
    if (!category || !urgency) {
      setSubmitError(t('reports.new.categoryError'));
      setSubmitting(false);
      return;
    }

    const payload = {
      description: description.trim(),
      address: address.trim() || undefined,
      category,
      reporterUrgency: urgency,
      reporterReason: urgencyReason.trim() || undefined,
      subsiteId: subsiteId ? Number(subsiteId) : undefined,
      visibility,
      siteId: activeSite.id,
    };

    try {
      const report = await createReport(payload);

      // Upload photos after the report exists.
      if (photos.length > 0) {
        setUploadingPhotos(true);
        const uploaded: ReportPhoto[] = [];
        for (const photo of photos) {
          try {
            const result = await uploadPhoto(
              report.id,
              photo.uri,
              photo.fileName,
              photo.mimeType,
            );
            uploaded.push(result);
          } catch {
            // Individual photo failure should not lose the report.
          }
        }
        if (uploaded.length < photos.length) {
          showToast(t('reports.new.photos.uploadFailed'), 'error');
        }
      }

      showToast(t('reports.new.submitted'), 'success');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/reports');
      }
    } catch (err) {
      // Only transport-level failures queue offline; validation/permission
      // answers from the server must stay inline so the user can fix them.
      if (isNetworkFailure(err)) {
        await enqueueReport(
          payload,
          photos.map((photo) => ({
            uri: photo.uri,
            fileName: photo.fileName,
            mimeType: photo.mimeType,
          })),
        );
        await refreshPending();
        showToast(t('reports.new.queuedOffline'), 'info');
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/reports');
        }
        return;
      }
      const message =
        err instanceof ApiError ? err.message : t('reports.new.noConnection');
      setSubmitError(message);
      showToast(message, 'error');
      // Draft is preserved in state — only clear on success.
    } finally {
      setSubmitting(false);
      setUploadingPhotos(false);
    }
  }

  async function handleSuggestMissing() {
    if (!activeSite || !suggestionText.trim() || suggestionBusy) return;
    setSuggestionBusy(true);
    try {
      await createSubsiteAlert(activeSite.id, suggestionText.trim());
      showToast(t('reports.new.suggestionSuccess'), 'success');
      setSuggestionText('');
      setSuggestionOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t('reports.new.suggestionFailed');
      showToast(message, 'error');
    } finally {
      setSuggestionBusy(false);
    }
  }

  const requiresBuilding = activeSubsites.length > 0;

  // --- Permission / setup gate states ---
  if (!canCreate) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <StateView
            variant="empty"
            icon={House}
            title={t('reports.new.permissionsTitle')}
            description={t('reports.new.permissionsDesc')}
          />
        </View>
      </Screen>
    );
  }

  if (siteLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <StateView variant="loading" title={t('reports.new.loadingSite')} />
        </View>
      </Screen>
    );
  }

  if (siteError || (!canPickSite && !site)) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-6">
          <StateView
            variant="error"
            title={t('reports.new.noSiteTitle')}
            description={siteError?.message ?? t('reports.new.noSiteDesc')}
            actionLabel={t('reports.new.retry')}
            onAction={() => { void refreshSite(); }}
          />
        </View>
      </Screen>
    );
  }

  // Buildings are optional: sites that haven't set any up yet can still take
  // reports, with the location described in the address field instead.

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-8"
          keyboardShouldPersistTaps="handled"
        >
          <Card className="mb-4">
            <Text
              className="text-[22px] font-semibold text-ink"
              style={{ letterSpacing: -0.7 }}
            >
              {t('reports.new.title')}
            </Text>
            <Text className="mt-1 text-[12px] text-dashboard-subtitle">
              {activeSite
                ? t('reports.new.intro', { site: activeSite.name })
                : t('reports.new.pickSiteHint')}
            </Text>
            {canPickSite ? (
              <View className="mt-3">
                <Picker
                  label={t('reports.new.siteLabel')}
                  value={activeSite ? String(activeSite.id) : null}
                  options={siteOptions.map((option) => ({
                    value: String(option.id),
                    label: option.name,
                    disabled: false,
                  }))}
                  onChange={(value) => {
                    setSelectedSiteId(value);
                    // Subsite + category are per-site — drop stale picks.
                    setSubsiteId(null);
                    setCategory(null);
                  }}
                  placeholder={t('reports.new.sitePlaceholderChoose')}
                  emptyMessage={t('reports.new.siteEmpty')}
                  disabled={siteOptions.length === 0}
                />
                {siteListError ? (
                  <Text className="-mt-2 mb-4 text-[11px] text-coral-link">{siteListError}</Text>
                ) : null}
              </View>
            ) : null}
            <Text className="mt-2 text-[11px] leading-[1.6] text-dashboard-caption">
              {t('reports.new.savedNotice')}
            </Text>
          </Card>

          <Card className="mb-4">
            <Pressable
              accessibilityRole="button"
              onPress={() => setTriageOpen(true)}
              className="flex-row items-center gap-2 rounded-[10px] px-3 py-2.5 active:opacity-80"
              style={{ backgroundColor: dashboardColors.statMintSoft }}
            >
              <Sparkles color={dashboardColors.statMintDeep} size={15} />
              <Text
                className="text-[12px] font-semibold"
                style={{ color: dashboardColors.statMintDeep }}
              >
                {t('reports.new.triage.open')}
              </Text>
            </Pressable>
          </Card>

          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <Text className="mb-1.5 text-[12px] font-medium text-ink">
                {t('reports.new.descLabel')}
              </Text>
            </View>
            <TextField
              label=""
              value={description}
              onChangeText={setDescription}
              placeholder={t('reports.new.descPlaceholder')}
              multiline
              numberOfLines={5}
              maxLength={10000}
              className="mb-0"
            />

            <TextField
              label={t('reports.new.addressLabel')}
              value={address}
              onChangeText={setAddress}
              placeholder={t('reports.new.addressPlaceholder')}
              maxLength={512}
              className="mt-3"
            />
          </Card>

          <Card className="mb-4">
            {subsiteError ? (
              <StateView
                variant="error"
                description={subsiteError}
                actionLabel={t('reports.new.retryLoadingBuildings')}
                onAction={() => activeSite && void loadSubsites(activeSite.id)}
              />
            ) : (
              <Picker
                label={t('reports.new.buildingLabel')}
                value={subsiteId}
                options={subsiteOptions}
                onChange={setSubsiteId}
                placeholder={
                  loadingSubsites
                    ? t('reports.new.buildingPlaceholderLoading')
                    : t('reports.new.buildingPlaceholderChoose')
                }
                emptyMessage={t('reports.new.buildingLoadError')}
                disabled={loadingSubsites || activeSubsites.length === 0}
              />
            )}

            {!loadingSubsites && activeSubsites.length === 0 && !subsiteError ? (
              <Text className="mb-1 mt-1.5 text-[11.5px] leading-[1.5] text-dashboard-subtitle">
                {t('reports.new.noBuildingsInline')}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => setSuggestionOpen(true)}
              className="mt-2 mb-4 self-start active:opacity-80"
            >
              <Text className="text-[12px] font-semibold text-dashboard-teal underline">
                {t('reports.new.suggestionTitle')}
              </Text>
            </Pressable>

            {ruleError ? (
              <StateView
                variant="error"
                description={ruleError}
                actionLabel={t('reports.new.retryLoadingCategories')}
                onAction={() => activeSite && void loadRules(activeSite.type)}
              />
            ) : (
              <Picker
                label={t('reports.new.categoryLabel')}
                value={category}
                options={categoryOptions}
                onChange={setCategory}
                placeholder={
                  loadingRules
                    ? t('reports.new.categoryPlaceholderLoading')
                    : t('reports.new.categoryPlaceholderChoose')
                }
                emptyMessage={t('reports.new.categoryLoadError')}
                disabled={loadingRules || rules.length === 0}
              />
            )}
          </Card>

          <Card className="mb-4">
            <Text className="mb-2 text-[12px] font-medium text-ink">
              {t('reports.new.urgencyLabel')}
            </Text>
            <SegmentedControl
              options={URGENCY_OPTIONS}
              value={urgency}
              onChange={setUrgency}
              className="mb-3"
            />
            {urgency ? (
              <Text className="mb-2 text-[11px] text-dashboard-subtitle">
                {t(urgencyLabels[urgency])}
              </Text>
            ) : null}
            <TextField
              label={t('reports.new.urgencyReasonLabel')}
              value={urgencyReason}
              onChangeText={setUrgencyReason}
              placeholder={t('reports.new.urgencyReasonPlaceholder')}
              multiline
              numberOfLines={2}
              className="mt-2"
            />
          </Card>

          <Card className="mb-4">
            <Text className="mb-2 text-[12px] font-medium text-ink">
              {t('reports.new.visibilityLabel')}
            </Text>
            <SegmentedControl
              options={VISIBILITY_OPTIONS}
              value={visibility}
              onChange={setVisibility}
              className="mb-2"
            />
            <Text className="text-[11px] leading-[1.6] text-dashboard-subtitle">
              {visibility === 'private'
                ? t('reports.new.visibilityPrivateHint')
                : t('reports.new.visibilityPublicHint')}
            </Text>
          </Card>

          <Card className="mb-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-[12px] font-medium text-ink">
                {t('reports.new.photos.label')}
              </Text>
              <Text className="text-[11px] text-dashboard-subtitle">
                {t('reports.new.photos.count', { count: photos.length, max: MAX_PHOTO_COUNT })}
              </Text>
            </View>

            {photos.length > 0 ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {photos.map((photo, index) => (
                  <View key={index} className="relative">
                    <Image
                      source={{ uri: photo.uri }}
                      className="h-20 w-20 rounded-md"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('reports.new.photos.remove')}
                      hitSlop={12}
                      onPress={() => removePhoto(index)}
                      className="absolute -right-2 -top-2 h-5 w-5 items-center justify-center rounded-full bg-tone-danger"
                    >
                      <X color="#fff" size={12} strokeWidth={2.5} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="mt-3 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('reports.new.photos.gallery')}
                accessibilityState={{ disabled: photos.length >= MAX_PHOTO_COUNT }}
                onPress={() => pickPhotos('gallery')}
                disabled={photos.length >= MAX_PHOTO_COUNT}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[9px] border border-border bg-card py-3 active:opacity-80"
              >
                <ImagePlus color={dashboardColors.subtitle} size={15} />
                <Text className="text-[12px] font-medium text-ink">
                  {t('reports.new.photos.gallery')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('reports.new.photos.camera')}
                accessibilityState={{ disabled: photos.length >= MAX_PHOTO_COUNT }}
                onPress={() => pickPhotos('camera')}
                disabled={photos.length >= MAX_PHOTO_COUNT}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-[9px] border border-border bg-card py-3 active:opacity-80"
              >
                <Camera color={dashboardColors.subtitle} size={15} />
                <Text className="text-[12px] font-medium text-ink">
                  {t('reports.new.photos.camera')}
                </Text>
              </Pressable>
            </View>
          </Card>

          {submitError ? (
            <StateView variant="error" description={submitError} className="mb-4" />
          ) : null}

          <Button
            label={submitting ? t('reports.new.submitting') : t('reports.new.submit')}
            loading={submitting || uploadingPhotos}
            disabled={submitting || uploadingPhotos}
            onPress={handleSubmit}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {activeSite ? (
        <TriageChat
          visible={triageOpen}
          siteId={activeSite.id}
          onClose={() => setTriageOpen(false)}
          onApply={applyTriage}
        />
      ) : null}

      {suggestionOpen ? (
        <View className="absolute inset-0 items-center justify-center bg-black/40 px-6">
          <View className="w-full rounded-[14px] bg-card p-4">
            <Text className="text-[15px] font-semibold text-ink">
              {t('reports.new.suggestionTitle')}
            </Text>
            <Text className="mt-1 text-[11px] leading-[1.6] text-dashboard-subtitle">
              {t('reports.new.suggestionBody')}
            </Text>
            <TextField
              label={t('reports.new.suggestionLabel')}
              value={suggestionText}
              onChangeText={setSuggestionText}
              placeholder={t('reports.new.suggestionPlaceholder')}
              className="mt-3"
            />
            <View className="mt-3 flex-row justify-end gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => { setSuggestionOpen(false); setSuggestionText(''); }}
                className="rounded-[9px] px-3 py-2 active:opacity-80"
              >
                <Text className="text-[12px] font-medium text-ink">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handleSuggestMissing}
                disabled={suggestionBusy || !suggestionText.trim()}
                className="rounded-[9px] px-3 py-2 active:opacity-80"
                style={{ backgroundColor: dashboardColors.ctaBg }}
              >
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: dashboardColors.ctaText }}
                >
                  {suggestionBusy ? t('reports.new.suggestionSubmitting') : t('reports.new.suggestionSubmit')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
