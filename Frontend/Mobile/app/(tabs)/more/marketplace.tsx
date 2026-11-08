import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Action, Field } from '@/components/ReviewControls';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import {
  actOnJobApplication, applyForJob, cancelJobAssignment, closeJob, listJobApplications, listJobs, publishJob,
  type ListingDraft, type MarketplaceApplication, type MarketplaceListing,
} from '@/services/marketplace';
import { ownVerification } from '@/services/onboarding';
import { getTechnicianTerms } from '@/services/technician';

const emptyDraft: ListingDraft = { summary: '', broadLocation: '', timing: '' };
const limits = { summary: 300, broadLocation: 160, timing: 160 };
const openStates = ['open', 'offered'];

export default function MarketplaceScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user } = useAuth();
  const { reportId } = useLocalSearchParams<{ reportId?: string }>();
  const source = Number(reportId);
  const isAdmin = user?.role === 'admin';
  const isTechnician = user?.role === 'technician';
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
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canPublish = isAdmin && Number.isSafeInteger(source) && source > 0
    && !jobs.some(job => job.reportId === source && (job.status === 'assigned' || openStates.includes(job.status)));

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

  useFocusEffect(useCallback(() => {
    if (!isAdmin && !isTechnician) return;
    let active = true;
    void run(async () => {
      const listings = await listJobs();
      if (active) setJobs(listings);
      if (isTechnician) {
        const [record, terms] = await Promise.all([ownVerification(), getTechnicianTerms()]);
        if (active) {
          setVerification(record.status);
          setTermsRequired(terms.enforcementRequired && !terms.acceptedCurrentVersion);
        }
      }
    });
    return () => { active = false; };
  }, [isAdmin, isTechnician, run]));

  async function refresh() {
    setJobs(await listJobs());
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
          {canPublish ? (
            <View className="my-3 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4">
              <Text className="mb-2 font-bold text-ink">{t('marketplace.publishReport', { id: source })}</Text>
              <Text className="mb-3 text-ink">{t('marketplace.privacy')}</Text>
              {(Object.keys(limits) as (keyof ListingDraft)[]).map(key => (
                <Field key={key} label={t(`marketplace.${key}`)} value={draft[key]} maxLength={limits[key]}
                  multiline={key === 'summary'} onChangeText={value => {
                    setDraft(previous => ({ ...previous, [key]: value }));
                    setPrivacyConfirmed(false);
                  }} />
              ))}
              <View className="mb-2 flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-ink">{t('marketplace.confirmPrivacy')}</Text>
                <Switch accessibilityLabel={t('marketplace.confirmPrivacy')} value={privacyConfirmed}
                  disabled={busy} onValueChange={setPrivacyConfirmed} />
              </View>
              <Action label={t('marketplace.publish')}
                disabled={busy || !privacyConfirmed || Object.values(draft).some(value => !value.trim())}
                onPress={() => mutate(async () => {
                  const created = await publishJob(source, {
                    summary: draft.summary.trim(), broadLocation: draft.broadLocation.trim(), timing: draft.timing.trim(),
                  });
                  setJobs(current => [created, ...current]);
                  setDraft(emptyDraft);
                  setPrivacyConfirmed(false);
                }, 'marketplace.published')} />
            </View>
          ) : null}
          {!busy && jobs.length === 0 ? <Text className="my-3 text-ink">{t('marketplace.empty')}</Text> : null}
          {jobs.map(job => {
            const own = job.myApplication;
            const note = notes[job.id] ?? '';
            const accessibleReportId = isAdmin || own?.status === 'accepted' ? job.reportId : null;
            return (
              <View key={job.id} className="my-3 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg p-4">
                <Text className="mb-2 text-lg font-bold text-ink">{job.summary}</Text>
                <Text className="text-ink">{job.broadLocation} · {job.timing}</Text>
                <Text className="text-ink">{[job.category, job.specialty, job.urgency].filter(Boolean).join(' · ')}</Text>
                <Text className="text-ink">{t(`marketplace.states.${job.status}`)}</Text>
                {job.status === 'open' ? <Text>{t('marketplace.listingDeadline', { date: new Date(job.expiresAt).toLocaleString() })}</Text> : null}
                {accessibleReportId !== null ? <Action label={t('marketplace.openReport')} onPress={() => openReport(accessibleReportId)} /> : null}
                {isAdmin ? <>
                  <Action label={t('marketplace.applicants')} disabled={busy} onPress={() => review(job.id)} />
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
                  {reviewJob === job.id ? <>
                    {applications.length === 0 ? <Text>{t('marketplace.noApplicants')}</Text> : null}
                    {applications.map(application => (
                      <View key={application.id} className="my-2 border-t border-dashboard-card-line pt-3">
                        <Text className="font-bold text-ink">{application.technicianName} · {t(`marketplace.states.${application.status}`)}</Text>
                        <Text className="text-ink">{application.note}</Text>
                        <Text className="text-ink">{t('marketplace.workload', {
                          active: application.activeCases, completed: application.completedJobs,
                          cancellations: application.cancellations,
                          rating: application.averageRating?.toFixed(1) ?? t('marketplace.noRating'),
                        })}</Text>
                        {application.reviewedTrades ? <Text className="text-ink">{t('marketplace.reviewedTrades', { value: application.reviewedTrades })}</Text> : null}
                        {application.reviewedQualifications ? <Text className="text-ink">{t('marketplace.reviewedQualifications', { value: application.reviewedQualifications })}</Text> : null}
                        {job.status === 'open' && application.status === 'pending' ? <>
                          {candidate === application.id ? <Text className="my-2 text-ink">{t('marketplace.safety')}</Text> : null}
                          <Action label={t(candidate === application.id ? 'marketplace.confirmSelect' : 'marketplace.select')}
                            disabled={busy} onPress={() => {
                              if (candidate !== application.id) setCandidate(application.id);
                              else mutate(async () => {
                                await actOnJobApplication(job.id, application.id, 'select');
                                setCandidate(undefined);
                              }, 'marketplace.selected');
                            }} />
                        </> : null}
                      </View>
                    ))}
                  </> : null}
                </> : <>
                  {!own && job.status === 'open' ? <>
                    <Field label={t('marketplace.note')} value={note} maxLength={1000} multiline
                      onChangeText={value => setNotes(previous => ({ ...previous, [job.id]: value }))} />
                    <Action label={t('marketplace.apply')} disabled={busy || !note.trim()}
                      onPress={() => mutate(() => applyForJob(job.id, note.trim()), 'marketplace.applied')} />
                  </> : null}
                  {own ? <>
                    <Text className="font-semibold text-ink">{t('marketplace.applicationStatus', { status: t(`marketplace.states.${own.status}`) })}</Text>
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
