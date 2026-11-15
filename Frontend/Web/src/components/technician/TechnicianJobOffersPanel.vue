<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { useLocale } from '@/i18n';
import { onMounted, ref } from 'vue';
import {
  acceptJobOffer,
  counterJobOffer,
  listMyJobOffers,
  rejectJobOffer,
  type JobOffer,
} from '@/services/jobOffers';
import { errorMessage } from '@/services/api';
import { humanize } from '@/utils/maintenance';

const { t } = useLocale();
const emit = defineEmits<{ changed: [] }>();
const offers = ref<JobOffer[] | null>(null);
const error = ref('');
const busyId = ref<number | null>(null);
const counterDrafts = ref<Record<number, string>>({});

function money(amountMinor: number, currency: string) {
  return (amountMinor / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  });
}

async function load() {
  error.value = '';
  try {
    offers.value = await listMyJobOffers();
  } catch (err) {
    offers.value = [];
    error.value = errorMessage(err);
  }
}

async function run(offer: JobOffer, operation: () => Promise<unknown>) {
  if (busyId.value != null) return;
  busyId.value = offer.id;
  error.value = '';
  try {
    await operation();
    await load();
    emit('changed');
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busyId.value = null;
  }
}

function counterMinor(offerId: number) {
  const parsed = Number(counterDrafts.value[offerId] ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

onMounted(() => { void load(); });
</script>

<template>
  <section class="detail-section job-offers-panel">
    <div class="card-heading">
      <h2>{{ t('Paid job offers') }}</h2>
      <button type="button" class="text-action" :disabled="busyId != null" @click="load">
        {{ t('Refresh offers') }}
      </button>
    </div>
    <p class="dialog-intro">{{
      t('Contracted paid offers appear here. Accept one to activate the assignment on that report.')
    }}</p>
    <p v-if="error" class="live-error" role="alert">{{ t(error) }}</p>
    <LoadingStatus v-if="offers == null" :label="t('Loading job offers…')" />
    <p v-else-if="!offers.length">{{ t('No paid job offers yet.') }}</p>
    <ul v-else class="offer-list">
      <li v-for="offer in offers" :key="offer.id" class="offer-card">
        <RouterLink class="text-action" :to="`/reports/${offer.reportId}`">
          {{ t('Report #{id}', { id: offer.reportId }) }}
        </RouterLink>
        <p>{{ t('Status: {status}', { status: t(humanize(offer.status)) }) }}</p>
        <p>{{ t('Offer: {amount}', { amount: money(offer.amountMinor, offer.currency) }) }}</p>
        <p v-if="offer.counterAmountMinor != null">{{
          t('Counter: {amount}', { amount: money(offer.counterAmountMinor, offer.currency) })
        }}</p>
        <p v-if="offer.note" class="offer-note">{{ offer.note }}</p>
        <div v-if="offer.status === 'pending' || offer.status === 'countered'" class="offer-actions">
          <button
            v-if="offer.status === 'pending'"
            type="button"
            class="report-issue-button"
            :disabled="busyId != null"
            @click="run(offer, () => acceptJobOffer(offer.reportId, offer.id))"
          >
            {{ t(busyId === offer.id ? 'Accepting…' : 'Accept offer') }}
          </button>
          <button
            type="button"
            class="text-action"
            :disabled="busyId != null"
            @click="run(offer, () => rejectJobOffer(offer.reportId, offer.id))"
          >
            {{ t('Decline offer') }}
          </button>
          <label v-if="offer.status === 'pending'">{{ t('Counter amount') }}
            <input
              v-model="counterDrafts[offer.id]"
              type="number"
              min="0.01"
              step="0.01"
              :disabled="busyId != null"
            />
          </label>
          <button
            v-if="offer.status === 'pending'"
            type="button"
            class="text-action"
            :disabled="busyId != null || counterMinor(offer.id) == null"
            @click="run(offer, () => counterJobOffer(offer.reportId, offer.id, counterMinor(offer.id)!))"
          >
            {{ t('Send counter') }}
          </button>
          <p v-if="offer.status === 'countered'" class="dialog-intro">{{
            t('Waiting for the site administrator to accept or reject your counter.')
          }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.job-offers-panel .card-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
.job-offers-panel h2{margin:0;font-size:18px;font-weight:700}
.offer-list{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:12px}
.offer-card{padding:14px;border:1px solid #dfe8e2;border-radius:12px;display:grid;gap:6px}
.offer-card p{margin:0;color:#52677b;line-height:1.5}
.offer-note{white-space:pre-wrap}
.offer-actions{display:grid;gap:10px;margin-top:8px;justify-items:start}
.offer-actions label{display:grid;gap:6px;font-weight:600;width:min(100%,220px)}
.offer-actions input{padding:10px 12px;border:1px solid #dbe5df;border-radius:8px}
</style>
