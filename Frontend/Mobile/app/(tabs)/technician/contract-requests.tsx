import { StateView } from '@/components/ui/StateView';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  Send,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  createTechnicianContractRequest,
  listApplicableSites,
  listTechnicianContractRequests,
  listTechnicianContracts,
  revokeOwnContract,
} from '@/services/technicians';
import type {
  Site,
  TechnicianContract,
  TechnicianContractRequest,
} from '@/types';
import { formatDate } from '@/utils/format';

/**
 * Technician contract screen. Two jobs only:
 *
 *   1. Show the sites this technician is contracted to
 *      (`GET /api/technician-contracts` — technicians see their own).
 *   2. Let them request a contract with a site
 *      (`POST /api/technician-contract-requests`).
 *
 * The request *review queue* is admin-only (`TechnicianContractService.list`
 * rejects non-admins with 403), so this screen must never call it — the old
 * version did, which surfaced "Only admin or super_admin can list contracts"
 * to technicians as a raw error banner.
 */
export default function TechnicianContractRequestsScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();

  const [contracts, setContracts] = useState<TechnicianContract[]>([]);
  const [requests, setRequests] = useState<TechnicianContractRequest[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedSiteIds, setSelectedSiteIds] = useState<number[]>([]);
  const [confirmLeave, setConfirmLeave] = useState<{
    siteId: number;
    contractId: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Settle independently: a missing site directory (older backend) must not
      // hide the contracts and applications that did load.
      const [contractsResult, requestsResult, sitesResult] = await Promise.allSettled([
        listTechnicianContracts(),
        listTechnicianContractRequests(),
        // The whole site directory, so the technician can apply anywhere —
        // `/api/sites` only returns their own account site.
        listApplicableSites(),
      ]);
      if (contractsResult.status === 'fulfilled') setContracts(contractsResult.value);
      if (requestsResult.status === 'fulfilled') setRequests(requestsResult.value);
      if (sitesResult.status === 'fulfilled') setSites(sitesResult.value);
      const failed = sitesResult.status === 'rejected' ? sitesResult.reason : null;
      if (failed) {
        setError(
          failed instanceof ApiError
            ? failed.message
            : t('technician.contractRequests.errors.couldNotLoad'),
        );
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('technician.contractRequests.errors.couldNotLoad'),
      );
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * A site is ticked when the technician wants that site's admin to know they
   * exist and assign jobs to them. Contracted/pending sites are already ticked
   * and locked; declined sites can be ticked again to re-apply.
   */
  const stateFor = useCallback(
    (id: number): 'contracted' | 'pending' | 'declined' | 'available' => {
      if (contracts.some((contract) => contract.siteId === id)) return 'contracted';
      const request = requests.find((item) => item.siteId === id);
      if (request?.status === 'pending') return 'pending';
      if (request?.status === 'rejected') return 'declined';
      return 'available';
    },
    [contracts, requests],
  );

  const isChecked = useCallback(
    (id: number) => {
      const state = stateFor(id);
      return (
        selectedSiteIds.includes(id) || state === 'contracted' || state === 'pending'
      );
    },
    [selectedSiteIds, stateFor],
  );

  const siteNameFor = useCallback(
    (id: number) => sites.find((site) => site.id === id)?.name ?? `#${id}`,
    [sites],
  );

  function toggleSite(id: number) {
    const state = stateFor(id);
    if (state === 'pending') return;
    if (state === 'contracted') {
      const contract = contracts.find((item) => item.siteId === id);
      if (!contract) return;
      setConfirmLeave({ siteId: id, contractId: contract.id });
      return;
    }
    setSelectedSiteIds((previous) =>
      previous.includes(id)
        ? previous.filter((siteId) => siteId !== id)
        : [...previous, id],
    );
  }

  /** Unticking a contracted site removes the technician's own contract. */
  async function leave(siteId: number, contractId: number) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await revokeOwnContract(contractId);
      setConfirmLeave(null);
      setNotice(t('technician.contractRequests.left', { site: siteNameFor(siteId) }));
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('technician.contractRequests.errors.couldNotSubmit'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submit() {
    if (selectedSiteIds.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const created: TechnicianContractRequest[] = [];
      for (const siteId of selectedSiteIds) {
        created.push(await createTechnicianContractRequest({ siteId }));
      }
      setRequests((previous) => [...created, ...previous]);
      setNotice(
        t('technician.contractRequests.submittedMany', { count: created.length }),
      );
      setSelectedSiteIds([]);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('technician.contractRequests.errors.couldNotSubmit'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="px-5 pb-12 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Back + kicker */}
        <View className="mb-3 mt-1 flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('technician.contractRequests.back')}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/more');
            }}
            className="h-9 w-9 items-center justify-center rounded-full border border-dashboard-card-line bg-dashboard-card-bg active:opacity-80"
          >
            <ArrowLeft color={dashboardColors.teal} size={16} />
          </Pressable>
          <Text className="text-[10px] font-semibold uppercase tracking-[1.5px] text-dashboard-caption">
            {t('technician.contractRequests.kicker')}
          </Text>
        </View>

        <Text
          className="text-[24px] font-bold text-ink"
          style={{ letterSpacing: -0.7 }}
        >
          {t('technician.contractRequests.heroTitle')}
          <Text className="text-coral-decay">.</Text>
        </Text>
        <Text className="mb-4 mt-1 text-[12px] leading-[1.8] text-dashboard-subtitle">
          {t('technician.contractRequests.heroBody')}
        </Text>

        {/* Feedback banners */}
        {error ? (
          <View
            className="mb-3 flex-row items-start gap-2 rounded-[12px] border px-3 py-2.5"
            style={{
              backgroundColor: dashboardColors.statCoralSoft,
              borderColor: dashboardColors.statCoralDeep,
            }}
          >
            <AlertCircle color={dashboardColors.statCoralDeep} size={14} />
            <Text
              className="flex-1 text-[11px] leading-[1.6]"
              style={{ color: dashboardColors.statCoralDeep }}
            >
              {error}
            </Text>
          </View>
        ) : null}
        {notice ? (
          <View
            className="mb-3 flex-row items-start gap-2 rounded-[12px] border px-3 py-2.5"
            style={{
              backgroundColor: dashboardColors.statMintSoft,
              borderColor: dashboardColors.statMintDeep,
            }}
          >
            <CheckCircle2 color={dashboardColors.statMintDeep} size={14} />
            <Text
              className="flex-1 text-[11px] leading-[1.6]"
              style={{ color: dashboardColors.statMintDeep }}
            >
              {notice}
            </Text>
          </View>
        ) : null}

        {/* Your contracts */}
        <Card padded={false} className="mb-4">
          <View className="flex-row items-center justify-between border-b border-dashboard-card-line px-4 py-3">
            <Text className="text-[14px] font-semibold text-ink">
              {t('technician.contractRequests.yourContracts')}
            </Text>
            <View
              className="rounded-full px-2 py-[2px]"
              style={{ backgroundColor: dashboardColors.statMintSoft }}
            >
              <Text
                className="text-[10px] font-semibold"
                style={{ color: dashboardColors.statMintDeep }}
              >
                {contracts.length}
              </Text>
            </View>
          </View>

          {loading ? (
            <StateView variant="loading" title={t('more.contracts.loading')} />
          ) : contracts.length === 0 ? (
            <View className="items-center px-6 py-7">
              <View
                className="mb-3 h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: dashboardColors.statMintSoft }}
              >
                <FileText color={dashboardColors.statMintDeep} size={18} />
              </View>
              <Text className="text-center text-[12px] leading-[1.7] text-dashboard-subtitle">
                {t('technician.contractRequests.noContracts')}
              </Text>
            </View>
          ) : (
            contracts.map((contract) => (
              <View
                key={contract.id}
                className="flex-row items-center justify-between border-b border-dashboard-card-line px-4 py-3 last:border-b-0"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-[13px] font-semibold text-ink">
                    {siteNameFor(contract.siteId)}
                  </Text>
                  <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                    {t('technician.contractRequests.createdAt', {
                      date: formatDate(contract.createdAt),
                    })}
                  </Text>
                </View>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: dashboardColors.statMintSoft }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{ color: dashboardColors.statMintDeep }}
                  >
                    {t('technician.contractRequests.active')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Applications waiting for a site admin */}
        {requests.length > 0 ? (
          <Card padded={false} className="mb-4">
            <View className="flex-row items-center justify-between border-b border-dashboard-card-line px-4 py-3">
              <Text className="text-[14px] font-semibold text-ink">
                {t('technician.contractRequests.yourRequests')}
              </Text>
              <View
                className="rounded-full px-2 py-[2px]"
                style={{ backgroundColor: dashboardColors.statCitronSoft }}
              >
                <Text
                  className="text-[10px] font-semibold"
                  style={{ color: dashboardColors.statCitronDeep }}
                >
                  {requests.length}
                </Text>
              </View>
            </View>
            {requests.map((request) => {
              const tone =
                request.status === 'approved'
                  ? {
                      bg: dashboardColors.statMintSoft,
                      fg: dashboardColors.statMintDeep,
                      label: t('technician.contractRequests.statusApproved'),
                    }
                  : request.status === 'rejected'
                    ? {
                        bg: dashboardColors.statCoralSoft,
                        fg: dashboardColors.statCoralDeep,
                        label: t('technician.contractRequests.statusRejected'),
                      }
                    : {
                        bg: dashboardColors.statCitronSoft,
                        fg: dashboardColors.statCitronDeep,
                        label: t('technician.contractRequests.statusPending'),
                      };
              return (
                <View
                  key={request.id}
                  className="flex-row items-center justify-between border-b border-dashboard-card-line px-4 py-3 last:border-b-0"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-[13px] font-semibold text-ink">
                      {siteNameFor(request.siteId)}
                    </Text>
                    <Text className="mt-0.5 text-[10px] text-dashboard-caption">
                      {t('technician.contractRequests.appliedAt', {
                        date: formatDate(request.createdAt),
                      })}
                    </Text>
                  </View>
                  <View
                    className="rounded-full px-2.5 py-1"
                    style={{ backgroundColor: tone.bg }}
                  >
                    <Text
                      className="text-[10px] font-semibold"
                      style={{ color: tone.fg }}
                    >
                      {tone.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}

        {/* Request a contract */}
        <Card padded={false}>
          <View className="flex-row items-center gap-2 border-b border-dashboard-card-line px-4 py-3">
            <Send color={dashboardColors.teal} size={14} />
            <Text className="text-[14px] font-semibold text-ink">
              {t('technician.contractRequests.requestTitle')}
            </Text>
          </View>
          <View className="px-4 py-3">
            <Text className="mb-3 text-[11px] leading-[1.7] text-dashboard-subtitle">
              {t('technician.contractRequests.requestBody')}
            </Text>

            {!loading && sites.length === 0 ? (
              <Text className="text-[11px] leading-[1.7] text-dashboard-caption">
                {t('technician.contractRequests.noSites')}
              </Text>
            ) : (
              <>
                <Text className="mb-1 text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption">
                  {t('technician.contractRequests.chooseSite')}
                </Text>
                <Text className="mb-2 text-[10.5px] leading-[1.6] text-dashboard-subtitle">
                  {t('technician.contractRequests.tickHint')}
                </Text>
                {sites.map((site) => {
                  const state = stateFor(site.id);
                  const checked = isChecked(site.id);
                  const locked = state === 'pending';
                  const details = [site.type, site.address]
                    .filter(Boolean)
                    .join(' · ');
                  const tag =
                    state === 'contracted'
                      ? t('technician.contractRequests.contractedTag')
                      : state === 'pending'
                        ? t('technician.contractRequests.statusPending')
                        : state === 'declined'
                          ? t('technician.contractRequests.statusRejected')
                          : null;
                  return (
                    <View key={site.id}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked, disabled: locked }}
                        disabled={locked}
                        onPress={() => toggleSite(site.id)}
                        className={`mb-2 flex-row items-start gap-3 rounded-[10px] border px-3 py-2.5 ${
                          locked ? 'opacity-70' : 'active:opacity-80'
                        }`}
                        style={{
                          borderColor: checked
                            ? dashboardColors.teal
                            : dashboardColors.cardLine,
                        }}
                      >
                        <View
                          className="mt-[1px] h-[20px] w-[20px] items-center justify-center rounded-[4px] border"
                          style={{
                            borderColor: checked
                              ? dashboardColors.teal
                              : dashboardColors.cardLine,
                            backgroundColor: checked
                              ? dashboardColors.teal
                              : 'transparent',
                          }}
                        >
                          {checked ? (
                            <Check color="#FFFFFF" size={14} strokeWidth={3} />
                          ) : null}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center justify-between gap-2">
                            <Text className="flex-1 text-[13px] font-semibold text-ink">
                              {site.name}
                            </Text>
                            {tag ? (
                              <Text className="text-[9.5px] font-semibold uppercase tracking-[0.6px] text-dashboard-caption">
                                {tag}
                              </Text>
                            ) : null}
                          </View>
                          {details ? (
                            <Text
                              className="mt-0.5 text-[10.5px] uppercase tracking-[0.4px] text-dashboard-subtitle"
                              numberOfLines={2}
                            >
                              {details}
                            </Text>
                          ) : null}
                          {state === 'contracted' ? (
                            <Text className="mt-1 text-[10px] text-dashboard-caption">
                              {t('technician.contractRequests.tapToLeave')}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                      {/* Inline confirm instead of Alert: Alert is a no-op on
                          Expo web, which made unticking look broken. */}
                      {confirmLeave?.siteId === site.id ? (
                        <View className="mb-2 rounded-[10px] border border-dashboard-card-line p-3">
                          <Text className="text-[11.5px] leading-[1.6] text-ink">
                            {t('technician.contractRequests.leaveBody', {
                              site: site.name,
                            })}
                          </Text>
                          <View className="mt-2 flex-row gap-2">
                            <Button
                              className="flex-1"
                              variant="secondary"
                              label={t('technician.contractRequests.leaveCancel')}
                              onPress={() => setConfirmLeave(null)}
                            />
                            <Button
                              className="flex-1"
                              label={t('technician.contractRequests.leaveConfirm')}
                              loading={submitting}
                              onPress={() =>
                                void leave(site.id, confirmLeave.contractId)
                              }
                            />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
                <Button
                  className="mt-3"
                  variant="cta"
                  onPress={submit}
                  loading={submitting}
                  disabled={selectedSiteIds.length === 0}
                >
                  {t('technician.contractRequests.submit')}
                </Button>
              </>
            )}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
