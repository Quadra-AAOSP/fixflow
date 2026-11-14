import { SiteVetting } from '@/components/technician/SiteVetting';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Action, Field } from '@/components/ReviewControls';
import { Screen } from '@/components/ui/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { useAuth } from '@/hooks/useAuth';
import { dashboardColors } from '@/constants/theme';
import {
  actOnJobApplication, applyForJob, cancelJobAssignment, closeJob, listJobApplications, listJobs, publishJob, searchJobsWithAi,
  type ListingDraft, type MarketplaceApplication, type MarketplaceListing,
} from '@/services/marketplace';
import { ownVerification } from '@/services/onboarding';
import { getReport, listReportsPage } from '@/services/reports';
import { getTechnicianTerms } from '@/services/technician';
import type { Report } from '@/types';
import { isClaimable } from '@/utils/maintenance';

const emptyDraft: ListingDraft = { summary: '', broadLocation: '', timing: '' };
const limits = { summary: 300, broadLocation: 160, timing: 160 };
const openStates = ['open', 'offered'];

export default function MarketplaceScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();
  const { reportId } = useLocalSearchParams<{ reportId?: string }>();
  const paramReportId = Number(reportId);
  const paramSource = Number.isSafeInteger(paramReportId) && paramReportId > 0 ? paramReportId : undefined;
  const isAdmin = user?.role === 'admin';
  const isTechnician = user?.role === 'technician';
  const [source, setSource] = useState<number | undefined>(paramSource);
  const [publishableReports, setPublishableReports] = useState<Report[] | null>(null);
  const [search, setSearch] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiIds, setAiIds] = useState<number[] | null>(null);
  const [aiMessage, setAiMessage] = useState('');
  const [jobs, setJobs] = useState<MarketplaceListing[]>([]);
  const [verification, setVerification] = useState<string>();
  const [termsRequired, setTermsRequired] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [reviewJob, setReviewJob] = useState<number>();
  const [applications, setApplications] = useState<MarketplaceApplication[]>([]);
  const [candidate, setCandidate] = useState<number>();
  const [closingJob, setClosingJob] = useState<number>();
  const [cancellingJob, setCancellingJob] = useState<number>();
  const [cancellationReason, setCancellationReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [publishIssue, setPublishIssue] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canPublish = isAdmin && source !== undefined;
  // Reports the admin could publish from this screen, excluding ones that
  // already have a live or awarded marketplace listing.
  const publishable = (publishableReports ?? []).filter(report =>
    !jobs.some(job => job.reportId === report.id && (job.status === 'assigned' || openStates.includes(job.status))),
  );
  const sourceNotPublishable = source !== undefined && publishableReports !== null
    && !publishable.some(report => report.id === source);

  // Keep the selection in sync when the screen is already mounted (tab kept
  // alive) and a report detail pushes a new `reportId`.
  useEffect(() => {
    if (paramSource !== undefined) setSource(paramSource);
  }, [paramSource]);

  const run = useCallback(async (operation: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await operation();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('marketplace.error'));
    } finally {
      setBusy(false);
    }
  }, [t]);

  const loadPublishableReports = useCallback(async (): Promise<Report[]> => {
    if (user?.siteId == null) return [];
    const page = await listReportsPage({ siteId: user.siteId, size: 100 });
    const reports = (page.content ?? []).filter(isClaimable);
    if (paramSource === undefined) return reports;
    if (reports.some(report => report.id === paramSource)) return reports;
    try {
      const linked = await getReport(paramSource);
      return isClaimable(linked) ? [linked, ...reports] : reports;
    } catch {
      return reports;
    }
  }, [paramSource, user?.siteId]);

  useFocusEffect(useCallback(() => {
    if (!isAdmin && !isTechnician) return;
    let active = true;
    void run(async () => {
      const listings = await listJobs();
      if (active) setJobs(listings);
      if (isAdmin) {
        const siteReports = await loadPublishableReports();
        if (active) setPublishableReports(siteReports);
      }
      if (isTechnician) {
        const [record, terms] = await Promise.all([ownVerification(), getTechnicianTerms()]);
        if (active) {
          setVerification(record.status);
          setTermsRequired(terms.enforcementRequired && !terms.acceptedCurrentVersion);
        }
      }
    });
    return () => { active = false; };
  }, [isAdmin, isTechnician, loadPublishableReports, run, user?.siteId]));

  async function refresh() {
    setJobs(await listJobs());
    if (isAdmin && user?.siteId != null) {
      setPublishableReports(await loadPublishableReports());
    }
    if (reviewJob !== undefined) setApplications(await listJobApplications(reviewJob));
    if (isTechnician) {
      const [record, terms] = await Promise.all([ownVerification(), getTechnicianTerms()]);
      setVerification(record.status);
      setTermsRequired(terms.enforcementRequired && !terms.acceptedCurrentVersion);
    }
  }

  function mutate(operation: () => Promise<unknown>, success: string) {
    void run(async () => {
      await operation();
      setMessage(t(success));
      await refresh();
    });
  }

  function review(jobId: number) {
    void run(async () => {
      const result = await listJobApplications(jobId);
      setCandidate(undefined);
      setReviewJob(jobId);
      setApplications(result);
    });
  }

  function openReport(id: number) {
    router.push({ pathname: '/reports/[id]', params: { id: String(id) } });
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('marketplace.title') }} />
      <ScrollView contentContainerClassName="p-5 pb-10" keyboardShouldPersistTaps="handled">
        {!isAdmin && !isTechnician ? <Text>{t('review.denied')}</Text> : <>
          <Text className="mb-2 text-xl font-bold text-ink">{t('marketplace.title')}</Text>
          <Text className="mb-3 text-ink">{t(isAdmin ? 'marketplace.adminIntro' : 'marketplace.technicianIntro')}</Text>
          <Action label={t('review.refresh')} disabled={busy} onPress={() => void run(refresh)} />
          {busy ? <Text accessibilityLiveRegion="polite">{t('review.loading')}</Text> : null}
          {error ? <Text accessibilityRole="alert" className="my-2 text-red-700">{error}</Text> : null}
          {message ? <Text accessibilityLiveRegion="polite" className="my-2 text-ink">{message}</Text> : null}
          {isTechnician && verification && verification !== 'verified' ? (
            <View className="my-2">
              <Text className="text-ink">{t('marketplace.verificationRequired')}</Text>
              <Action label={t('review.myVerification')} onPress={() => router.push('/more/my-verification')} />
            </View>
          ) : null}
          {isTechnician && termsRequired ? (
            <View className="my-2">
              <Text className="text-ink">{t('marketplace.termsRequired')}</Text>
              <Action label={t('workspace.terms')} onPress={() => router.push('/technician/terms')} />
            </View>
          ) : null}
          {isAdmin ? (
            <View className="my-3 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4">
              <Text className="mb-1 font-bold text-ink">{t('marketplace.chooseReport')}</Text>
              <Text className="mb-2 text-ink">{t('marketplace.chooseReportHint')}</Text>
              {publishableReports === null ? (
                <Text className="text-ink">{t('review.loading')}</Text>
              ) : publishable.length === 0 ? (
                <Text className="text-ink">{t('marketplace.noReportsToPublish')}</Text>
              ) : publishable.map(report => (
                <View key={report.id} className="my-2 rounded-lg border border-dashboard-card-line p-3">
                  <Text className="font-bold text-ink">{t('marketplace.reportOption', { id: report.id })}</Text>
                  <Text className="mb-1 text-ink" numberOfLines={2}>{report.description}</Text>
                  <Text className="mb-2 text-ink">{report.category}</Text>
                  <Action
                    label={source === report.id ? t('marketplace.selectedReport') : t('marketplace.selectReport')}
                    disabled={busy || source === report.id}
                    onPress={() => setSource(report.id)}
                  />
                </View>
              ))}
              {sourceNotPublishable ? (
                <Text className="my-2 text-ink">{t('marketplace.reportNotPublishable')}</Text>
              ) : null}
            </View>
          ) : null}
          {canPublish && !sourceNotPublishable ? (
            <View className="my-3 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4">
              <Text className="mb-2 font-bold text-ink">{t('marketplace.publishReport', { id: source })}</Text>
              <Text className="mb-3 text-ink">{t('marketplace.privacy')}</Text>
              {(Object.keys(limits) as (keyof ListingDraft)[]).map(key => (
                <Field key={key} label={t(`marketplace.${key}`)} value={draft[key]} maxLength={limits[key]}
                  multiline={key === 'summary'} onChangeText={value => {
                    setDraft(previous => ({ ...previous, [key]: value }));
                    setPublishIssue('');
                  }} />
              ))}
              <View className="mb-2 flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-ink">{t('marketplace.confirmPrivacy')}</Text>
                <Switch accessibilityLabel={t('marketplace.confirmPrivacy')} value={privacyConfirmed}
                  disabled={busy} onValueChange={value => { setPrivacyConfirmed(value); setPublishIssue(''); }} />
              </View>
              <Action label={t('marketplace.publish')}
                disabled={busy}
                onPress={() => {
                  const missing = (Object.keys(limits) as (keyof ListingDraft)[])
                    .filter(key => !draft[key].trim())
                    .map(key => t(`marketplace.${key}`));
                  if (missing.length > 0) {
                    setPublishIssue(t('marketplace.publishMissingFields', { fields: missing.join(', ') }));
                    return;
                  }
                  if (!privacyConfirmed) {
                    setPublishIssue(t('marketplace.publishMissingPrivacy'));
                    return;
                  }
                  setPublishIssue('');
                  mutate(async () => {
                    const created = await publishJob(source, {
                      summary: draft.summary.trim(), broadLocation: draft.broadLocation.trim(), timing: draft.timing.trim(),
                    });
                    setJobs(current => [created, ...current]);
                    setDraft(emptyDraft);
                    setPrivacyConfirmed(false);
                  }, 'marketplace.published');
                }} />
              {publishIssue ? (
                <Text accessibilityRole="alert" className="mt-1 text-[12px] leading-[1.6] text-red-700">
                  {publishIssue}
                </Text>
              ) : null}
            </View>
          ) : null}
          {isTechnician ? <View className="my-3 rounded-2xl border border-dashboard-card-line bg-dashboard-card-bg p-4">
            <Text className="mb-2 text-[13px] font-semibold text-ink">Find the right job</Text>
            <Field label="Describe jobs you are looking for" value={aiQuery} maxLength={500} onChangeText={setAiQuery} />
            <Action label="Search with AI" disabled={busy || !aiQuery.trim()} onPress={() => void run(async () => {
              const result = await searchJobsWithAi(aiQuery.trim());
              setAiIds(result.listings.map(job => job.id)); setSearch('');
              setAiMessage((result.fallback ? 'AI unavailable; using manual keyword search. ' : 'AI filters: ') + Object.values(result.filters).filter(Boolean).join(', '));
            })} />
            <Action label="Clear AI search" onPress={() => { setAiIds(null); setAiMessage(''); }} />
            {aiMessage ? <Text accessibilityLiveRegion="polite">{aiMessage}</Text> : null}
          </View> : null}
          <View className="my-3">
            <SearchField value={search} onChangeText={setSearch} placeholder="Manual keyword search" />
          </View>
          {!busy && jobs.length === 0 ? (
            <Text className="my-6 text-center text-[13px]" style={{ color: dashboardColors.caption }}>
              {t('marketplace.empty')}
            </Text>
          ) : null}
          {jobs.filter(job => (aiIds === null || aiIds.includes(job.id)) && [job.summary, job.broadLocation, job.timing, job.category, job.specialty, job.urgency].filter(Boolean).join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(job => {
            const own = job.myApplication;
            const note = notes[job.id] ?? '';
            const accessibleReportId = isAdmin || own?.status === 'accepted' ? job.reportId : null;
            const chip = listingChip(job.status);
            return (
              <View key={job.id} className="my-3 rounded-2xl border border-dashboard-card-line bg-dashboard-card-bg p-4">
                {/* Card header — summary + status pill. */}
                <View className="mb-2 flex-row items-start justify-between gap-2">
                  <Text className="flex-1 text-[15px] font-bold leading-snug text-ink" style={{ letterSpacing: -0.2 }}>{job.summary}</Text>
                  <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: chip.bg }}>
                    <Text className="text-[10px] font-semibold uppercase" style={{ color: chip.ink, letterSpacing: 0.6 }}>{t(`marketplace.states.${job.status}`)}</Text>
                  </View>
                </View>
                {/* Meta row — location, timing, trade tags. */}
                <View className="mb-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                  <Text className="text-[11px] text-dashboard-subtitle" numberOfLines={1}>{job.broadLocation}</Text>
                  <Text className="text-[11px] text-dashboard-subtitle">{job.timing}</Text>
                  <Text className="text-[11px] font-medium text-dashboard-subtitle">{[job.category, job.specialty, job.urgency].filter(Boolean).join(' · ')}</Text>
                </View>
                {job.status === 'open' ? <Text className="text-[11px] text-dashboard-caption">{t('marketplace.listingDeadline', { date: new Date(job.expiresAt).toLocaleString() })}</Text> : null}
                {/* Work owner — who holds the offer / the assignment right now. */}
                {isAdmin && job.assignedTechnicianName ? (
                  <View className="mt-2 self-start rounded-lg px-2.5 py-1.5" style={{ backgroundColor: dashboardColors.tealSoft }}>
                    <Text className="text-[11px] font-semibold" style={{ color: dashboardColors.teal }}>
                      {t(job.status === 'assigned' ? 'marketplace.assignedTo' : 'marketplace.offerTo', { name: job.assignedTechnicianName })}
                    </Text>
                  </View>
                ) : null}
                {/* Progress pipeline — mirrors the order tracker. */}
                {isAdmin && ['open', 'offered', 'assigned'].includes(job.status) ? (
                  <ListingPipeline status={job.status} t={t} />
                ) : null}
                {accessibleReportId !== null ? <Action label={t('marketplace.openReport')} onPress={() => openReport(accessibleReportId)} /> : null}
                {isAdmin ? <>
                  {/* Applicants toggle — the header carries the open/closed state
                      and the live applicant count once loaded. */}
                  <View className="mt-2 border-t border-dashboard-card-line pt-3">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: reviewJob === job.id }}
                      disabled={busy}
                      onPress={() => (reviewJob === job.id ? setReviewJob(undefined) : review(job.id))}
                      className="flex-row items-center justify-between rounded-lg px-3 py-2.5"
                      style={{ backgroundColor: dashboardColors.pillBg, opacity: busy ? 0.5 : 1 }}
                    >
                      <Text className="font-semibold text-ink">
                        {reviewJob === job.id ? t('marketplace.applicantsHide') : t('marketplace.applicants')}
                      </Text>
                      {reviewJob === job.id && applications.length > 0 ? (
                        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: dashboardColors.statMintSoft }}>
                          <Text className="text-[10px] font-semibold" style={{ color: dashboardColors.statMintDeep }}>
                            {t('marketplace.applicantsCount', { count: applications.length })}
                          </Text>
                        </View>
                      ) : null}
                    </Pressable>
                  </View>
                  {openStates.includes(job.status) ? <Action
                    label={t(closingJob === job.id ? 'marketplace.confirmClose' : 'marketplace.close')}
                    disabled={busy} onPress={() => {
                      if (closingJob !== job.id) setClosingJob(job.id);
                      else mutate(async () => { await closeJob(job.id); setClosingJob(undefined); }, 'marketplace.closed');
                    }} /> : null}
                  {job.canCancelAssignment ? cancellingJob === job.id ? <View className="my-2">
                    <Field label={t('marketplace.cancellationReason')} value={cancellationReason} onChangeText={setCancellationReason} maxLength={2000} multiline />
                    <Action label={t('marketplace.confirmCancelAssignment')} disabled={busy || !cancellationReason.trim()}
                      onPress={() => mutate(async () => {
                        await cancelJobAssignment(job.id, cancellationReason.trim());
                        setCancellingJob(undefined);
                        setCancellationReason('');
                      }, 'marketplace.assignmentCancelled')} />
                    <Action label={t('marketplace.keepAssignment')} disabled={busy} onPress={() => setCancellingJob(undefined)} />
                  </View> : <Action label={t('marketplace.cancelAssignment')} disabled={busy}
                    onPress={() => { setCancellingJob(job.id); setCancellationReason(''); }} /> : null}
                  {reviewJob === job.id ? (
                    <View className="mt-3 rounded-2xl p-3" style={{ backgroundColor: dashboardColors.tealSoft }}>
                      {/* Failures (vetting not recorded, technician unverified,
                          stale listing…) surface here, next to the offer button
                          that caused them — not just at the top of the screen. */}
                      {error ? (
                        <Text accessibilityRole="alert" className="mb-2 rounded-lg p-2 text-[12px] leading-4" style={{ backgroundColor: dashboardColors.statCoralSoft, color: dashboardColors.statCoralDeep }}>
                          {error}
                        </Text>
                      ) : null}
                      {applications.length === 0 ? (
                        <Text className="py-2 text-center text-[12px]" style={{ color: dashboardColors.subtitle }}>
                          {t('marketplace.noApplicants')}
                        </Text>
                      ) : null}
                      {applications.map(application => (
                        <ApplicantCard
                          key={application.id}
                          application={application}
                          offering={job.status === 'open' && application.status === 'pending'}
                          candidate={candidate === application.id}
                          busy={busy}
                          siteId={job.siteId ?? user?.siteId ?? null}
                          t={t}
                          onSelect={() => setCandidate(application.id)}
                          onSend={() => mutate(async () => {
                            await actOnJobApplication(job.id, application.id, 'select');
                            setCandidate(undefined);
                          }, 'marketplace.selected')}
                          onCancel={() => setCandidate(undefined)}
                        />
                      ))}
                    </View>
                  ) : null}
                </> : <>
                  {!own && job.status === 'open' ? <>
                    <Field label={t('marketplace.note')} value={note} maxLength={1000} multiline
                      onChangeText={value => setNotes(previous => ({ ...previous, [job.id]: value }))} />
                    <Action label={t('marketplace.apply')}
                      disabled={busy || !note.trim() || (verification !== null && verification !== 'verified') || termsRequired}
                      onPress={() => mutate(() => applyForJob(job.id, note.trim()), 'marketplace.applied')} />
                  </> : null}
                  {own ? <>
                    <Text className="font-semibold text-ink">{t('marketplace.applicationStatus', { status: t(`marketplace.states.${own.status}`) })}</Text>
                    <ApplicationPipeline status={own.status} t={t} />
                    {own.status === 'pending' ? <Action label={t('marketplace.withdraw')} disabled={busy}
                      onPress={() => mutate(() => actOnJobApplication(job.id, own.id, 'withdraw'), 'marketplace.withdrawn')} /> : null}
                    {own.status === 'offered' ? <>
                      {own.offerExpiresAt ? <Text>{t('marketplace.offerDeadline', { date: new Date(own.offerExpiresAt).toLocaleString() })}</Text> : null}
                      <Action label={t('marketplace.accept')} disabled={busy}
                        onPress={() => mutate(() => actOnJobApplication(job.id, own.id, 'accept'), 'marketplace.accepted')} />
                      <Action label={t('marketplace.decline')} disabled={busy}
                        onPress={() => mutate(() => actOnJobApplication(job.id, own.id, 'decline'), 'marketplace.declined')} />
                    </> : null}
                  </> : null}
                </>}
              </View>
            );
          })}
        </>}
      </ScrollView>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  Applicants review — card per candidate                                    */
/* -------------------------------------------------------------------------- */

/** Mini progress pipeline shared by admin listing cards (Published → Offer
    sent → Assigned) and technician application cards (Applied → Offer →
    Accepted). Teal = completed steps, teal label = current step. */
function StepPipeline({ steps, current, t }: { steps: readonly string[]; current: number; t: (key: string, options?: Record<string, unknown>) => string }) {
  return (
    <View className="mt-2.5 flex-row items-start">
      {steps.map((step, index) => (
        <View
          key={step}
          className="flex-row items-start"
          style={{ flex: index < steps.length - 1 ? 1 : undefined }}
        >
          <View className="items-center" style={{ width: 74 }}>
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: index <= current ? dashboardColors.teal : dashboardColors.cardLine }} />
            <Text className="mt-1 text-center text-[9px] leading-3" style={{ color: index <= current ? dashboardColors.teal : dashboardColors.caption }}>
              {t(`marketplace.pipeline.${step}`)}
            </Text>
          </View>
          {index < steps.length - 1 ? (
            <View className="mt-1 h-0.5 flex-1" style={{ backgroundColor: index < current ? dashboardColors.teal : dashboardColors.cardLine }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const LISTING_STEPS = ['published', 'offer', 'assigned'] as const;
const APPLICATION_STEPS = ['applied', 'offer', 'accepted'] as const;

/** Admin listing card pipeline. */
function ListingPipeline({ status, t }: { status: MarketplaceListing['status']; t: (key: string, options?: Record<string, unknown>) => string }) {
  return (
    <StepPipeline
      steps={LISTING_STEPS}
      current={status === 'assigned' ? 2 : status === 'offered' ? 1 : 0}
      t={t}
    />
  );
}

/** Technician application card pipeline. Ended applications (declined,
    withdrawn, rejected, expired, cancelled) get no pipeline — the status
    text already says why it stopped. */
function ApplicationPipeline({ status, t }: { status: MarketplaceApplication['status']; t: (key: string, options?: Record<string, unknown>) => string }) {
  if (!['pending', 'offered', 'accepted'].includes(status)) return null;
  return (
    <StepPipeline
      steps={APPLICATION_STEPS}
      current={status === 'accepted' ? 2 : status === 'offered' ? 1 : 0}
      t={t}
    />
  );
}

/** Listing pill colour: mint = live, citron = offer pending, quiet = settled. */
function listingChip(status: MarketplaceListing['status']): { bg: string; ink: string } {
  switch (status) {
    case 'open':
      return { bg: dashboardColors.statMintSoft, ink: dashboardColors.statMintDeep };
    case 'offered':
      return { bg: dashboardColors.statCitronSoft, ink: dashboardColors.statCitronDeep };
    case 'assigned':
      return { bg: dashboardColors.tealSoft, ink: dashboardColors.teal };
    default:
      return { bg: 'transparent', ink: dashboardColors.caption };
  }
}

/** Applicant pill colour: citron = needs the admin's decision, mint = offer in
    flight, teal = working the job, quiet = ended. */
function applicationChip(status: MarketplaceApplication['status']): { bg: string; ink: string } {
  switch (status) {
    case 'pending':
      return { bg: dashboardColors.statCitronSoft, ink: dashboardColors.statCitronDeep };
    case 'offered':
      return { bg: dashboardColors.statMintSoft, ink: dashboardColors.statMintDeep };
    case 'accepted':
      return { bg: dashboardColors.tealSoft, ink: dashboardColors.teal };
    default:
      return { bg: 'transparent', ink: dashboardColors.caption };
  }
}

type ApplicantProps = {
  application: MarketplaceApplication;
  offering: boolean;
  candidate: boolean;
  busy: boolean;
  siteId: number | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  onSelect: () => void;
  onSend: () => void;
  onCancel: () => void;
};

function ApplicantCard({ application, offering, candidate, busy, siteId, t, onSelect, onSend, onCancel }: ApplicantProps) {
  const chip = applicationChip(application.status);
  const initials = application.technicianName
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(word => word.charAt(0).toUpperCase()).join('') || '?';
  const stats = [
    { label: t('marketplace.statActive'), value: String(application.activeCases) },
    { label: t('marketplace.statCompleted'), value: String(application.completedJobs) },
    { label: t('marketplace.statCancellations'), value: String(application.cancellations) },
    { label: t('marketplace.statRating'), value: application.averageRating?.toFixed(1) ?? t('marketplace.noRating') },
  ];
  return (
    <View className="mb-2.5 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-3">
      {/* Identity row — initials avatar, name, status pill. */}
      <View className="flex-row items-center gap-2.5">
        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: dashboardColors.tealSoft }}>
          <Text className="text-[12px] font-bold" style={{ color: dashboardColors.teal }}>{initials}</Text>
        </View>
        <Text className="flex-1 text-[14px] font-bold text-ink" numberOfLines={1}>
          {application.technicianName}
        </Text>
        <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: chip.bg }}>
          <Text className="text-[10px] font-semibold uppercase" style={{ color: chip.ink, letterSpacing: 0.5 }}>
            {t(`marketplace.states.${application.status}`)}
          </Text>
        </View>
      </View>
      {/* Application note, quoted. */}
      {application.note ? (
        <View className="mt-2.5 rounded-lg py-1 pl-2.5" style={{ borderLeftWidth: 2, borderLeftColor: dashboardColors.teal }}>
          <Text className="text-[12px] italic leading-4 text-ink">“{application.note}”</Text>
        </View>
      ) : null}
      {/* Workload snapshot. */}
      <View className="mt-2.5 flex-row flex-wrap gap-1.5">
        {stats.map(stat => (
          <View key={stat.label} className="rounded-md px-2 py-1" style={{ backgroundColor: dashboardColors.tealSoft }}>
            <Text className="text-[10px]" style={{ color: dashboardColors.subtitle }}>
              {stat.label} <Text className="font-semibold text-ink">{stat.value}</Text>
            </Text>
          </View>
        ))}
      </View>
      {/* Vetted profile highlights. */}
      {application.reviewedTrades || application.reviewedQualifications ? (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {application.reviewedTrades ? (
            <View className="rounded-md px-2 py-1" style={{ backgroundColor: dashboardColors.statMintSoft }}>
              <Text className="text-[10px] font-medium" style={{ color: dashboardColors.statMintDeep }}>
                {t('marketplace.reviewedTrades', { value: application.reviewedTrades })}
              </Text>
            </View>
          ) : null}
          {application.reviewedQualifications ? (
            <View className="rounded-md px-2 py-1" style={{ backgroundColor: dashboardColors.statMintSoft }}>
              <Text className="text-[10px] font-medium" style={{ color: dashboardColors.statMintDeep }}>
                {t('marketplace.reviewedQualifications', { value: application.reviewedQualifications })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {/* Site vetting record stays expandable inside the card. */}
      {siteId !== null ? (
        <View className="mt-2.5">
          <SiteVetting siteId={siteId} technicianId={application.technicianId} admin />
        </View>
      ) : null}
      {/* Offer flow — select, then a warning banner with send / cancel. */}
      {offering ? (
        candidate ? (
          <View className="mt-3 rounded-xl p-3" style={{ backgroundColor: dashboardColors.statCitronSoft }}>
            <Text className="text-[12px] leading-4" style={{ color: dashboardColors.statCitronDeep }}>
              {t('marketplace.safety')}
            </Text>
            <Text className="mt-1.5 text-[11px] leading-4" style={{ color: dashboardColors.statCitronDeep }}>
              {t('marketplace.safetyHint')}
            </Text>
            <View className="mt-2 flex-row gap-2">
              <View className="flex-1">
                <Action label={t('marketplace.sendOffer')} disabled={busy} onPress={onSend} />
              </View>
              <View className="flex-1">
                <Action label={t('marketplace.cancel')} disabled={busy} onPress={onCancel} />
              </View>
            </View>
          </View>
        ) : (
          <View className="mt-2.5">
            <Action label={t('marketplace.select')} disabled={busy} onPress={onSelect} />
          </View>
        )
      ) : null}
    </View>
  );
}

