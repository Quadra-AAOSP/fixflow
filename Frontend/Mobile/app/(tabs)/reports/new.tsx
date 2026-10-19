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
import type { SiteRule, SiteType, Subsite, Urgency } from '@/types';
import { useCurrentSite } from '@/stores/site';
import { humanize } from '@/utils/format';
import { urgencyLabels } from '@/utils/maintenance';

const URGENCY_OPTIONS: SegmentedOption<Urgency>[] = (
  Object.keys(urgencyLabels) as Urgency[]
).map((value) => ({ value, label: urgencyLabels[value] }));

/**
 * "Report an issue" form. Mirrors `ReportFormView.vue`:
 *   - "All reports" back link in the card heading
 *   - "Report an issue" title + dialog intro that names the site
 *   - Description (required, multiline)
 *   - Address (optional)
 *   - Category picker (driven by the site's rules)
 *   - Urgency segmented control (Low/Medium/High/Critical)
 *   - "Why this urgency?" reason (optional)
 *   - Mint "Submit report" CTA
 */
export default function NewReportScreen() {
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

  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  // Starts empty so an explicit choice is required — the web form refuses
  // to submit without one (`ReportFormView.vue`).
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [reason, setReason] = useState('');

  const [error, setError] = useState<string | null>(null);
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
          : 'Could not load the category list.',
      );
    } finally {
      setRulesLoading(false);
    }
  }, []);

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
          : 'Could not load the building list.',
      );
    } finally {
      setSubsitesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!site) return;
    void loadSubsites(site.id);
  }, [site?.id, loadSubsites]);

  async function onSubmit() {
    setError(null);
    const trimmedDescription = description.trim();
    // Single-message validation — matches the web form's copy, plus the
    // building pick the backend now routes on.
    if (
      !trimmedDescription ||
      !category ||
      !urgency ||
      (activeSubsites.length > 0 && subsiteId === null)
    ) {
      setError(
        'Choose a building, category, and urgency, and describe the issue.',
      );
      return;
    }
    if (!site) {
      setError('Site is not loaded yet. Please try again in a moment.');
      return;
    }

    setSubmitting(true);
    try {
      const report = await createReport({
        description: trimmedDescription,
        address: address.trim() || undefined,
        category,
        reporterUrgency: urgency,
        reporterReason: reason.trim() || undefined,
        // Always send the active site. `ReportService.resolveSiteForCreate`
        // *requires* siteId from super_admin, and for every other role it
        // only validates that the value matches the actor's own site — which
        // it always does here, since their site list has exactly one entry.
        siteId: site.id,
        subsiteId: subsiteId ?? undefined,
      });
      // Land on the detail of the report we just filed so the user sees the
      // server's canonical state (timestamps, generated ID) immediately.
      // `replace` (not `back`) avoids leaving a stale form on the stack.
      router.replace(`/reports/${report.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reach the server.');
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
          title="Your account cannot create reports."
          description="Technician accounts resolve reports rather than file them."
        />
      </Screen>
    );
  }
  if (!site) {
    if (siteLoading) {
      return (
        <Screen>
          <StateView variant="loading" title="Loading site…" />
        </Screen>
      );
    }
    if (siteError) {
      return (
        <Screen>
          <StateView
            variant="error"
            title="Could not load site"
            description={siteError.message}
            actionLabel="Retry"
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
          title="No site linked"
          description="A site must be linked before you can file a report."
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
          title="No buildings set up yet"
          description={
            manage
              ? 'Add at least one building or area before reports can be filed at this site.'
              : 'Your site administrator has not added any buildings yet. Reports cannot be filed until at least one exists.'
          }
          actionLabel={manage ? 'Open site setup' : undefined}
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
            onPress={() => router.back()}
            className="mb-2 flex-row items-center gap-1 self-start active:opacity-70"
          >
            <ArrowLeft color={dashboardColors.teal} size={15} />
            <Text
              className="text-[11px] font-semibold"
              style={{ color: dashboardColors.teal }}
            >
              All reports
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
                Report an issue
              </Text>
              <Text className="mt-0.5 text-xs text-dashboard-subtitle">
                Describe what needs attention at {site.name}.
              </Text>
            </View>
          </View>

          <Text className="mb-4 text-[12px] leading-[1.8] text-dashboard-subtitle">
            Your report will be saved to the maintenance system and routed to a
            technician.
          </Text>

          <Card className="mb-4">
            <TextField
              label="What happened?"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              placeholder="Describe the issue and what you noticed."
            />
            <TextField
              label="Location detail (optional)"
              value={address}
              onChangeText={setAddress}
              maxLength={512}
              placeholder="Floor, or room"
            />
            <Picker
              label="Building / area"
              value={subsiteId !== null ? String(subsiteId) : null}
              options={activeSubsites.map((s) => ({
                value: String(s.id),
                label: `${s.label} — ${s.name}`,
              }))}
              onChange={(value) => setSubsiteId(Number(value))}
              placeholder={
                subsitesLoading ? 'Loading buildings…' : 'Choose a building'
              }
              emptyMessage={
                subsitesError ?? 'No buildings are available at this site.'
              }
              disabled={subsitesLoading || activeSubsites.length === 0}
            />
            {subsitesError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (site) void loadSubsites(site.id);
                }}
                className="mb-3 mt-1 self-start active:opacity-70"
              >
                <Text className="text-[10px] font-medium text-tone-danger">
                  {subsitesError}{' '}
                  <Text className="font-semibold underline">Retry</Text>
                </Text>
              </Pressable>
            ) : null}
            <Picker
              label="Category"
              value={category}
              options={categoryOptions}
              onChange={setCategory}
              placeholder={
                rulesLoading ? 'Loading categories…' : 'Choose a category'
              }
              emptyMessage={
                rulesError ??
                'No reporting categories are available for this site. Ask your administrator to configure them.'
              }
              disabled={rulesLoading || rules.length === 0}
            />
            {rulesError ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (site?.type) void loadRules(site.type);
                }}
                className="mb-3 mt-1 self-start active:opacity-70"
              >
                <Text className="text-[10px] font-medium text-tone-danger">
                  {rulesError}{' '}
                  <Text className="font-semibold underline">Retry</Text>
                </Text>
              </Pressable>
            ) : null}

            <Text className="mb-2 text-sm font-medium text-ink">Your urgency</Text>
            <SegmentedControl
              options={URGENCY_OPTIONS}
              value={urgency}
              onChange={setUrgency}
              className="mb-4"
            />

            <TextField
              label="Why this urgency? (optional)"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              placeholder="Explain how this issue affects the space."
            />

            {error ? (
              <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
                <Text className="text-[10px] leading-[1.7] text-dashboard-error-text">
                  {error}
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
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
                {submitting ? 'Submitting…' : 'Submit report'}
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
