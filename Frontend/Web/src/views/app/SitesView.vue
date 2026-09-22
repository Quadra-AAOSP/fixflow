<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { MapPin, Plus, X } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { createSite, updateSite } from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import { humanize } from '@/utils/maintenance';
import type { Site, SitePayload } from '@/types/maintenance';
const { user } = useAuth();
const data = useMaintenanceStore();
const router = useRouter();
const editor = ref<HTMLDialogElement>();
const editingId = ref<number | null>(null);
const busy = ref(false);
const error = ref('');
const form = reactive({ name: '', type: '' as Site['type'] | '', contractStatus: '' as Site['contractStatus'] | '', address: '', description: '', imageUrl: '' });
const canCreate = computed(() => user.value?.role === 'super_admin');
const canEdit = computed(() => canCreate.value || user.value?.role === 'admin');
async function viewReports(id: number) { await data.selectSite(id); await router.push('/reports'); }
const imageUrl = (value: string | null) => value && /^https?:\/\//i.test(value) ? value : undefined;
function edit(site?: Site) {
  editingId.value = site?.id ?? null; error.value = '';
  Object.assign(form, { name: site?.name ?? '', type: site?.type ?? '', contractStatus: site?.contractStatus ?? '', address: site?.address ?? '', description: site?.description ?? '', imageUrl: site?.imageUrl ?? '' });
  editor.value?.showModal();
}
async function save() {
  if (busy.value) return;
  error.value = '';
  if (!form.name.trim() || !form.type || !form.contractStatus) { error.value = 'Enter a name, site type, and contract status.'; return; }
  if (form.imageUrl && !imageUrl(form.imageUrl.trim())) { error.value = 'Use an HTTP or HTTPS image URL.'; return; }
  const payload: SitePayload = { name: form.name.trim(), type: form.type, contractStatus: form.contractStatus, address: form.address.trim() || null, description: form.description.trim() || null, imageUrl: form.imageUrl.trim() || null };
  busy.value = true;
  try {
    if (editingId.value != null) await updateSite(editingId.value, payload);
    else await createSite(payload);
    editor.value?.close(); await data.refresh();
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="live-page"><div class="card-heading"><div><h1>Your Sites</h1><p>Sites available to your account</p></div><button v-if="canCreate" class="report-issue-button" @click="edit()"><Plus :size="19" />Add site</button></div><div v-if="data.sites.length" class="site-grid"><article v-for="site in data.sites" :key="site.id" class="dashboard-card site-card"><img v-if="imageUrl(site.imageUrl)" :src="imageUrl(site.imageUrl)" :alt="site.name" loading="lazy" /><div v-else class="site-image-placeholder"><MapPin :size="35" /></div><div class="card-heading"><h2>{{ site.name }}</h2><span class="status-badge mint">{{ humanize(site.type) }}</span></div><p>{{ site.description || 'No description provided.' }}</p><p class="dialog-intro">{{ site.address || 'No address provided.' }}</p><p>Contract: {{ humanize(site.contractStatus) }} · Site ID: {{ site.id }}</p><div class="site-card-actions"><button class="text-action" :disabled="data.loading" @click="viewReports(site.id)">View reports →</button><button v-if="canEdit" class="text-action" @click="edit(site)">Edit site</button></div></article></div><p v-else-if="data.loading" class="live-empty">Loading sites…</p><p v-else-if="canCreate && !data.sitesError" class="live-empty">Add your first site to start collecting maintenance reports.</p></section>
  <dialog ref="editor" class="dashboard-dialog" aria-label="Site editor" @cancel="event => { if (busy) event.preventDefault(); }"><div class="dialog-heading"><h2>{{ editingId == null ? 'Add site' : 'Edit site' }}</h2><button :disabled="busy" class="icon-button" aria-label="Close site editor" @click="editor?.close()"><X :size="22" /></button></div><form class="draft-form" @submit.prevent="save"><p v-if="error" class="live-error" role="alert">{{ error }}</p><fieldset :disabled="busy" class="report-fields"><label>Site name<input v-model="form.name" maxlength="255" required /></label><div class="form-two-columns"><label>Site type<select v-model="form.type" required><option disabled value="">Choose a type</option><option value="school">School</option><option value="hostel">Hostel</option><option value="hotel">Hotel</option></select></label><label>Contract status<select v-model="form.contractStatus" required><option disabled value="">Choose a status</option><option value="contracted">Contracted</option><option value="uncontracted">Uncontracted</option></select></label></div><label>Address (optional)<input v-model="form.address" maxlength="512" /></label><label>Description (optional)<textarea v-model="form.description" rows="3" /></label><label>Image URL (optional)<input v-model="form.imageUrl" type="url" maxlength="1024" /></label><button class="report-issue-button" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Save site' }}</button></fieldset></form></dialog>
</template>
