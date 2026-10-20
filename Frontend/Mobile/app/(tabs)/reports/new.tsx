import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, ArrowRight, Building2, House, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import {
  SegmentedControl,
  type SegmentedOption,
} from '@/components/ui/SegmentedControl';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { canManageSubsites } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { createReport } from '@/services/reports';
import { listSiteRules } from '@/services/siteRules';
import { listSubsites } from '@/services/sites';
import type { ReportVisibility, SiteRule, SiteType, Subsite, Urgency } from '@/types';
import { useCurrentSite } from '@/stores/site';
import { humanize } from '@/utils/format';
import { urgencyLabels } from '@/utils/maintenance';

const URGENCY_OPTIONS: SegmentedOption<Urgency>[] = (
  Object.keys(urgencyLabels) as Urgency[]
).map((value) => ({ value, label: urgencyLabels[value] }));

/**
 * "Report an issue" form. Mirrors `ReportFormView.vue`:
 */
export default function NewReportScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();
  const {
    site,
    loading: siteLoading,
    error: siteError,
    refresh: refreshSite,
  } = useCurrentSite();

  const [rules, setRules] = useState<SiteRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);

  // The site's buildings/areas. Reports are pinned to one (`subsiteId`) —
  // a site with zero active subsites cannot accept reports at all.
  const [subsites, setSubsites] = useState<Subsite[] | null>(null);
  const [subsitesLoading, setSubsitesLoading] = useState(false);
  const [subsitesError, setSubsitesError] = useState<string | null>(null);
  const [subsiteId, setSubsiteId] = useState<number | null>(null);
  // Defaults to public; private hides the report from other reporters at the
  // site (staff/admin and the assigned technician still see it).
  const [visibility, setVisibility] = useState<ReportVisibility>('public');

  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  // Starts empty so an explicit choice is required — the web form refuses
  // to submit without one (`ReportFormView.vue`).
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [reason, setReason] = useState('');

  // Per-field inline errors (keyed by field name), plus a top-level server
  // error for ApiError messages from the backend.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mirrors the web's `canCreate` (reporter/staff/admin/super_admin only):
  // technicians resolve reports rather than file them.
  const canCreate = (user?.capabilities.createReport ?? false);

  // Load the category / urgency taxonomy for this site's site type. We
  // re-load on site change so the picker stays in sync if the user swaps
  // sites (Phase 9 super_admin switcher) or logs in as a different actor.
  const loadRules = useCallback(async (siteType: SiteType) => {
    setRulesLoading(true);
    setRulesError(null);
    setRules([]);
    setCategory(null);
    try {
      const result = await listSiteRules(siteType);
      setRules(result);
    } catch (err) {
      setRulesError(
        err instanceof ApiError
          ? err.message
          : t('reports.new.categoryLoadFail'),
      );
    } finally {
      setRulesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const siteType = site?.type;
    if (!siteType) return;
    void loadRules(siteType);
  }, [site?.type, site?.id, loadRules]);

  // Load the building list alongside the rules, re-running on site change.
  const loadSubsites = useCallback(async (siteId: number) => {
    setSubsitesLoading(true);
    setSubsitesError(null);
    setSubsites(null);
    setSubsiteId(null);
    try {
      setSubsites(await listSubsites(siteId));
    } catch (err) {
      setSubsitesError(
        err instanceof ApiError
          ? err.message
          : t('reports.new.buildingLoadFail'),
      );
    } finally {
      setSubsitesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!site) return;
    void loadSubsites(site.id);
  }, [site?.id, loadSubsites]);

  function validateForm(): Record<string, string> {
    const next: Record<string, string> = {};
    const trimmedDescription = description.trim();
    if (!trimmedDescription) next.description = t('reports.new.descErrors.required');
    else if (trimmedDescription.length < 10)
      next.description = t('reports.new.descErrors.tooShort');
    else if (trimmedDescription.length > 10_000)
      next.description = t('reports.new.descErrors.tooLong');

    if (!category) next.category = t('reports.new.categoryError');
    if (!urgency) next.urgency = t('reports.new.urgencyError');

    if (activeSubsites.length > 0 && subsiteId === null)
      next.subsiteId = t('reports.new.buildingError');

    if (address.trim().length > 512)
      next.address = t('reports.new.addressTooLong');

    return next;
  }

  async function onSubmit() {
    const all = validateForm();
    setErrors(all);
    setServerError(null);
    if (Object.keys(all).length > 0) return;

    if (!site) {
      setServerError(t('reports.new.siteNotLoaded'));
      return;
    }

    setSubmitting(true);
    try {
      const report = await createReport({
        description: description.trim(),
        address: address.trim() || undefined,
        category: category!,
        reporterUrgency: urgency!,
        reporterReason: reason.trim() || undefined,
        siteId: site.id,
        subsiteId: subsiteId ?? undefined,
        visibility,
      });
      router.replace(`/reports/${report.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError(t('reports.new.noConnection'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Home gates this route behind a linked site, but a deep link or a stale
  // selection can still land here — handle all three states rather than
  // rendering a form that cannot submit.
  if (!canCreate) {
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={House}
          title={t('reports.new.permissionsTitle')}
          description={t('reports.new.permissionsDesc')}
        />
      </Screen>
    );
  }
  if (!site) {
    if (siteLoading) {
      return (
        <Screen>
          <StateView variant="loading" title={t('reports.new.loadingSite')} />
        </Screen>
      );
    }
    if (siteError) {
      return (
        <Screen>
          <StateView
            variant="error"
            title={t('reports.new.couldNotLoadSite')}
            description={siteError.message}
            actionLabel={t('reports.new.retry')}
            onAction={() => {
              void refreshSite();
            }}
          />
        </Screen>
      );
    }
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={House}
          title={t('reports.new.noSiteTitle')}
          description={t('reports.new.noSiteDesc')}
        />
      </Screen>
    );
  }

  // Reporting is blocked while the site has no active building — the backend
  // rejects the report under the default reporting configuration, so the form
  // is replaced rather than allowed to fail on submit.
  const activeSubsites = (subsites ?? []).filter((s) => s.archivedAt === null);
  if (subsites !== null && !subsitesLoading && activeSubsites.length === 0) {
    const manage = canManageSubsites(user);
    return (
      <Screen>
        <StateView
          variant="empty"
          icon={Building2}
          title={t('reports.new.noBuildingsTitle')}
          description={
            manage
              ? t('reports.new.noBuildingsDescAdmin')
              : t('reports.new.noBuildingsDescReporter')
          }
          actionLabel={manage ? t('reports.new.openSiteSetup') : undefined}
          onAction={
            manage ? () => router.push('/more/site-setup') : undefined
          }
        />
      </Screen>
    );
  }

  const categoryOptions = rules.map((r) => ({
    value: r.category,
    label: humanize(r.category),
  }));

  const VISIBILITY_OPTIONS: SegmentedOption<ReportVisibility>[] = [
    { value: 'public', label: t('reports.new.visibilityPublic') },
    { value: 'private', label: t('reports.new.visibilityPrivate') },
  ];

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 pb-6 pt-4"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('reports.new.allReports')}
            onPress={() => router.back()}
            className="mb-2 flex-row items-center gap-1 self-start active:opacity-70"
          >
            <ArrowLeft color={dashboardColors.teal} size={15} />
            <Text
              className="text-[11px] font-semibold"
              style={{ color: dashboardColors.teal }}
            >
              {t('reports.new.allReports')}
            </Text>
          </Pressable>

          <View className="mb-1 flex-row items-center gap-3">
            <View
              className="rounded-xl p-3"
              style={{ backgroundColor: dashboardColors.statMintSoft }}
            >
              <Plus color={dashboardColors.statMintDeep} size={26} strokeWidth={2.2} />
            </View>
            <View className="flex-1">
              <Text
                className="text-2xl font-bold text-ink"
                style={{ letterSpacing: -0.5 }}
              >
                {t('reports.new.title')}
              </Text>
              <Text className="mt-0.5 text-xs text-dashboard-subtitle">
                {t('reports.new.intro', { site: site.name })}
              </Text>
            </View>
          </View>

          <Text className="mb-4 text-[12px] leading-[1.8] text-dashboard-subtitle">
            {t('reports.new.savedNotice')}
          </Text>

          <Card className="mb-4">
            <TextField
              label={t('reports.new.descLabel')}
              value={description}
              onChangeText={(v) => {
                setDescription(v);
                if (errors.description)
                  setErrors((e) => { const c = { ...e }; delete c.description; return c; });
              }}
              multiline
              numberOfLines={5}
              placeholder={t('reports.new.descPlaceholder')}
              error={errors.description}
            />
            <TextField
              label={t('reports.new.addressLabel')}
              value={address}
              onChangeText={(v) => {
                setAddress(v);
                if (errors.address)
                  setErrors((e) => { const c = { ...e }; delete c.address; return c; });
              }}
              maxLength={512}
              placeholder={t('reports.new.addressPlaceholder')}
              error={errors.address}
            />
            <Picker
              label={t('reports.new.buildingLabel')}
              value={subsiteId !== null ? String(subsiteId) : null}
              options={activeSubsites.map((s) => ({
                value: String(s.id),
                label: `${s.label} — ${s.name}`,
              }))}
              onChange={(value) => {
                setSubsiteId(Number(value));
                if (errors.subsiteId)
                  setErrors((e) => { const c = { ...e }; delete c.subsiteId; return c; });
              }}
              placeholder={
                subsitesLoading ? t('reports.new.buildingPlaceholderLoading') : t('reports.new.buildingPlaceholderChoose')
              }
              emptyMessage={
                subsitesError ?? t('reports.new.buildingLoadError')
              }
              disabled={subsitesLoading || activeSubsites.length === 0}
            />
            {errors.subsiteId ? (
              <Text className="-mt-2 mb-3 text-[11px] text-tone-danger">
                {errors.subsiteId}
              </Text>
            ) : null}
            {subsitesError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('reports.new.retryLoadingBuildings')}
                onPress={() => {
                  if (site) void loadSubsites(site.id);
                }}
                className="mb-3 mt-1 self-start active:opacity-70"
              >
                <Text className="text-[10px] font-medium text-tone-danger">
                  {subsitesError}{' '}
                  <Text className="font-semibold underline">{t('reports.new.retry')}</Text>
                </Text>
              </Pressable>
            ) : null}
            <Picker
              label={t('reports.new.categoryLabel')}
              value={category}
              options={categoryOptions}
              onChange={setCategory}
              placeholder={
                rulesLoading ? t('reports.new.categoryPlaceholderLoading') : t('reports.new.categoryPlaceholderChoose')
              }
              emptyMessage={
                rulesError ??
                t('reports.new.categoryLoadError')
              }
              disabled={rulesLoading || rules.length === 0}
            />
            {rulesError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('reports.new.retryLoadingCategories')}
                onPress={() => {
                  if (site?.type) void loadRules(site.type);
                }}
                className="mb-3 mt-1 self-start active:opacity-70"
              >
                <Text className="text-[10px] font-medium text-tone-danger">
                  {rulesError}{' '}
                  <Text className="font-semibold underline">{t('reports.new.retry')}</Text>
                </Text>
              </Pressable>
            ) : null}

            <Text className="mb-2 text-sm font-medium text-ink">{t('reports.new.urgencyLabel')}</Text>
            <SegmentedControl
              options={URGENCY_OPTIONS}
              value={urgency}
              onChange={setUrgency}
              className="mb-4"
            />

            <TextField
              label={t('reports.new.urgencyReasonLabel')}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              placeholder={t('reports.new.urgencyReasonPlaceholder')}
            />

            <Text className="mb-2 text-sm font-medium text-ink">{t('reports.new.visibilityLabel')}</Text>
            <SegmentedControl
              options={VISIBILITY_OPTIONS}
              value={visibility}
              onChange={setVisibility}
            />
            <Text className="mb-4 mt-1.5 text-[10px] leading-[1.65] text-dashboard-subtitle">
              {visibility === 'private'
                ? t('reports.new.visibilityPrivateHint')
                : t('reports.new.visibilityPublicHint')}
            </Text>

            {serverError ? (
              <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
                <Text className="text-[10px] leading-[1.7] text-dashboard-error-text">
                  {serverError}
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reports.new.submit')}
              accessibilityState={{ disabled: submitting, busy: submitting }}
              disabled={submitting}
              onPress={onSubmit}
              className="mt-1 flex-row items-center justify-center gap-2 rounded-[11px] border px-4 py-3 active:opacity-90"
              style={{
                backgroundColor: dashboardColors.ctaBg,
                borderColor: dashboardColors.ctaBorder,
                opacity: submitting ? 0.55 : 1,
              }}
            >
              <Text
                className="text-[14px] font-semibold"
                style={{ color: dashboardColors.ctaText }}
              >
                {submitting ? t('reports.new.submitting') : t('reports.new.submit')}
              </Text>
              <ArrowRight color={dashboardColors.ctaText} size={17} strokeWidth={2.2} />
            </Pressable>
          </Card>

          <View className="h-12" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
