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
import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  Handshake,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  X,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { SiteVetting } from '@/components/technician/SiteVetting';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StateView } from '@/components/ui/StateView';
import { TextField } from '@/components/ui/TextField';
import { canDecideContracts } from '@/constants/access';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  createTechnicianContract,
  deleteTechnicianContract,
  listTechnicianContractRequests,
  listTechnicianContracts,
  decideTechnicianContractRequest,
} from '@/services/technician';
import { listSites } from '@/services/sites';
import { listTechnicians } from '@/services/technicians';
import type {
  Site,
  TechnicianContract,
  TechnicianContractRequest,
  TechnicianSummary,
} from '@/types';
import { formatDate, humanize } from '@/utils/format';

const REQUEST_TONE: Record<string, PillTone> = {
  pending: 'citron',
  approved: 'mint',
  rejected: 'coral',
};

/**
 * Site contracts. Mirrors `ContractsView.vue`. Two faces:
 *
 *   - `technician`           → "Stay independent" / "Request a site
 *                              contract" panels (requests unavailable)
 *   - `admin | super_admin`  → record form to bind a technician to a site
 *
 * Existing contracts and requests come from the backend list endpoints;
 * the backend does not return site names on the record payload, so they are
 * resolved from `GET /api/sites`.
 */
export default function ContractsScreen() {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const isAdmin = user !== null && canDecideContracts(user);
  const isTechnician = user?.role === 'technician';

  const [sites, setSites] = useState<Site[]>([]);
  const [requests, setRequests] = useState<TechnicianContractRequest[]>([]);
  const [contracts, setContracts] = useState<TechnicianContract[]>([]);
  // Directory of technicians so the admin sees *who* applied or is contracted
  // instead of a bare account id.
  const [technicians, setTechnicians] = useState<TechnicianSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sites, requests, contracts, technicians] = await Promise.all([
        listSites(),
        listTechnicianContractRequests(),
        listTechnicianContracts(),
        // The directory endpoint is admin-facing; technicians already know
        // themselves, so skip it for them to avoid a needless 403.
        isAdmin ? listTechnicians() : Promise.resolve([]),
      ]);
      setSites(sites);
      setRequests(requests);
      setContracts(contracts);
      setTechnicians(technicians);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('more.contracts.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t]);

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

  // Payloads carry only `technicianId`; resolve the display name from the
  // directory so the site admin knows who they are approving.
  const technicianNameFor = useCallback(
    (technicianId: number) => {
      const found = technicians.find((technician) => technician.id === technicianId);
      if (!found) {
        return t('more.contracts.technicianFallback', { id: technicianId });
      }
      const name = [found.firstName, found.lastName].filter(Boolean).join(' ');
      return name || found.email;
    },
    [technicians, t],
  );

  const handleDecideRequest = useCallback(
    async (requestId: number, decision: 'approve' | 'reject') => {
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
    },
    [loadData, t],
  );

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

  const pendingRequests = requests.filter((request) => request.status === 'pending');

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
          <PageHeader
            kicker={t('more.contracts.kicker')}
            title={t('more.contracts.title')}
            subtitle={t('more.contracts.subtitle')}
            icon={Handshake}
          >
            <View className="flex-row flex-wrap items-center gap-2">
              <Pill
                tone="mint"
                label={t('more.contracts.contractsCount', {
                  count: contracts.length,
                  plural: contracts.length === 1 ? '' : 's',
                })}
              />
              {isAdmin || isTechnician ? (
                <Pill
                  tone={pendingRequests.length > 0 ? 'citron' : 'neutral'}
                  label={t('more.contracts.requestsCount', {
                    count: pendingRequests.length,
                  })}
                />
              ) : null}
            </View>
          </PageHeader>

          {error ? (
            <StateView
              variant="error"
              description={error}
              actionLabel={t('more.contracts.retry')}
              onAction={() => void loadData()}
            />
          ) : loading ? (
            <StateView variant="loading" title={t('more.contracts.loading')} />
          ) : null}

          {isTechnician ? <TechnicianView t={t} /> : null}
          {isAdmin ? <AdminView t={t} technicians={technicians} /> : null}

          {isTechnician || isAdmin ? (
            <>
              <Card className="mb-4">
                <SectionHeader
                  title={t('more.contracts.existingTitle')}
                  subtitle={t('more.contracts.existingDesc')}
                />
                {contracts.length === 0 ? (
                  <Text className="text-[11px] leading-[1.7] text-dashboard-caption">
                    {t('more.contracts.existingEmpty')}
                  </Text>
                ) : (
                  <View className="gap-2">
                    {contracts.map((contract) => (
                      <View
                        key={contract.id}
                        className="flex-row items-start gap-2.5 rounded-lg border border-dashboard-card-line px-3 py-2.5"
                      >
                        <View
                          className="h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: dashboardColors.statMintSoft }}
                        >
                          <Building2
                            color={dashboardColors.statMintDeep}
                            size={14}
                          />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[12.5px] font-semibold text-ink">
                            {siteNameFor(contract.siteId)}
                          </Text>
                          {isAdmin ? (
                            <Text className="mt-0.5 text-[10.5px] text-dashboard-subtitle">
                              {t('more.contracts.technicianName', {
                                name: technicianNameFor(contract.technicianId),
                              })}
                            </Text>
                          ) : null}
                          <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                            {t('more.contracts.sinceDate', {
                              date: formatDate(contract.createdAt, true),
                            })}
                          </Text>
                          <SiteVetting
                            siteId={contract.siteId}
                            technicianId={contract.technicianId}
                            admin={isAdmin}
                          />
                        </View>
                        {isAdmin ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('more.contracts.remove')}
                            disabled={submitting}
                            onPress={() => handleRemoveContract(contract)}
                            className="rounded-md border border-tone-danger px-2 py-1 active:opacity-70"
                            style={{ opacity: submitting ? 0.5 : 1 }}
                          >
                            <Trash2 color={dashboardColors.statCoralDeep} size={12} />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </Card>

              <Card>
                <SectionHeader
                  title={t('more.contracts.requestsTitle')}
                  subtitle={t('more.contracts.requestsDesc')}
                />
                {requests.length === 0 ? (
                  <Text className="text-[11px] leading-[1.7] text-dashboard-caption">
                    {t('more.contracts.requestsEmpty')}
                  </Text>
                ) : (
                  <View className="gap-2">
                    {requests.map((request) => (
                      <View
                        key={request.id}
                        className="rounded-lg border border-dashboard-card-line px-3 py-2.5"
                      >
                        <View className="flex-row items-start justify-between gap-2">
                          <View className="flex-1">
                            <Text className="text-[12.5px] font-semibold text-ink">
                              {siteNameFor(request.siteId)}
                            </Text>
                            {isAdmin ? (
                              <Text className="mt-0.5 text-[10.5px] font-medium text-dashboard-subtitle">
                                {technicianNameFor(request.technicianId)}
                              </Text>
                            ) : null}
                            <View className="mt-0.5 flex-row items-center gap-1">
                              <Clock
                                color={dashboardColors.statMintDeep}
                                size={10}
                              />
                              <Text className="text-[10px] text-dashboard-caption">
                                {formatDate(request.createdAt, true)}
                              </Text>
                            </View>
                          </View>
                          <Pill
                            tone={REQUEST_TONE[request.status] ?? 'neutral'}
                            label={t(`more.contracts.statuses.${request.status}`, {
                              defaultValue: humanize(request.status),
                            })}
                          />
                        </View>

                        {request.note ? (
                          <Text className="mt-1.5 text-[10.5px] leading-[1.65] text-dashboard-subtitle">
                            “{request.note}”
                          </Text>
                        ) : null}
                        {request.decisionReason ? (
                          <Text className="mt-1 text-[10px] leading-[1.6] text-dashboard-caption">
                            {t('more.contracts.decisionReason', {
                              reason: request.decisionReason,
                            })}
                          </Text>
                        ) : null}

                        {isAdmin && request.status === 'pending' ? (
                          <View className="mt-2 flex-row gap-2">
                            <Pressable
                              accessibilityRole="button"
                              disabled={submitting}
                              onPress={() => {
                                void handleDecideRequest(request.id, 'approve');
                              }}
                              className="flex-1 flex-row items-center justify-center gap-1 rounded-md border py-1.5 active:opacity-80"
                              style={{
                                borderColor: dashboardColors.statMintDeep,
                                backgroundColor: dashboardColors.statMintSoft,
                                opacity: submitting ? 0.5 : 1,
                              }}
                            >
                              <Check
                                color={dashboardColors.statMintDeep}
                                size={12}
                              />
                              <Text
                                className="text-[11px] font-semibold"
                                style={{ color: dashboardColors.statMintDeep }}
                              >
                                {t('more.contracts.approve')}
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              disabled={submitting}
                              onPress={() => {
                                void handleDecideRequest(request.id, 'reject');
                              }}
                              className="flex-1 flex-row items-center justify-center gap-1 rounded-md border py-1.5 active:opacity-80"
                              style={{
                                borderColor: dashboardColors.statCoralDeep,
                                backgroundColor: dashboardColors.statCoralSoft,
                                opacity: submitting ? 0.5 : 1,
                              }}
                            >
                              <X color={dashboardColors.statCoralDeep} size={12} />
                              <Text
                                className="text-[11px] font-semibold"
                                style={{ color: dashboardColors.statCoralDeep }}
                              >
                                {t('more.contracts.reject')}
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

function TechnicianView({ t }: { t: TranslateFn }) {
  const router = useRouter();
  return (
    <>
      <SectionHeader
        title={t('more.contracts.choiceTitle')}
        subtitle={t('more.contracts.choiceHint')}
      />

      {/* First contract-choice panel — mirrors the web's "Stay independent"
          section; the link routes to the technician workspace, exactly as
          the web's RouterLink to /technician. */}
      <Card className="mb-3">
        <View className="flex-row items-start gap-2.5">
          <View
            className="h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <ShieldCheck color={dashboardColors.statMintDeep} size={16} />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-ink">
              {t('more.contracts.stayIndependent')}
            </Text>
            <Text className="mt-1 text-[11px] leading-[1.7] text-dashboard-subtitle">
              {t('more.contracts.independentBody')}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/workspace')}
              className="mt-2 flex-row items-center gap-1 self-start active:opacity-70"
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
        </View>
      </Card>

      {/* Second contract-choice panel — mirrors the web's "Request a site
          contract" section. Online requests are not available yet, so the
          copy explains the handoff to the site administrator. */}
      <Card className="mb-4">
        <View className="flex-row items-start gap-2.5">
          <View
            className="h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: dashboardColors.statCitronSoft }}
          >
            <UserRoundPlus
              color={dashboardColors.statCitronDeep}
              size={16}
            />
          </View>
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-ink">
              {t('more.contracts.requestTitle')}
            </Text>
            <Text className="mt-1 text-[11px] leading-[1.7] text-dashboard-subtitle">
              {t('more.contracts.requestBodyPrefix')}
            </Text>
            <View
              className="mt-2 rounded-lg px-2.5 py-2"
              style={{ backgroundColor: dashboardColors.statCitronSoft }}
            >
              <Text
                className="text-[10px] leading-[1.6]"
                style={{ color: dashboardColors.statCitronDeep }}
              >
                {t('more.contracts.requestOnlineNote')}
              </Text>
            </View>
            <Button
              className="mt-2.5"
              label={t('more.contracts.onlineRequest')}
              onPress={() => router.push('/technician/contract-requests')}
            />
          </View>
        </View>
      </Card>
    </>
  );
}

function AdminView({
  t,
  technicians,
}: {
  t: TranslateFn;
  technicians: TechnicianSummary[];
}) {
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

  // Prefer picking a technician by name; the raw-ID field is only a fallback
  // when the directory comes back empty.
  const technicianOptions = useMemo(
    () =>
      technicians.map((technician) => ({
        value: String(technician.id),
        label:
          [technician.firstName, technician.lastName].filter(Boolean).join(' ') ||
          technician.email,
      })),
    [technicians],
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
      // "Contract created for technician at {site} on {date}."
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
    return <StateView variant="loading" title={t('more.contracts.loading')} />;
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
      <View className="mb-3 flex-row items-start gap-2.5">
        <View
          className="h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: dashboardColors.statMintSoft }}
        >
          <Handshake color={dashboardColors.statMintDeep} size={16} />
        </View>
        <View className="flex-1">
          <Text className="text-[13px] font-semibold text-ink">
            {t('more.contracts.recordTitle')}
          </Text>
          <Text className="mt-0.5 text-[10.5px] leading-[1.65] text-dashboard-caption">
            {t('more.contracts.recordIntro')}
          </Text>
        </View>
      </View>

      {confirmation ? (
        <View
          className="mb-3 flex-row items-start gap-2 rounded-lg px-3 py-2"
          style={{ backgroundColor: dashboardColors.statMintSoft }}
        >
          <Check color={dashboardColors.statMintDeep} size={15} />
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 text-[11px] leading-[1.65]"
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

      {technicianOptions.length > 0 ? (
        <Picker
          label={t('more.contracts.technicianLabel')}
          value={technicianIdText.length > 0 ? technicianIdText : null}
          onChange={setTechnicianIdText}
          options={technicianOptions}
        />
      ) : (
        <TextField
          label={t('more.contracts.technicianIdLabel')}
          value={technicianIdText}
          onChangeText={setTechnicianIdText}
          placeholder={t('more.contracts.technicianIdPlaceholder')}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      <Pressable
        onPress={() => setConsent(!consent)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        className="mb-3 flex-row items-start gap-3 rounded-lg border border-dashboard-card-line bg-surface p-3 active:opacity-70"
      >
        <View
          className={`mt-0.5 h-5 w-5 items-center justify-center rounded border ${
            consent
              ? 'border-dashboard-teal bg-dashboard-teal'
              : 'border-dashboard-card-line bg-card'
          }`}
        >
          {consent ? (
            <Check color={dashboardColors.ctaIconBg} size={14} strokeWidth={2.4} />
          ) : null}
        </View>
        <Text className="flex-1 text-[11.5px] leading-[1.7] text-ink">
          {t('more.contracts.consentLabel')}
        </Text>
      </Pressable>

      {error ? (
        <View className="mb-3 rounded-md bg-dashboard-error-bg px-3 py-2">
          <Text
            accessibilityRole="alert"
            className="text-[11px] leading-[1.7] text-dashboard-error-text"
          >
            {error}
          </Text>
        </View>
      ) : null}

      <Button
        label={
          submitting
            ? t('more.contracts.saving')
            : t('more.contracts.recordContract')
        }
        loading={submitting}
        onPress={() => void onSubmit()}
      >
        <View className="flex-row items-center gap-2">
          <ShieldCheck
            color={dashboardColors.ctaText}
            size={16}
            strokeWidth={2.2}
          />
          <Text
            className="text-[15px] font-semibold"
            style={{ color: dashboardColors.ctaText }}
          >
            {submitting
              ? t('more.contracts.saving')
              : t('more.contracts.recordContract')}
          </Text>
        </View>
      </Button>

    </Card>
  );
}
