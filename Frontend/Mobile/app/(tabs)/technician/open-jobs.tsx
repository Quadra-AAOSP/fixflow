import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { ArrowRight, Briefcase, ChevronDown, ChevronUp, ClipboardList, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { Screen } from '@/components/ui/Screen';
import { StateView } from '@/components/ui/StateView';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { UrgencyChip } from '@/components/ui/UrgencyChip';
import { useToast } from '@/components/ui/useToastContext';
import { dashboardColors, themeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/apiClient';
import { listJobs, applyForJob, actOnJobApplication, type MarketplaceListing } from '@/services/marketplace';
import { ownVerification } from '@/services/onboarding';
import { claimReport, listReports } from '@/services/reports';
import { getTechnicianTerms, listTechnicianContracts } from '@/services/technician';
import { TextField } from '@/components/ui/TextField';
import type { Report, Urgency } from '@/types';
import { humanize, relativeTime } from '@/utils/format';
import { effectiveUrgency, isClaimable } from '@/utils/maintenance';

const URGENCY_RANK: Record<Urgency, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** FlatList row union: a site header or one of its jobs. */
type Row =
  | { kind: 'header'; siteId: number; name: string; count: number }
  | { kind: 'job'; report: Report };

/**
 * Technician "Open jobs" board. Every unassigned, still-actionable report at
 * one of the technician's contract sites is listed here; picking one up calls
 * `POST /api/reports/{id}/claim`, which flips it to `assigned` and removes it
 * from this board (the report then lives under "My assignments").
 *
 * The site scope mirrors the backend: `claim` requires an active contract at
 * the report's site plus accepted terms.
 */
export default function OpenJobsScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const palette = themeColors();

  const [jobs, setJobs] = useState<Report[] | null>(null);
  // Open marketplace postings from site admins. Loaded separately so a
  // marketplace failure can't blank the contract job board.
  const [listings, setListings] = useState<MarketplaceListing[] | null>(null);
  const [siteNames, setSiteNames] = useState<Record<number, string>>({});
  const [contractSiteCount, setContractSiteCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  // Site groups start expanded; the chevron collapses a site's jobs so a
  // technician with many contract sites can scan the board.
  const [collapsedSites, setCollapsedSites] = useState<Record<number, boolean>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    if (jobs === null) setLoading(true);
    try {
      const contracts = await listTechnicianContracts();
      const siteIds = Array.from(new Set(contracts.map((contract) => contract.siteId)));
      setContractSiteCount(siteIds.length);
      setSiteNames(
        Object.fromEntries(contracts.map((contract) => [contract.siteId, contract.siteName])),
      );
      const pages = await Promise.all(
        siteIds.map((siteId) =>
          listReports({ siteId }).catch((err) => {
            // Skip a site whose records we cannot read instead of failing the
            // whole board — one stale contract must not hide every other job.
            if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
              return null;
            }
            throw err;
          }),
        ),
      );
      const merged = new Map<number, Report>();
      for (const page of pages) {
        if (!page) continue;
        for (const report of page) merged.set(report.id, report);
      }
      const open = Array.from(merged.values())
        .filter(isClaimable)
        .sort(
          (a, b) =>
            URGENCY_RANK[effectiveUrgency(a)] - URGENCY_RANK[effectiveUrgency(b)] ||
            b.createdAt.localeCompare(a.createdAt),
        );
      setJobs(open);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('openJobs.errorTitle'),
      );
    } finally {
      setLoading(false);
    }
    // Marketplace postings are fetched outside the error path above so the
    // board still renders if the marketplace endpoint misbehaves.
    try {
      setListings(await listJobs());
    } catch {
      setListings([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Quiet re-fetch after an inline apply / accept / withdraw so the cards
  // reflect the server state without a full board reload.
  const refreshListings = useCallback(async () => {
    try {
      setListings(await listJobs());
    } catch {
      // Keep the current cards on failure.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function onClaim(id: number) {
    if (claimingId !== null) return;
    setClaimingId(id);
    try {
      await claimReport(id);
      // Drop it immediately so the board reflects the pick-up even before the
      // focus refresh lands.
      setJobs((previous) => (previous ? previous.filter((job) => job.id !== id) : previous));
      showToast(t('openJobs.claimed'), 'success');
      await load();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : t('openJobs.claimFailed'),
        'error',
      );
    } finally {
      setClaimingId(null);
    }
  }

  const siteName = (id: number | null) =>
    id === null ? '' : siteNames[id] ?? t('openJobs.fallbackSite', { id });

  // Jobs are grouped by contract site with a collapsible header, so the board
  // reads as "these are the sites I work, here is what is open at each".
  const groups = Array.from(
    (jobs ?? []).reduce((map, job) => {
      const key = job.siteId ?? -1;
      const list = map.get(key) ?? [];
      list.push(job);
      map.set(key, list);
      return map;
    }, new Map<number, Report[]>()),
    ([siteId, items]) => ({
      siteId,
      name: siteId === -1
        ? t('openJobs.fallbackSite', { id: 0 })
        : siteName(siteId) || t('openJobs.fallbackSite', { id: siteId }),
      jobs: items,
    }),
  ).sort((a, b) => a.name.localeCompare(b.name));

  const rows: Row[] = groups.flatMap((group) => [
    { kind: 'header' as const, siteId: group.siteId, name: group.name, count: group.jobs.length },
    ...(collapsedSites[group.siteId]
      ? []
      : group.jobs.map((report) => ({ kind: 'job' as const, report }))),
  ]);

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(item) =>
          item.kind === 'job' ? `job-${item.report.id}` : `site-${item.siteId}`
        }
        className="flex-1"
        contentContainerClassName="grow px-5 pb-10 pt-4"
        // Keep note-field taps working while the keyboard is open — without
        // this the first tap only dismisses the keyboard.
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View>
            {/* This stack screen has headerShown:false (it draws its own
                title block), so it needs an explicit back control — otherwise
                the technician could only leave via the OS back gesture. */}
            <HeaderBackButton color={palette.ink} popTo="/more" />
            <View className="mb-2 flex-row items-center gap-3">
              <View
                className="rounded-xl p-3"
                style={{ backgroundColor: dashboardColors.statMintSoft }}
              >
                <Briefcase color={dashboardColors.statMintDeep} size={26} />
              </View>
              <View className="flex-1">
                <Text
                  className="text-xl font-bold text-ink"
                  style={{ letterSpacing: -0.4 }}
                >
                  {t('openJobs.title')}
                </Text>
                <Text className="mt-0.5 text-xs text-dashboard-subtitle">
                  {jobs !== null
                    ? t('openJobs.count', {
                        count: jobs.length,
                        plural: jobs.length === 1 ? '' : 's',
                      })
                    : t('openJobs.loading')}
                </Text>
              </View>
            </View>

            <Text className="mb-2 text-[12px] leading-[1.7] text-dashboard-subtitle">
              {t('openJobs.subtitle')}
            </Text>
            {/* Direct route to the site-technician application so a technician
                without contracts can ask to join a site's contractor pool. */}
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/technician/contract-requests')}
              className="mb-3 flex-row items-center gap-1 self-start active:opacity-70"
            >
              <Text
                className="text-[12px] font-semibold"
                style={{ color: palette.primary }}
              >
                {t('openJobs.applyLink')}
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          loading && jobs === null ? (
            <StateView variant="loading" title={t('openJobs.loading')} />
          ) : error && jobs === null ? (
            <StateView
              variant="error"
              title={t('openJobs.errorTitle')}
              description={error}
              actionLabel={t('openJobs.retry')}
              onAction={() => {
                void load();
              }}
            />
          ) : contractSiteCount === 0 ? (
            <StateView
              variant="empty"
              icon={ClipboardList}
              title={t('openJobs.noContractsTitle')}
              description={t('openJobs.noContractsDesc')}
              actionLabel={t('openJobs.applyAction')}
              onAction={() => router.push('/technician/contract-requests')}
            />
          ) : (
            <StateView
              variant="empty"
              icon={Search}
              title={t('openJobs.emptyTitle')}
              description={t('openJobs.emptyDesc')}
            />
          )
        }
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: !collapsedSites[item.siteId] }}
              onPress={() =>
                setCollapsedSites((previous) => ({
                  ...previous,
                  [item.siteId]: !previous[item.siteId],
                }))
              }
              className="mt-1 flex-row items-center justify-between rounded-lg border border-dashboard-card-line bg-dashboard-card-bg px-3 py-2 active:opacity-80"
            >
              <View className="flex-1 flex-row items-center gap-2">
                <Text
                  className="text-[13px] font-semibold text-ink"
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text className="text-[11px] text-dashboard-subtitle">
                  {t('openJobs.siteCount', {
                    count: item.count,
                    plural: item.count === 1 ? '' : 's',
                  })}
                </Text>
              </View>
              {collapsedSites[item.siteId] ? (
                <ChevronDown color={palette.ink} size={18} />
              ) : (
                <ChevronUp color={palette.ink} size={18} />
              )}
            </Pressable>
          ) : (
            <JobCard
              report={item.report}
              siteName={siteName(item.report.siteId)}
              claiming={claimingId === item.report.id}
              disabled={claimingId !== null}
              onClaim={() => onClaim(item.report.id)}
            />
          )
        }
        ListFooterComponent={
          <MarketplaceSection
            listings={listings}
            loading={loading}
            onOpen={() => router.push('/more/marketplace')}
            onRefreshListings={refreshListings}
          />
        }
      />
    </Screen>
  );
}

/**
 * Marketplace postings from site admins, shown below the contract board so
 * technicians see admin-published jobs without hunting through More. The
 * full lifecycle is inline: apply with a note, withdraw while pending, and
 * accept/decline when the site admin offers the job — the same
 * `/api/marketplace` flow `/more/marketplace` drives.
 */
function MarketplaceSection({
  listings,
  loading,
  onOpen,
  onRefreshListings,
}: {
  listings: MarketplaceListing[] | null;
  loading: boolean;
  onOpen: () => void;
  onRefreshListings: () => Promise<void>;
}) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { showToast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busyJob, setBusyJob] = useState<number | null>(null);
  const [verification, setVerification] = useState<string>();
  const [termsRequired, setTermsRequired] = useState(false);

  // Apply eligibility mirrors the backend (`apply` → requireEligible):
  // verified account + current terms accepted. Best-effort fetch; a failure
  // here only disables the buttons until the next focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const [record, terms] = await Promise.all([
            ownVerification(),
            getTechnicianTerms(),
          ]);
          if (!active) return;
          setVerification(record.status);
          setTermsRequired(
            terms.enforcementRequired && !terms.acceptedCurrentVersion,
          );
        } catch {
          // Server still validates eligibility on apply.
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  const open = (listings ?? []).filter((job) => job.status === 'open');
  // Only hard-disable when we *know* the account is blocked (unverified or
  // terms outstanding). If the gate info failed to load (`undefined`) we let
  // the tap through — the backend re-validates eligibility on apply and its
  // error message is shown as a toast, so the button can never silently die.
  const blocked =
    (verification !== undefined && verification !== 'verified') ||
    termsRequired;

  async function runJob(
    jobId: number,
    action: () => Promise<unknown>,
    successKey: string,
  ) {
    if (busyJob !== null) return;
    setBusyJob(jobId);
    try {
      await action();
      showToast(t(successKey), 'success');
      await onRefreshListings();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : t('openJobs.actionFailed'),
        'error',
      );
    } finally {
      setBusyJob(null);
    }
  }

  return (
    <View className="mt-6">
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text
          className="text-[15px] font-semibold text-ink"
          style={{ letterSpacing: -0.3 }}
        >
          {t('openJobs.marketplaceTitle')}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={onOpen}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <Text
            className="text-[11px] font-semibold"
            style={{ color: dashboardColors.teal }}
          >
            {t('openJobs.marketplaceOpen')}
          </Text>
          <ArrowRight color={dashboardColors.teal} size={13} />
        </Pressable>
      </View>
      <Text className="mb-3 text-[12px] leading-[1.7] text-dashboard-subtitle">
        {t('openJobs.marketplaceHint')}
      </Text>

      {verification && verification !== 'verified' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/more/my-verification')}
          className="mb-3 rounded-lg border border-dashboard-card-line bg-dashboard-banner-bg p-3 active:opacity-80"
        >
          <Text className="text-[11px] leading-[1.6] text-dashboard-subtitle">
            {t('marketplace.verificationRequired')}
          </Text>
          <Text
            className="mt-1 text-[11px] font-semibold"
            style={{ color: dashboardColors.teal }}
          >
            {t('review.myVerification')}
          </Text>
        </Pressable>
      ) : null}
      {termsRequired ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/technician/terms')}
          className="mb-3 rounded-lg border border-dashboard-card-line bg-dashboard-banner-bg p-3 active:opacity-80"
        >
          <Text className="text-[11px] leading-[1.6] text-dashboard-subtitle">
            {t('marketplace.termsRequired')}
          </Text>
          <Text
            className="mt-1 text-[11px] font-semibold"
            style={{ color: dashboardColors.teal }}
          >
            {t('workspace.terms')}
          </Text>
        </Pressable>
      ) : null}

      {listings === null ? (
        <Text className="text-xs text-dashboard-caption">
          {t('openJobs.loading')}
        </Text>
      ) : open.length === 0 ? (
        <Text className="text-xs text-dashboard-caption">
          {t('openJobs.marketplaceEmpty')}
        </Text>
      ) : (
        open.map((job) => {
          const own = job.myApplication;
          return (
            <View
              key={job.id}
              className="mb-3 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4"
            >
              <View className="mb-1 flex-row items-center justify-between gap-2">
                <Text
                  className="text-xs font-medium uppercase tracking-wide text-dashboard-subtitle"
                  numberOfLines={1}
                >
                  {humanize(job.category)}
                </Text>
                <Text className="text-[11px] font-medium text-dashboard-subtitle">
                  {t(`marketplace.states.${job.status}`)}
                </Text>
              </View>
              <Text className="text-sm font-medium text-ink" numberOfLines={3}>
                {job.summary}
              </Text>
              <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                <Text
                  className="text-[11px] text-dashboard-subtitle"
                  numberOfLines={1}
                >
                  {job.broadLocation}
                </Text>
                <Text className="text-[11px] text-dashboard-subtitle">
                  {job.timing}
                </Text>
                <Text className="text-[11px] text-dashboard-subtitle">
                  {[job.specialty, job.urgency].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {job.status === 'open' ? (
                <Text className="mt-2 text-[11px] text-dashboard-caption">
                  {t('marketplace.listingDeadline', {
                    date: new Date(job.expiresAt).toLocaleString(),
                  })}
                </Text>
              ) : null}

              {!own ? (
                <>
                  <TextField
                    label={t('marketplace.note')}
                    value={notes[job.id] ?? ''}
                    onChangeText={(value) =>
                      setNotes((previous) => ({ ...previous, [job.id]: value }))
                    }
                    placeholder={t('marketplace.note')}
                    maxLength={1000}
                    multiline
                    className="mt-3"
                  />
                  <Button
                    variant="cta"
                    className="mt-2 min-h-0 py-2"
                    label={
                      busyJob === job.id
                        ? t('openJobs.loading')
                        : t('marketplace.apply')
                    }
                    loading={busyJob === job.id}
                    disabled={
                      busyJob !== null ||
                      !(notes[job.id] ?? '').trim() ||
                      blocked
                    }
                    onPress={() =>
                      void runJob(
                        job.id,
                        () =>
                          applyForJob(job.id, (notes[job.id] ?? '').trim()),
                        'marketplace.applied',
                      )
                    }
                  />
                </>
              ) : (
                <>
                  <Text className="mt-3 text-[12px] font-semibold text-ink">
                    {t('marketplace.applicationStatus', {
                      status: t(`marketplace.states.${own.status}`),
                    })}
                  </Text>
                  {own.status === 'pending' ? (
                    <Button
                      variant="secondary"
                      className="mt-2 min-h-0 py-2"
                      label={t('marketplace.withdraw')}
                      loading={busyJob === job.id}
                      disabled={busyJob !== null}
                      onPress={() =>
                        void runJob(
                          job.id,
                          () =>
                            actOnJobApplication(job.id, own.id, 'withdraw'),
                          'marketplace.withdrawn',
                        )
                      }
                    />
                  ) : null}
                  {own.status === 'offered' ? (
                    <>
                      {own.offerExpiresAt ? (
                        <Text className="mt-1 text-[11px] text-dashboard-caption">
                          {t('marketplace.offerDeadline', {
                            date: new Date(own.offerExpiresAt).toLocaleString(),
                          })}
                        </Text>
                      ) : null}
                      <View className="mt-2 flex-row gap-2">
                        <View className="flex-1">
                          <Button
                            variant="cta"
                            className="min-h-0 py-2"
                            label={t('marketplace.accept')}
                            loading={busyJob === job.id}
                            disabled={busyJob !== null}
                            onPress={() =>
                              void runJob(
                                job.id,
                                () =>
                                  actOnJobApplication(
                                    job.id,
                                    own.id,
                                    'accept',
                                  ),
                                'marketplace.accepted',
                              )
                            }
                          />
                        </View>
                        <View className="flex-1">
                          <Button
                            variant="secondary"
                            className="min-h-0 py-2"
                            label={t('marketplace.decline')}
                            disabled={busyJob !== null}
                            onPress={() =>
                              void runJob(
                                job.id,
                                () =>
                                  actOnJobApplication(
                                    job.id,
                                    own.id,
                                    'decline',
                                  ),
                                'marketplace.declined',
                              )
                            }
                          />
                        </View>
                      </View>
                      <Text className="mt-2 text-[11px] leading-[1.6] text-dashboard-caption">
                        {t('openJobs.acceptHint')}
                      </Text>
                    </>
                  ) : null}
                </>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

function JobCard({
  report,
  siteName,
  claiming,
  disabled,
  onClaim,
}: {
  report: Report;
  siteName: string;
  claiming: boolean;
  disabled: boolean;
  onClaim: () => void;
}) {
  const { t } = useTranslation('common');
  return (
    <View className="rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4">
      <View className="mb-1 flex-row items-center justify-between gap-2">
        <Text
          className="text-xs font-medium uppercase tracking-wide text-dashboard-subtitle"
          numberOfLines={1}
        >
          {humanize(report.category)}
        </Text>
        <StatusBadge status={report.status} />
      </View>
      <Text className="text-sm text-ink" numberOfLines={3}>
        {report.description}
      </Text>
      <View className="mt-3 flex-row items-center justify-between">
        <UrgencyChip level={effectiveUrgency(report)} />
        <Text className="text-xs text-dashboard-caption">#{report.id}</Text>
      </View>
      <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <Text className="text-[11px] text-dashboard-subtitle" numberOfLines={1}>
          {siteName}
        </Text>
        <Text className="text-[11px] text-dashboard-subtitle">
          {relativeTime(report.createdAt)}
        </Text>
      </View>
      <Button
        variant="cta"
        className="mt-3 min-h-0 py-2"
        label={claiming ? t('openJobs.claiming') : t('openJobs.claim')}
        loading={claiming}
        disabled={disabled}
        onPress={onClaim}
      />
    </View>
  );
}
