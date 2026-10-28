<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { ArrowLeft, Building2, Plus, RefreshCw } from '@lucide/vue';
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { createSubsite, listSubsites } from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import type { Subsite } from '@/types/maintenance';

const route = useRoute();
const { user } = useAuth();
const data = useMaintenanceStore();
const siteId = computed(() => Number(route.params.siteId));
const site = computed(() => data.sites.find(item => item.id === siteId.value));
const canManage = computed(() => user.value?.role === 'super_admin' ||
  (user.value?.role === 'admin' && user.value.siteId === siteId.value));
const items = ref<Subsite[]>([]);
const loading = ref(false);
const saving = ref(false);
const loadError = ref('');
const formError = ref('');
const success = ref('');
const form = reactive({ label: '', name: '', description: '' });
let generation = 0;
onBeforeUnmount(() => { generation++; });

async function load() {
  const id = site.value?.id;
  const current = ++generation;
  items.value = []; loadError.value = '';
  if (!id) return;
  loading.value = true;
  try {
    const result = await listSubsites(id);
    if (current === generation) items.value = result;
  } catch (err) {
    if (current === generation) loadError.value = errorMessage(err);
  } finally {
    if (current === generation) loading.value = false;
  }
}

watch(() => site.value?.id, () => { void load(); }, { immediate: true });

async function submit() {
  if (!site.value || !canManage.value || saving.value) return;
  const id = site.value.id;
  formError.value = ''; success.value = '';
  saving.value = true;
  try {
    const created = await createSubsite(id, form);
    if (siteId.value !== id) return;
    items.value = [...items.value, created].sort((a, b) => a.label.localeCompare(b.label));
    success.value = `${created.label} · ${created.name} added to ${site.value?.name}.`;
    Object.assign(form, { label: '', name: '', description: '' });
  } catch (err) {
    formError.value = errorMessage(err);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="live-page subsite-page">
    <RouterLink to="/sites" class="text-action subsite-back"><ArrowLeft :size="16" /> All sites</RouterLink>
    <div class="card-heading"><div><h1>Buildings &amp; locations</h1><p v-if="site">{{ site.name }} · labelled places for maintenance reports</p></div><Building2 :size="30" /></div>
    <p v-if="!Number.isSafeInteger(siteId) || siteId <= 0" class="live-error" role="alert">This site link is invalid.</p>
    <p v-else-if="!site && data.loading" class="live-empty" role="status">Loading your sites…</p>
    <p v-else-if="!site" class="live-error" role="alert">This site is not available to your account. <RouterLink to="/sites">Choose an accessible site</RouterLink>.</p>
    <template v-else>
      <div class="subsite-grid">
        <section class="dashboard-card"><div class="card-heading"><div><h2>Saved buildings</h2><p>{{ items.length }} active {{ items.length === 1 ? 'location' : 'locations' }}</p></div><button class="icon-button" type="button" :disabled="loading" aria-label="Refresh buildings" @click="load"><RefreshCw :size="18" /></button></div>
          <p v-if="loadError" class="live-error" role="alert">{{ loadError }} <button type="button" @click="load">Try again</button></p>
          <p v-else-if="loading" class="live-empty" role="status">Loading buildings…</p>
          <p v-else-if="!items.length" class="live-empty">No buildings are configured yet. A site admin can add the first labelled location here.</p>
          <ul v-else class="subsite-list"><li v-for="item in items" :key="item.id"><span class="subsite-code">{{ item.label }}</span><div><strong>{{ item.name }}</strong><p v-if="item.description">{{ item.description }}</p></div></li></ul>
        </section>
        <section v-if="canManage" class="dashboard-card"><div class="card-heading"><div><h2>Add a building</h2><p>Give reporters a clear location to choose when filing an issue.</p></div><Plus :size="20" /></div>
          <p v-if="success" class="draft-notice" role="status">{{ success }}</p>
          <p v-if="formError" class="live-error" role="alert">{{ formError }}</p>
          <form class="draft-form" @submit.prevent="submit"><fieldset class="report-fields" :disabled="saving || loading"><label>Short label<input v-model="form.label" maxlength="64" placeholder="e.g. A" required /></label><label>Building or location name<input v-model="form.name" maxlength="255" placeholder="e.g. Main Building" required /></label><label>Description (optional)<textarea v-model="form.description" maxlength="2000" rows="3" placeholder="Floor, wing or wayfinding details" /></label><button class="report-issue-button" type="submit" :disabled="saving">{{ saving ? 'Adding…' : 'Add building' }}</button></fieldset></form>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.subsite-page{display:grid;gap:16px}.subsite-back{display:inline-flex;align-items:center;gap:8px;width:max-content}.subsite-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:18px}.subsite-list{display:grid;gap:10px}.subsite-list li{display:flex;align-items:flex-start;gap:15px;padding:15px;border:1px solid #e8eeea;border-radius:10px;background:#fff}.subsite-list strong{font-size:14px}.subsite-list p{margin-top:5px;color:#6e7e92;line-height:1.55}.subsite-code{min-width:56px;padding:7px 9px;border-radius:7px;background:#d9f5ed;color:#116f65;text-align:center;font-size:11px;font-weight:700;overflow-wrap:anywhere}@media(max-width:800px){.subsite-grid{grid-template-columns:1fr}}
</style>
