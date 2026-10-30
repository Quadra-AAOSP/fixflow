<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { getTechnicianInvitations } from '@/services/technician';
import { errorMessage } from '@/services/api';
import { formatDate, humanize } from '@/utils/maintenance';
import type { TechnicianInvitationInbox } from '@/types/technician';

const { user } = useAuth();
const inbox = ref<TechnicianInvitationInbox | null>(null);
const loading = ref(false);
const error = ref('');
const requestedPage = ref(0);
let generation = 0;
onBeforeUnmount(() => { generation++; });
async function load(page = 0) {
  const current = ++generation;
  requestedPage.value = page;
  inbox.value = null; error.value = ''; loading.value = false;
  if (user.value?.role !== 'technician') return;
  loading.value = true;
  try { const result = await getTechnicianInvitations(page); if (current === generation) inbox.value = result; }
  catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) loading.value = false; }
}
watch(() => [user.value?.id, user.value?.role], () => load(), { immediate: true });
</script>

<template>
  <section v-if="user?.role === 'technician'" class="dashboard-card live-page">
    <div class="card-heading"><div><h1>Site invitations</h1><p>Invitations to discuss a site contract</p></div><button type="button" class="text-action" :disabled="loading" @click="load(inbox?.page ?? 0)">Refresh inbox</button></div>
    <p class="dialog-intro">These invitations do not assign work or create contracts. You can review the site’s message and choose whether to request a contract, or remain independent.</p>
    <p v-if="loading" role="status">Loading invitations…</p><p v-if="error" role="alert" class="live-error">{{ error }} <button type="button" @click="load(requestedPage)">Try again</button></p>
    <template v-if="inbox && !loading">
      <p v-if="!inbox.items.length" class="live-empty">No invitations on this page.</p>
      <ul class="invitation-list"><li v-for="item in inbox.items" :key="item.id" class="contract-choice"><h2>Site #{{ item.siteId }}</h2><p>{{ humanize(item.category) }}<template v-if="item.specialty"> · {{ humanize(item.specialty) }}</template></p><p>{{ item.reason }}</p><p class="dialog-intro">Received {{ formatDate(item.createdAt, true) }}</p><RouterLink class="text-action" :to="{ name: 'contracts', query: { siteId: item.siteId } }">Review a site contract request →</RouterLink></li></ul>
      <nav class="invitation-pagination" aria-label="Invitation pages"><button class="text-action" type="button" :disabled="inbox.page === 0" @click="load(inbox.page - 1)">Previous</button><span>Page {{ inbox.page + 1 }}</span><button class="text-action" type="button" :disabled="!inbox.hasNext" @click="load(inbox.page + 1)">Next</button></nav>
    </template>
  </section>
</template>

<style scoped>
.invitation-list{display:grid;gap:12px}.invitation-list p{white-space:pre-wrap;overflow-wrap:anywhere}.invitation-pagination{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:20px}
</style>
