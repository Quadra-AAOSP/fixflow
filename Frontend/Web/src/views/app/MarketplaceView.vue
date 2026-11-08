<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useLocale } from '@/i18n';
import { errorMessage } from '@/services/api';
import {
  actOnMarketplaceApplication, applyForMarketplaceJob, cancelMarketplaceAssignment, closeMarketplaceJob, listMarketplaceApplicants,
  listMarketplaceJobs, type MarketplaceApplication, type MarketplaceListing,
} from '@/services/marketplace';
import { formatDate, humanize, urgencyLabels } from '@/utils/maintenance';

const { t } = useLocale();
const { user } = useAuth();
const admin = computed(() => user.value?.role === 'admin');
const listings = ref<MarketplaceListing[]>([]);
const applicants = ref<MarketplaceApplication[]>([]);
const selectedListing = ref<number | null>(null);
const notes = ref<Record<number, string>>({});
const safetyConfirmed = ref<Record<number, boolean>>({});
const loading = ref(false);
const loadingApplicants = ref(false);
const busy = ref(false);
const error = ref('');
const applicantError = ref('');
let revision = 0;
let listingRequest: AbortController | undefined;
let applicantRequest: AbortController | undefined;

async function load() {
  listingRequest?.abort();
  const request = new AbortController();
  listingRequest = request;
  loading.value = true;
  error.value = '';
  try {
    const result = await listMarketplaceJobs(request.signal);
    if (!request.signal.aborted) listings.value = result;
  } catch (err) { if (!request.signal.aborted) error.value = errorMessage(err); }
  finally { if (!request.signal.aborted) loading.value = false; }
}

async function openApplicants(listingId: number) {
  applicantRequest?.abort();
  const request = new AbortController();
  applicantRequest = request;
  selectedListing.value = listingId;
  applicants.value = [];
  safetyConfirmed.value = {};
  applicantError.value = '';
  loadingApplicants.value = true;
  try {
    const result = await listMarketplaceApplicants(listingId, request.signal);
    if (!request.signal.aborted) applicants.value = result;
  } catch (err) { if (!request.signal.aborted) applicantError.value = errorMessage(err); }
  finally { if (!request.signal.aborted) loadingApplicants.value = false; }
}

async function save(change: () => Promise<unknown>, listingId: number) {
  if (busy.value || loading.value) return;
  const current = revision;
  busy.value = true;
  error.value = '';
  try {
    await change();
    if (current !== revision) return;
    delete notes.value[listingId];
    await load();
    if (current === revision && selectedListing.value === listingId && admin.value) await openApplicants(listingId);
  } catch (err) { if (current === revision) error.value = errorMessage(err); }
  finally { if (current === revision) busy.value = false; }
}

function apply(listing: MarketplaceListing) {
  const note = notes.value[listing.id]?.trim();
  if (note && listing.status === 'open' && !listing.myApplication) {
    void save(() => applyForMarketplaceJob(listing.id, note), listing.id);
  }
}

function cancel(listing: MarketplaceListing) {
  const reason = notes.value[listing.id]?.trim();
  if (reason && listing.canCancelAssignment) {
    void save(() => cancelMarketplaceAssignment(listing.id, reason), listing.id);
  }
}

function act(listingId: number, applicationId: number, action: 'select' | 'accept' | 'decline' | 'withdraw') {
  if (action === 'select' && !safetyConfirmed.value[applicationId]) return;
  void save(() => actOnMarketplaceApplication(listingId, applicationId, action), listingId);
}

watch([() => user.value?.id, () => user.value?.role, () => user.value?.siteId], () => {
  revision++;
  applicantRequest?.abort();
  selectedListing.value = null;
  applicants.value = [];
  applicantError.value = '';
  loadingApplicants.value = false;
  safetyConfirmed.value = {};
  notes.value = {};
  busy.value = false;
  listings.value = [];
  void load();
}, { immediate: true });

onBeforeUnmount(() => { revision++; listingRequest?.abort(); applicantRequest?.abort(); });
</script>

<template>
  <section class="dashboard-card live-page">
    <div class="card-heading">
      <h1>{{ t('Job marketplace') }}</h1>
      <button class="text-action" type="button" :disabled="busy || loading" @click="load">{{ t('Refresh') }}</button>
    </div>
    <p v-if="admin" class="dialog-intro">{{ t('Open an unassigned report to publish a job. An offer becomes an assignment after the selected technician accepts.') }}</p>
    <p v-else class="dialog-intro">{{ t('Verified technicians can apply for eligible jobs. Report details become available after you accept an offer.') }}</p>
    <RouterLink class="text-action" :to="admin ? '/reports' : '/technician'">{{ t(admin ? 'All reports' : 'Return to workspace') }}</RouterLink>
    <p v-if="error" class="live-error" role="alert">{{ t(error) }}</p>
    <LoadingStatus v-if="loading" :label="t('Loading marketplace…')" />
    <p v-else-if="!listings.length && !error" class="live-empty">{{ t(admin ? 'No marketplace listings for your site.' : 'No eligible jobs or applications. Check your verification and technician terms in your workspace.') }}</p>

    <article v-for="listing in listings" :key="listing.id" class="detail-section">
      <div class="card-heading"><h2>{{ listing.summary }}</h2><span class="status-badge">{{ t(humanize(listing.status)) }}</span></div>
      <dl class="report-detail-grid">
        <div><dt>{{ t('Broad location') }}</dt><dd>{{ listing.broadLocation }}</dd></div>
        <div><dt>{{ t('Expected timing') }}</dt><dd>{{ listing.timing }}</dd></div>
        <div><dt>{{ t('Category') }}</dt><dd>{{ t(humanize(listing.category)) }}</dd></div>
        <div v-if="listing.specialty"><dt>{{ t('Specialty') }}</dt><dd>{{ t(humanize(listing.specialty)) }}</dd></div>
        <div v-if="listing.urgency"><dt>{{ t('Urgency') }}</dt><dd>{{ t(urgencyLabels[listing.urgency]) }}</dd></div>
        <div><dt>{{ t('Listing expires') }}</dt><dd>{{ formatDate(listing.expiresAt, true) }}</dd></div>
      </dl>
      <RouterLink v-if="listing.reportId && (admin || listing.myApplication?.status === 'accepted')" class="text-action" :to="`/reports/${listing.reportId}`">{{ t('Open report') }}</RouterLink>

      <template v-if="admin">
        <div class="marketplace-actions">
          <button class="text-action" type="button" :disabled="busy || loadingApplicants" @click="openApplicants(listing.id)">{{ t('Review applicants') }}</button>
          <button v-if="['open', 'offered'].includes(listing.status)" class="text-action" type="button" :disabled="busy || loading" @click="save(() => closeMarketplaceJob(listing.id), listing.id)">{{ t('Close listing') }}</button>
        </div>
        <details v-if="listing.canCancelAssignment">
          <summary>{{ t('Cancel marketplace assignment') }}</summary>
          <p class="dialog-intro">{{ t('Cancellation revokes the technician’s assignment and closes the listing. You can publish the report again after cancellation.') }}</p>
          <form class="draft-form" @submit.prevent="cancel(listing)">
            <fieldset class="report-fields" :disabled="busy || loading">
              <label>{{ t('Reason for cancellation') }}<textarea v-model="notes[listing.id]" required maxlength="2000" rows="3" /></label>
              <button class="report-issue-button" type="submit" :disabled="!notes[listing.id]?.trim()">{{ t('Cancel marketplace assignment') }}</button>
            </fieldset>
          </form>
        </details>
        <template v-if="selectedListing === listing.id">
          <LoadingStatus v-if="loadingApplicants" :label="t('Loading applicants…')" />
          <p v-else-if="applicantError" class="live-error" role="alert">{{ t(applicantError) }}</p>
          <p v-else-if="!applicants.length">{{ t('No applications yet.') }}</p>
          <section v-for="applicant in applicants" :key="applicant.id" class="detail-section">
            <h3>{{ applicant.technicianName }} · {{ t(humanize(applicant.status)) }}</h3>
            <p class="marketplace-note">{{ applicant.note }}</p>
            <dl class="report-detail-grid">
              <div><dt>{{ t('Active cases') }}</dt><dd>{{ applicant.activeCases ?? t('Not available') }}</dd></div>
              <div><dt>{{ t('Completed jobs') }}</dt><dd>{{ applicant.completedJobs ?? t('Not available') }}</dd></div>
              <div v-if="applicant.cancellations != null"><dt>{{ t('Cancelled jobs') }}</dt><dd>{{ applicant.cancellations }}</dd></div>
              <div><dt>{{ t('Average rating') }}</dt><dd>{{ applicant.averageRating == null ? t('No ratings yet') : applicant.averageRating.toFixed(1) }}</dd></div>
              <div v-if="applicant.reviewedTrades"><dt>{{ t('Reviewed trades') }}</dt><dd class="marketplace-note">{{ applicant.reviewedTrades }}</dd></div>
              <div v-if="applicant.reviewedQualifications"><dt>{{ t('Reviewed qualifications') }}</dt><dd class="marketplace-note">{{ applicant.reviewedQualifications }}</dd></div>
            </dl>
            <p v-if="applicant.offerExpiresAt">{{ t('Offer expires {date}', { date: formatDate(applicant.offerExpiresAt, true) }) }}</p>
            <div v-if="listing.status === 'open' && applicant.status === 'pending'" class="marketplace-actions">
              <label><input v-model="safetyConfirmed[applicant.id]" type="checkbox" :disabled="busy" /> {{ t('I checked the qualifications for this job and approved the required site access.') }}</label>
              <button class="report-issue-button" type="button" :disabled="busy || loading || !safetyConfirmed[applicant.id]" @click="act(listing.id, applicant.id, 'select')">{{ t('Send offer') }}</button>
            </div>
          </section>
        </template>
      </template>
      <template v-else-if="listing.myApplication">
        <p>{{ t('Application status') }}: {{ t(humanize(listing.myApplication.status)) }}</p>
        <p v-if="listing.myApplication.offerExpiresAt">{{ t('Offer expires {date}', { date: formatDate(listing.myApplication.offerExpiresAt, true) }) }}</p>
        <div class="marketplace-actions">
          <template v-if="listing.myApplication.status === 'offered'">
            <button class="report-issue-button" type="button" :disabled="busy || loading" @click="act(listing.id, listing.myApplication.id, 'accept')">{{ t('Accept offer') }}</button>
            <button class="text-action" type="button" :disabled="busy || loading" @click="act(listing.id, listing.myApplication.id, 'decline')">{{ t('Decline offer') }}</button>
          </template>
          <button v-else-if="listing.myApplication.status === 'pending'" class="text-action" type="button" :disabled="busy || loading" @click="act(listing.id, listing.myApplication.id, 'withdraw')">{{ t('Withdraw application') }}</button>
        </div>
      </template>
      <form v-else-if="listing.status === 'open'" class="draft-form" @submit.prevent="apply(listing)">
        <fieldset class="report-fields" :disabled="busy || loading">
          <label>{{ t('Why are you suited to this job?') }}<textarea v-model="notes[listing.id]" required maxlength="1000" rows="3" /></label>
          <button class="report-issue-button" type="submit" :disabled="!notes[listing.id]?.trim()">{{ t('Apply for job') }}</button>
        </fieldset>
      </form>
    </article>
  </section>
</template>

<style scoped>
.marketplace-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .75rem; margin-block: .75rem; }
.marketplace-note { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
