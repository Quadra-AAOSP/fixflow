<script setup lang="ts">
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { useLocale } from '@/i18n';
import { listSiteRules, saveSiteRule, deleteSiteRule, type RuleDraft } from '@/services/siteRules';
import { errorMessage } from '@/services/api';
import { humanize } from '@/utils/maintenance';
import type { SiteRule, SiteType } from '@/types/maintenance';
const { user } = useAuth(); const { t } = useLocale(); const data = useMaintenanceStore();
const allowed = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin');
const rules = ref<SiteRule[] | null>(null); const busy = ref(false); const loading = ref(false);
const error = ref(''); const message = ref(''); const editing = ref(false); const id = ref<number | null>(null);
const removing = ref<SiteRule | null>(null); const filter = ref<SiteType | ''>('');
const editor = ref<HTMLFormElement>(); const confirmation = ref<HTMLElement>();
const draft = ref<RuleDraft>({ siteType: 'school', category: '', urgencyWeight: 0, sortOrder: 0 });
const currentType = computed(() => data.selectedSite?.type);
const visible = computed(() => (rules.value ?? []).filter(rule => currentType.value && rule.siteType === currentType.value));
watch(currentType, () => { editing.value = false; removing.value = null; message.value = ''; });
let generation = 0; onBeforeUnmount(() => generation++);
async function load() {
  if (!allowed.value || busy.value) return;
  const current = ++generation; loading.value = true; error.value = ''; rules.value = null;
  try { const result = await listSiteRules(); if (current === generation) rules.value = result; }
  catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) loading.value = false; }
}
async function edit(rule?: SiteRule) {
  if (busy.value || loading.value || !currentType.value) return;
  id.value = rule?.id ?? null; removing.value = null; message.value = ''; error.value = '';
  draft.value = rule ? { siteType: rule.siteType, category: rule.category, urgencyWeight: rule.urgencyWeight ?? 0, sortOrder: rule.sortOrder ?? 0 } :
    { siteType: filter.value || data.selectedSite?.type || 'school', category: '', urgencyWeight: 0, sortOrder: 0 };
  editing.value = true; await nextTick(); editor.value?.querySelector('input')?.focus();
}
async function save() {
  if (!allowed.value || busy.value || draft.value.siteType !== currentType.value) return;
  const current = ++generation; busy.value = true; error.value = ''; message.value = '';
  try {
    const saved = await saveSiteRule(id.value, draft.value);
    if (current !== generation) return;
    rules.value = [...(rules.value ?? []).filter(rule => rule.id !== saved.id), saved];
    editing.value = false; message.value = 'Rule saved. Reporting categories will refresh.';
    void data.refresh();
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) busy.value = false; }
}
async function askRemove(rule: SiteRule) {
  if (busy.value) return;
  removing.value = rule; editing.value = false; await nextTick(); confirmation.value?.focus();
}
async function remove() {
  if (!allowed.value || busy.value || !removing.value) return;
  const current = ++generation; const target = removing.value; busy.value = true; error.value = ''; message.value = '';
  try {
    await deleteSiteRule(target.id); if (current !== generation) return;
    rules.value = (rules.value ?? []).filter(rule => rule.id !== target.id); removing.value = null;
    message.value = 'Rule deleted. Reporting categories will refresh.'; void data.refresh();
  } catch (err) { if (current === generation) error.value = errorMessage(err); }
  finally { if (current === generation) busy.value = false; }
}
onMounted(load);
</script>
<template>
  <section v-if="allowed" class="dashboard-card live-page">
    <div class="card-heading"><h1>{{ t('Site rules') }}</h1><button type="button" class="report-issue-button" :disabled="busy || loading || !currentType" @click="edit()">{{ t('Add category') }}</button></div>
    <p class="dialog-intro">{{ t('Showing categories for the current site. These rules are shared with other sites of the same type; edits affect those sites too.') }}</p>
    <p v-if="error" class="live-error" role="alert">{{ t(error) }} <button :disabled="busy || loading" type="button" @click="load">{{ t('Retry') }}</button></p>
    <p v-if="message" class="draft-notice" role="status">{{ t(message) }}</p>
    <form v-if="editing" ref="editor" class="draft-form" @submit.prevent="save"><h2>{{ t(id === null ? 'Add category' : 'Edit rule') }}</h2><fieldset class="report-fields" :disabled="busy">
      <label>{{ t('Site type') }}<select v-model="draft.siteType" disabled><option value="school">{{ t('School') }}</option><option value="hostel">{{ t('Hostel') }}</option><option value="hotel">{{ t('Hotel') }}</option></select></label>
      <label>{{ t('Category code') }}<input v-model="draft.category" required maxlength="128" /></label>
      <label>{{ t('Urgency weight') }}<input v-model.number="draft.urgencyWeight" required type="number" min="-2147483648" max="2147483647" step="1" /></label>
      <label>{{ t('Sort order') }}<input v-model.number="draft.sortOrder" required type="number" min="-2147483648" max="2147483647" step="1" /></label>
      <div class="rule-actions"><button type="submit" class="report-issue-button">{{ t(busy ? 'Saving…' : 'Save rule') }}</button><button type="button" class="text-action" @click="editing = false">{{ t('Cancel') }}</button></div>
    </fieldset></form>
    <section v-if="removing" ref="confirmation" tabindex="-1" class="draft-notice rule-confirmation" :aria-label="t('Delete rule confirmation')"><p>{{ t('Permanently delete category {category} for all {type} sites? This cannot be undone.', { category: removing.category, type: t(humanize(removing.siteType)) }) }}</p><div class="rule-actions"><button type="button" class="text-action" :disabled="busy" @click="remove">{{ t('Delete rule permanently') }}</button><button type="button" class="text-action" :disabled="busy" @click="removing = null">{{ t('Cancel') }}</button></div></section>
    <p class="rule-filter">{{ data.selectedSite?.name || t('Choose a site to view its rules.') }}<span v-if="currentType"> · {{ t(humanize(currentType)) }}</span></p>
    <LoadingStatus v-if="loading" :label="t('Loading rules…')" />
    <ul v-else-if="rules" class="rule-list"><li v-for="rule in visible" :key="rule.id"><div><strong>{{ rule.category }}</strong><p>{{ t(humanize(rule.siteType)) }} · {{ t('Urgency weight') }}: {{ rule.urgencyWeight ?? t('Not specified') }} · {{ t('Sort order') }}: {{ rule.sortOrder ?? t('Not specified') }}</p></div><div class="rule-actions"><button type="button" class="text-action" :disabled="busy" @click="edit(rule)">{{ t('Edit') }}</button><button type="button" class="text-action" :disabled="busy" @click="askRemove(rule)">{{ t('Delete') }}</button></div></li><li v-if="!visible.length">{{ t('No rules for this site type.') }}</li></ul>
  </section>
</template>
<style scoped>
.rule-confirmation{display:block;line-height:1.8}.rule-confirmation .rule-actions{margin-top:12px}
.rule-actions{display:flex;gap:18px;align-items:center;flex-wrap:wrap}.rule-filter{display:flex;gap:12px;align-items:center;margin-top:24px;font-size:13px}.rule-filter select{color:var(--navy);background:#fff;padding:10px;border:1px solid #dbe5df;border-radius:8px}.rule-list{display:grid;gap:12px;margin-top:18px}.rule-list li{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;border:1px solid #dbe5df;padding:18px;border-radius:10px;overflow-wrap:anywhere}.rule-list p{font-size:12px;color:#52677b;margin-top:8px}
</style>
