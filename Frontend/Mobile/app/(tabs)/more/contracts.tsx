import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Check, Handshake, ShieldCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { canDecideContracts } from '@/constants/access';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { createTechnicianContract } from '@/services/technician';
import { listSites } from '@/services/sites';
import type { Site } from '@/types';
import { formatDate } from '@/utils/format';

/**
 * Site contracts. Mirrors `ContractsView.vue`. Two faces:
 *
 *   - `technician`           → "Stay independent" / "Request a site
 *                              contract" panels (requests unavailable)
 *   - `admin | super_admin`  → record form to bind a technician to a site
 *
 * Like the web build, existing contracts and pending requests are NOT
 * listed here — the backend has no list endpoint yet.
 *
 * The technician is currently identified by numeric user ID because the
 * backend doesn't expose a public technician directory yet (see
 * `lib/endpoints.ts` trailing comment).
 */
export default function ContractsScreen() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const isAdmin = user !== null && canDecideContracts(user);
  const isTechnician = user?.role === 'technician';

  if (!user) return null;

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 pb-12 pt-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
        {/* Card heading — mirrors the web's `.card-heading` with a large
            `Handshake` on the right. */}
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              {t('more.contracts.title')}
            </Text>
            <Text className="mt-1 text-[12px] text-dashboard-subtitle">
              {t('more.contracts.subtitle')}
            </Text>
          </View>
          <Handshake color={dashboardColors.statMintDeep} size={30} />
        </View>

        {isTechnician ? <TechnicianView userId={user.id} t={t} /> : null}
        {isAdmin ? <AdminView t={t} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

function TechnicianView({ userId, t }: { userId: number; t: TranslateFn }) {
  const router = useRouter();
  return (
    <>
      {/* First contract-choice panel — mirrors the web's "Stay independent"
          section; the link routes to the technician workspace, exactly as
          the web's RouterLink to /technician. */}
      <View className="mt-2 border-t border-dashboard-card-line py-5">
        <Text
          className="mb-2 text-[17px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('more.contracts.stayIndependent')}
        </Text>
        <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
          {t('more.contracts.independentBody')}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/workspace')}
          className="flex-row items-center gap-1 self-start active:opacity-70"
        >
          <Text
            className="text-[11px] font-semibold"
            style={{ color: dashboardColors.teal }}
          >
            {t('more.contracts.continueIndependently')}
          </Text>
          <ArrowRight color={dashboardColors.teal} size={13} />
        </Pressable>
      </View>

      {/* Second contract-choice panel — mirrors the web's "Request a site
          contract" section. Online requests are not available yet, so the
          CTA is disabled with explanatory copy (the web's
          `contract-request-unavailable` block). */}
      <View className="border-t border-dashboard-card-line py-5">
        <Text
          className="mb-2 text-[17px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('more.contracts.requestTitle')}
        </Text>
        <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
          {t('more.contracts.requestBodyPrefix')}
          <Text className="font-semibold text-ink">{userId}</Text>
          {t('more.contracts.requestBodySuffix')}
        </Text>
        <Text className="mb-3 text-[11px] leading-[1.6] text-dashboard-caption">
          {t('more.contracts.onlineUnavailableNote')}
        </Text>
        <Pressable
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          className="flex-row items-center justify-center gap-2 rounded-[11px] border px-4 py-3 opacity-50"
          style={{
            backgroundColor: dashboardColors.ctaBg,
            borderColor: dashboardColors.ctaBorder,
          }}
        >
          <Text
            className="text-[14px] font-semibold"
            style={{ color: dashboardColors.ctaText }}
          >
            {t('more.contracts.onlineUnavailableButton')}
          </Text>
        </Pressable>
        <Text className="mt-3 text-[11px] leading-[1.7] text-dashboard-subtitle">
          {t('more.contracts.recordNote')}
        </Text>
      </View>
    </>
  );
}

function AdminView({ t }: { t: TranslateFn }) {
  const palette = themeColors();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [loadingSites, setLoadingSites] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<number | null>(null);
  const [technicianIdText, setTechnicianIdText] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSites(true);
      setSitesError(null);
      try {
        const result = await listSites();
        if (!cancelled) {
          setSites(result);
          if (result.length > 0 && siteId === null) {
            setSiteId(result[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSitesError(
            err instanceof ApiError
              ? err.message
              : t('more.contracts.couldNotLoadSites'),
          );
        }
      } finally {
        if (!cancelled) setLoadingSites(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const siteOptions = useMemo(
    () => (sites ?? []).map((site) => ({ value: String(site.id), label: site.name })),
    [sites],
  );

  async function onSubmit() {
    if (siteId === null) {
      setError(t('more.contracts.errors.chooseSiteTechnicianConsent'));
      return;
    }
    const parsedTechnicianId = Number(technicianIdText);
    if (
      technicianIdText.length === 0 ||
      !Number.isInteger(parsedTechnicianId) ||
      parsedTechnicianId <= 0
    ) {
      setError(t('more.contracts.errors.chooseSiteTechnicianConsent'));
      return;
    }
    if (!consent) {
      setError(t('more.contracts.errors.chooseSiteTechnicianConsent'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTechnicianContract({
        technicianId: parsedTechnicianId,
        siteId,
      });
      // Success notice — same shape as the web's `.draft-notice`:
      // "Contract #N created for technician #M at SiteName on date."
      const siteName =
        sites?.find((site) => site.id === created.siteId)?.name ??
        t('more.contracts.unknownSite');
      setConfirmation(
        t('more.contracts.confirmation', {
          site: siteName,
          date: formatDate(created.createdAt, true),
        }),
      );
      setConsent(false);
      setTechnicianIdText('');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('more.contracts.errors.couldNotRecord'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingSites && sites === null) {
    return (
      <View className="py-6">
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (sitesError) {
    return (
      <StateView
        variant="error"
        title={t('more.contracts.couldNotLoadSitesTitle')}
        description={sitesError}
      />
    );
  }

  return (
    <Card className="mb-4">
      <Text className="mb-3 text-[12px] leading-[1.8] text-dashboard-subtitle">
        {t('more.contracts.recordIntro')}
      </Text>

      {confirmation ? (
        <View
          className="mb-3 flex-row items-start gap-2 rounded-md px-3 py-2"
          style={{ backgroundColor: dashboardColors.statMintSoft }}
        >
          <Check color={dashboardColors.statMintDeep} size={16} />
          <Text
            className="flex-1 text-[12px] leading-[1.6]"
            style={{ color: dashboardColors.statMintDeep }}
          >
            {confirmation}
          </Text>
        </View>
      ) : null}

      <Picker
        label={t('more.contracts.siteLabel')}
        value={siteId !== null ? String(siteId) : null}
        onChange={(value) => setSiteId(Number(value))}
        options={siteOptions}
      />

      <TextField
        label={t('more.contracts.technicianIdLabel')}
        value={technicianIdText}
        onChangeText={setTechnicianIdText}
        placeholder={t('more.contracts.technicianIdPlaceholder')}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Pressable
        onPress={() => setConsent(!consent)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        className="mb-3 flex-row items-start gap-3 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3 active:opacity-70"
      >
        <View
          className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
            consent ? 'border-dashboard-teal bg-dashboard-teal' : 'border-dashboard-card-line bg-dashboard-card-bg'
          }`}
        >
          {consent ? (
            <Check color={dashboardColors.ctaIconBg} size={14} strokeWidth={2.4} />
          ) : null}
        </View>
        <Text className="flex-1 text-[12px] leading-[1.7] text-ink">
          {t('more.contracts.consentLabel')}
        </Text>
      </Pressable>

      {error ? (
        <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
          <Text className="text-[11px] leading-[1.7] text-dashboard-error-text">
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
        <ShieldCheck
          color={dashboardColors.ctaText}
          size={17}
          strokeWidth={2.2}
        />
        <Text
          className="text-[14px] font-semibold"
          style={{ color: dashboardColors.ctaText }}
        >
          {submitting
            ? t('more.contracts.saving')
            : t('more.contracts.recordContract')}
        </Text>
      </Pressable>

      <Text className="mt-3 text-[11px] leading-[1.7] text-dashboard-subtitle">
        {t('more.contracts.listUnavailableNote')}
      </Text>
    </Card>
  );
}
