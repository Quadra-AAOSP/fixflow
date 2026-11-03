<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { Archive, ArrowLeft, Building2, Check, Pencil, Plus, RefreshCw } from '@lucide/vue';
import { useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { archiveSubsite, createSubsite, listPendingSubsiteRequests, listSubsites, resolveSubsiteRequest, updateSubsite } from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import type { Subsite, SubsiteAlert } from '@/types/maintenance';
const { t } = useLocale();

const route = useRoute();
const { user, refreshUser } = useAuth();
const data = useMaintenanceStore();
const siteId = computed(() => Number(route.params.siteId));
const site = computed(() => data.sites.find(item => item.id === siteId.value));
const canManage = computed(() => user.value?.role === 'super_admin' ||
  (user.value?.role === 'admin' && user.value.siteId === siteId.value));
const items = ref<Subsite[]>([]);
const requests = ref<SubsiteAlert[]>([]);
const loading = ref(false);
const saving = ref(false);
const actionId = ref('');
const editingId = ref<number | null>(null);
const loadError = ref('');
const requestsError = ref('');
const formError = ref('');
const success = ref<{ key: string; values: Record<string, string | number> } | null>(null);
const sessionRefreshNeeded = ref(false);
const labelInput = ref<HTMLInputElement>();
const savedNotice = ref<HTMLElement>();
let editTrigger: HTMLButtonElement | null = null;
const form = reactive({ label: '', name: '', description: '' });
let generation = 0;
onBeforeUnmount(() => { generation++; });

async function load() {
  const id = site.value?.id;
  const current = ++generation;
  items.value = []; requests.value = []; loadError.value = ''; requestsError.value = '';
  success.value = null; sessionRefreshNeeded.value = false;
  cancelEdit();
  if (!id) { loading.value = false; return; }
  loading.value = true;
  try {
    const result = await listSubsites(id);
    if (current === generation) items.value = result;
  } catch (err) {
    if (current === generation) loadError.value = errorMessage(err);
  }
  if (canManage.value && current === generation) {
    try {
      const result = await listPendingSubsiteRequests(id);
      if (current === generation) requests.value = result;
    }
    catch (err) { if (current === generation) requestsError.value = errorMessage(err); }
  }
  if (current === generation) loading.value = false;
}

watch(() => site.value?.id, () => { void load(); }, { immediate: true });

async function submit() {
  if (!site.value || !canManage.value || saving.value || actionId.value) return;
  const id = site.value.id;
  const current = generation;
  formError.value = ''; success.value = null; sessionRefreshNeeded.value = false;
  saving.value = true;
  try {
    const saved = editingId.value == null ? await createSubsite(id, form) : await updateSubsite(id, editingId.value, form);
    if (current !== generation || siteId.value !== id) return;
    items.value = [...items.value.filter(item => item.id !== saved.id), saved].sort((a, b) => a.label.localeCompare(b.label));
    success.value = { key: '{label} · {name} saved for {site}.', values: { label: saved.label, name: saved.name, site: site.value?.name ?? '' } };
    cancelEdit();
    await nextTick();
    if (current === generation && siteId.value === id) savedNotice.value?.focus();
    if (user.value?.siteOnboarding?.siteId === id) {
      try { await refreshUser(); }
      catch { if (current === generation) sessionRefreshNeeded.value = true; }
    }
  } catch (err) {
    if (current === generation && siteId.value === id) formError.value = errorMessage(err);
  } finally {
    saving.value = false;
  }
}
async function edit(item: Subsite, event: MouseEvent) {
  if (!canManage.value || saving.value || actionId.value || loading.value) return;
  const current = generation;
  editTrigger = event.currentTarget as HTMLButtonElement;
  editingId.value = item.id;
  formError.value = ''; success.value = null; sessionRefreshNeeded.value = false;
  Object.assign(form, { label: item.label, name: item.name, description: item.description ?? '' });
  await nextTick();
  if (current === generation && editingId.value === item.id) labelInput.value?.focus();
}
async function cancelAndReturn() {
  const trigger = editTrigger;
  const current = generation;
  cancelEdit();
  await nextTick();
  if (current === generation && trigger?.isConnected) trigger.focus();
}
function cancelEdit() {
  editingId.value = null;
  editTrigger = null;
  Object.assign(form, { label: '', name: '', description: '' });
}
async function archive(item: Subsite) {
  if (!site.value || !canManage.value || saving.value || actionId.value) return;
  const id = site.value.id;
  const current = generation;
  actionId.value = `archive-${item.id}`; loadError.value = ''; success.value = null; sessionRefreshNeeded.value = false;
  try {
    await archiveSubsite(id, item.id);
    if (current !== generation || siteId.value !== id) return;
    items.value = items.value.filter(row => row.id !== item.id);
    if (editingId.value === item.id) cancelEdit();
    success.value = { key: '{label} archived. Existing reports keep their location history.', values: { label: item.label } };
    if (user.value?.siteOnboarding?.siteId === id) {
      try { await refreshUser(); }
      catch { if (current === generation) sessionRefreshNeeded.value = true; }
    }
  } catch (err) { if (current === generation && siteId.value === id) loadError.value = errorMessage(err); }
  finally { actionId.value = ''; }
}
async function resolve(item: SubsiteAlert) {
  if (!site.value || !canManage.value || saving.value || actionId.value) return;
  const id = site.value.id;
  const current = generation;
  actionId.value = `request-${item.id}`; requestsError.value = ''; success.value = null; sessionRefreshNeeded.value = false;
  try {
    await resolveSubsiteRequest(id, item.id);
    if (current !== generation || siteId.value !== id) return;
    requests.value = requests.value.filter(row => row.id !== item.id);
    success.value = { key: 'Request #{id} marked resolved.', values: { id: item.id } };
  } catch (err) { if (current === generation && siteId.value === id) requestsError.value = errorMessage(err); }
  finally { actionId.value = ''; }
}
</script>

<template>
  <section class="live-page subsite-page">
    <RouterLink to="/sites" class="text-action subsite-back"><ArrowLeft :size="16" /> {{ t("All sites") }}</RouterLink>
    <div class="card-heading"><div><h1>{{ t("Buildings & locations") }}</h1><p v-if="site">{{ t('{site} · labelled places for maintenance reports', { site: site.name }) }}</p></div><Building2 :size="30" /></div>
    <p v-if="!Number.isSafeInteger(siteId) || siteId <= 0" class="live-error" role="alert">{{ t("This site link is invalid.") }}</p>
    <p v-else-if="!site && data.loading" class="live-empty" role="status">{{ t("Loading your sites…") }}</p>
    <p v-else-if="!site" class="live-error" role="alert">{{ t("This site is not available to your account.") }} <RouterLink to="/sites">{{ t("Choose an accessible site") }}</RouterLink>.</p>
    <template v-else>
      <p v-if="success" ref="savedNotice" class="draft-notice" role="status" tabindex="-1">{{ t(success.key, success.values) }} <span v-if="sessionRefreshNeeded">{{ t('Refresh your session to update the site setup prompt.') }}</span></p>
      <div class="subsite-grid">
        <section class="dashboard-card"><div class="card-heading"><div><h2>{{ t("Saved buildings") }}</h2><p v-if="!loading && !loadError">{{ t(items.length === 1 ? '{count} active location' : '{count} active locations', { count: items.length }) }}</p></div><button class="icon-button" type="button" :disabled="loading || saving || !!actionId" :aria-label="t('Refresh buildings')" @click="load"><RefreshCw :size="18" /></button></div>
          <p v-if="loadError" class="live-error" role="alert">{{ t(loadError) }} <button type="button" @click="load">{{ t("Try again") }}</button></p>
          <p v-else-if="loading" class="live-empty" role="status">{{ t("Loading buildings…") }}</p>
          <p v-else-if="!items.length" class="live-empty">{{ t("No buildings are configured yet. A site admin can add the first labelled location here.") }}</p>
          <ul v-else class="subsite-list"><li v-for="item in items" :key="item.id"><span class="subsite-code">{{ item.label }}</span><div class="subsite-row-copy"><strong>{{ item.name }}</strong><p v-if="item.description">{{ item.description }}</p></div><div v-if="canManage" class="subsite-row-actions"><button class="text-action" type="button" :disabled="saving || !!actionId" :aria-label="t('Edit {name}', { name: item.name })" @click="edit(item, $event)"><Pencil :size="15" />{{ t("Edit") }}</button><button class="text-action" type="button" :disabled="saving || !!actionId" :aria-label="t('Archive {name}', { name: item.name })" @click="archive(item)"><Archive :size="15" />{{ t(actionId === `archive-${item.id}` ? 'Archiving…' : 'Archive') }}</button></div></li></ul>
        </section>
        <section v-if="canManage" class="dashboard-card"><div class="card-heading"><div><h2>{{ t(editingId == null ? 'Add a building' : 'Edit building') }}</h2><p>{{ t("Give reporters a clear location to choose when filing an issue.") }}</p></div><Plus :size="20" /></div>
          <p v-if="formError" class="live-error" role="alert">{{ t(formError) }}</p>
          <form class="draft-form" @submit.prevent="submit"><fieldset class="report-fields" :disabled="saving || loading || !!actionId"><label>{{ t("Short label") }}<input ref="labelInput" v-model="form.label" maxlength="64" :placeholder="t('e.g. A')" required /></label><label>{{ t("Building or location name") }}<input v-model="form.name" maxlength="255" :placeholder="t('e.g. Main Building')" required /></label><label>{{ t("Description (optional)") }}<textarea v-model="form.description" maxlength="2000" rows="3" :placeholder="t('Floor, wing or wayfinding details')" /></label><div class="subsite-form-actions"><button class="report-issue-button" type="submit" :disabled="saving">{{ t(saving ? 'Saving…' : editingId == null ? 'Add building' : 'Save changes') }}</button><button v-if="editingId != null" class="text-action" type="button" @click="cancelAndReturn">{{ t("Cancel editing") }}</button></div></fieldset></form>
        </section>
        <section v-if="canManage" class="dashboard-card subsite-requests"><div class="card-heading"><div><h2>{{ t("Missing-building requests") }}</h2><p>{{ t("Review the location, add it above if needed, then mark the request resolved.") }}</p></div><span v-if="!loading && !requestsError" class="status-badge mint">{{ t('{count} pending', { count: requests.length }) }}</span></div>
          <p v-if="requestsError" class="live-error" role="alert">{{ t(requestsError) }} <button type="button" @click="load">{{ t("Try again") }}</button></p>
          <p v-else-if="loading" class="live-empty" role="status">{{ t("Loading requests…") }}</p>
          <p v-else-if="!requests.length" class="live-empty">{{ t("No pending building requests.") }}</p>
          <ul v-else class="subsite-list"><li v-for="item in requests" :key="item.id"><span class="subsite-code">#{{ item.id }}</span><div class="subsite-row-copy"><strong>{{ t('Requested by account #{id}', { id: item.requestedByUserId }) }}</strong><p>{{ item.note || t('No description provided.') }}</p></div><button class="text-action" type="button" :disabled="saving || !!actionId" :aria-label="t('Resolve request {id}', { id: item.id })" @click="resolve(item)"><Check :size="15" />{{ t(actionId === `request-${item.id}` ? 'Resolving…' : 'Mark resolved') }}</button></li></ul>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.subsite-page{display:grid;gap:16px}.subsite-back{display:inline-flex;align-items:center;gap:8px;width:max-content}.subsite-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:18px}.subsite-requests{grid-column:1/-1}.subsite-list{display:grid;gap:10px}.subsite-list li{display:flex;align-items:flex-start;gap:15px;padding:15px;border:1px solid #e8eeea;border-radius:10px;background:#fff}.subsite-row-copy{flex:1;min-width:0}.subsite-list strong{font-size:14px}.subsite-list p{margin-top:5px;color:#6e7e92;line-height:1.55;overflow-wrap:anywhere}.subsite-code{min-width:56px;padding:7px 9px;border-radius:7px;background:#d9f5ed;color:#116f65;text-align:center;font-size:11px;font-weight:700;overflow-wrap:anywhere}.subsite-row-actions,.subsite-form-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.subsite-row-actions{margin-left:auto}.subsite-row-actions button,.subsite-requests button{display:inline-flex;align-items:center;gap:5px}@media(max-width:800px){.subsite-grid{grid-template-columns:1fr}.subsite-list li{flex-wrap:wrap}.subsite-row-actions{width:100%;margin-left:0}}
</style>
