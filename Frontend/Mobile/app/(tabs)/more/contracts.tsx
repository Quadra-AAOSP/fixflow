import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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

import { SiteVetting } from '@/components/technician/SiteVetting';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { canDecideContracts } from '@/constants/access';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { createTechnicianContract, deleteTechnicianContract, listTechnicianContractRequests, listTechnicianContracts, decideTechnicianContractRequest } from '@/services/technician';
import { listSites } from '@/services/sites';
import type { Site, TechnicianContractRequest, TechnicianContract } from '@/types';
import { formatDate, humanize } from '@/utils/format';

/**
 * Site contracts. Mirrors `ContractsView.vue`. Two faces:
 *
 *   - `technician`           → "Stay independent" / "Request a site
 *                              contract" panels (requests unavailable)
 *   - `admin | super_admin`  → record form to bind a technician to a site
 *
 * Existing contracts and requests come from the backend list endpoints;
 * the backend does not return site names, so they are resolved from
 * `GET /api/sites`.
 */
export default function ContractsScreen() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const isAdmin = user !== null && canDecideContracts(user);
  const isTechnician = user?.role === 'technician';

  const [sites, setSites] = useState<Site[]>([]);
  const [requests, setRequests] = useState<TechnicianContractRequest[]>([]);
  const [contracts, setContracts] = useState<TechnicianContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sites, requests, contracts] = await Promise.all([
        listSites(),
        listTechnicianContractRequests(),
        listTechnicianContracts(),
      ]);
      setSites(sites);
      setRequests(requests);
      setContracts(contracts);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('more.contracts.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Contract/request payloads expose only `siteId`; resolve the display name
  // from the already-loaded site list.
  const siteNameFor = useCallback(
    (siteId: number) =>
      sites.find((site) => site.id === siteId)?.name ??
      t('more.contracts.unknownSite'),
    [sites, t],
  );

  const handleDecideRequest = useCallback(async (requestId: number, decision: 'approve' | 'reject') => {
    setSubmitting(true);
    setError(null);
    try {
      await decideTechnicianContractRequest(requestId, { decision });
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('more.contracts.errors.couldNotDecide'),
      );
    } finally {
      setSubmitting(false);
    }
  }, [loadData, t]);

  const handleRemoveContract = useCallback(
    (contract: TechnicianContract) => {
      Alert.alert(
        t('more.contracts.removeTitle'),
        t('more.contracts.removeMessage', { site: siteNameFor(contract.siteId) }),
        [
          { text: t('more.contracts.removeCancel'), style: 'cancel' },
          {
            text: t('more.contracts.remove'),
            style: 'destructive',
            onPress: () => {
              void (async () => {
                setSubmitting(true);
                setError(null);
                try {
                  await deleteTechnicianContract(contract.id);
                  await loadData();
                } catch (err) {
                  setError(
                    err instanceof ApiError
                      ? err.message
                      : t('more.contracts.removeFailed'),
                  );
                } finally {
                  setSubmitting(false);
                }
              })();
            },
          },
        ],
      );
    },
    [loadData, t, siteNameFor],
  );

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

        {isTechnician || isAdmin ? (
          <>
            <View className="border-t border-dashboard-card-line py-5">
              <Text className="mb-1 text-[17px] font-semibold text-ink">
                {t('more.contracts.existingTitle')}
              </Text>
              <Text className="mb-3 text-[11px] leading-[1.7] text-dashboard-subtitle">
                {t('more.contracts.existingDesc')}
              </Text>
              {contracts.length === 0 ? (
                <Text className="text-[11px] text-dashboard-caption">
                  {t('more.contracts.existingEmpty')}
                </Text>
              ) : (
                contracts.map((contract) => (
                  <View
                    key={contract.id}
                    className="mb-2 flex-row items-center justify-between gap-3 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3"
                  >
                    <View className="flex-1">
                      <Text className="text-[12px] font-semibold text-ink">
                        {siteNameFor(contract.siteId)}
                      </Text>
                      <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                        {formatDate(contract.createdAt, true)}
                      </Text>
                      <SiteVetting siteId={contract.siteId} technicianId={contract.technicianId} admin={isAdmin} />
                    </View>
                    {isAdmin ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={submitting}
                        onPress={() => handleRemoveContract(contract)}
                        className="rounded-md border border-tone-danger px-2.5 py-1.5 active:opacity-70"
                      >
                        <Text className="text-[10px] font-semibold text-tone-danger">
                          {t('more.contracts.remove')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </View>

            <View className="border-t border-dashboard-card-line py-5">
              <Text className="mb-1 text-[17px] font-semibold text-ink">
                {t('more.contracts.requestsTitle')}
              </Text>
              <Text className="mb-3 text-[11px] leading-[1.7] text-dashboard-subtitle">
                {t('more.contracts.requestsDesc')}
              </Text>
              {requests.length === 0 ? (
                <Text className="text-[11px] text-dashboard-caption">
                  {t('more.contracts.requestsEmpty')}
                </Text>
              ) : (
                requests.map((request) => (
                  <View
                    key={request.id}
                    className="mb-2 rounded-lg border border-dashboard-card-line bg-dashboard-card-bg p-3"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12px] font-semibold text-ink">
                        {siteNameFor(request.siteId)}
                      </Text>
                      <Text className="text-[10px] text-dashboard-caption">
                        {humanize(request.status)}
                      </Text>
                    </View>
                    <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                      {formatDate(request.createdAt, true)}
                    </Text>
                    {isAdmin && request.status === 'pending' ? (
                      <View className="mt-2 flex-row gap-2">
                        <Pressable
                          accessibilityRole="button"
                          disabled={submitting}
                          onPress={() => {
                            void handleDecideRequest(request.id, 'approve');
                          }}
                          className="rounded-md border border-dashboard-card-line bg-dashboard-cta-icon-bg px-3 py-1.5 active:opacity-70"
                        >
                          <Text className="text-[10px] font-semibold text-dashboard-teal">
                            {t('more.contracts.approve')}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          disabled={submitting}
                          onPress={() => {
                            void handleDecideRequest(request.id, 'reject');
                          }}
                          className="rounded-md border border-tone-danger px-3 py-1.5 active:opacity-70"
                        >
                          <Text className="text-[10px] font-semibold text-tone-danger">
                            {t('more.contracts.reject')}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
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
          {t('more.contracts.requestOnlineNote')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/technician/contract-requests')}
          className="flex-row items-center justify-center gap-2 rounded-[11px] border px-4 py-3 active:opacity-90"
          style={{
            backgroundColor: dashboardColors.ctaBg,
            borderColor: dashboardColors.ctaBorder,
          }}
        >
          <Text
            className="text-[14px] font-semibold"
            style={{ color: dashboardColors.ctaText }}
          >
            {t('more.contracts.onlineRequest')}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function AdminView({ t }: { t: TranslateFn }) {
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
      <StateView variant="loading" title={t('more.contracts.loading')} />
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



