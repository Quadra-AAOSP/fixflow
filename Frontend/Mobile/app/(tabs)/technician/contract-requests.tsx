import { StateView } from '@/components/ui/StateView';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Send,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Picker } from '@/components/ui/Picker';
import { Screen } from '@/components/ui/Screen';
import { dashboardColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import {
  createTechnicianContractRequest,
  listApplicableSites,
  listTechnicianContractRequests,
  listTechnicianContracts,
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
  const [siteId, setSiteId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [contractsResult, requestsResult, sitesResult] = await Promise.all([
        listTechnicianContracts(),
        listTechnicianContractRequests(),
        // The whole site directory, so the technician can apply anywhere —
        // `/api/sites` only returns their own account site.
        listApplicableSites(),
      ]);
      setContracts(contractsResult);
      setRequests(requestsResult);
      setSites(sitesResult);
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

  /** Sites this technician hasn't contracted or applied to yet. */
  const availableSites = useMemo(() => {
    const pending = new Set(
      requests.filter((r) => r.status === 'pending').map((r) => r.siteId),
    );
    return sites.filter(
      (site) =>
        !pending.has(site.id) && !contracts.some((c) => c.siteId === site.id),
    );
  }, [sites, contracts, requests]);

  const siteNameFor = useCallback(
    (id: number) => sites.find((site) => site.id === id)?.name ?? `#${id}`,
    [sites],
  );

  async function submit() {
    if (siteId === null || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const created = await createTechnicianContractRequest({ siteId });
      setNotice(t('technician.contractRequests.submitted', { site: siteNameFor(siteId) }));
      // Show the application immediately and drop the site from the picker.
      setRequests((previous) => [created, ...previous]);
      setSiteId(null);
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

            {availableSites.length === 0 && !loading ? (
              <Text className="text-[11px] leading-[1.7] text-dashboard-caption">
                {t('technician.contractRequests.noSites')}
              </Text>
            ) : (
              <>
                <Picker
                  label={t('technician.contractRequests.newSite')}
                  value={siteId !== null ? String(siteId) : null}
                  onChange={(value) => setSiteId(value ? Number(value) : null)}
                  options={availableSites.map((site) => ({
                    value: String(site.id),
                    label: site.name,
                  }))}
                  placeholder={t('technician.contractRequests.chooseSite')}
                />
                <Button
                  className="mt-3"
                  variant="cta"
                  onPress={submit}
                  loading={submitting}
                  disabled={siteId === null}
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
