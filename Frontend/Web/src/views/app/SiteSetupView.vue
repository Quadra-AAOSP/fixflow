<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import { getSite, getReportingSetup } from '@/services/siteDetails';
import { updateSite, uploadSiteDocument } from '@/services/maintenance';
import { errorMessage } from '@/services/api';
import type { Site, SitePayload } from '@/types/maintenance';
const { user, refreshUser } = useAuth();
const router = useRouter();
const id = computed(() => user.value?.siteOnboarding?.siteId);
const site = ref<Site | null>(null), ready = ref(false), busy = ref(false), error = ref('');
const steps = ['Buildings', 'Site details', 'Documents'];
const uploading = ref<'terms' | 'contract' | null>(null);
const stepIndex = computed(() => ['buildings', 'site', 'terms'].indexOf(step.value));
const step = ref<'buildings' | 'site' | 'terms'>('buildings');
const form = reactive({ name: '', type: 'school' as Site['type'], contractStatus: 'uncontracted' as Site['contractStatus'], address: '', description: '' });
async function load() {
 if (!id.value) { error.value = 'No setup site is assigned to this account.'; return; }
 busy.value = true; error.value = '';
 try { const [s, r] = await Promise.all([getSite(id.value), getReportingSetup(id.value)]); site.value = s; ready.value = r.activeSubsiteCount > 0; Object.assign(form, { name: s.name, type: s.type, contractStatus: s.contractStatus, address: s.address ?? '', description: s.description ?? '' }); step.value = !ready.value ? 'buildings' : s.termsDocumentPresent && s.contractTermsDocumentPresent ? 'terms' : 'site'; }
 catch(e) { error.value = errorMessage(e); } finally { busy.value = false; }
}
async function save() {
 if (!site.value || !id.value || busy.value || !ready.value) return;
 if (!form.name.trim() || !form.address.trim()) { error.value = 'Enter the site name and address.'; return; }
 busy.value = true; error.value = '';
 try { const payload: SitePayload = { ...site.value, ...form, name: form.name.trim(), address: form.address.trim() || null, description: form.description.trim() || null }; site.value = await updateSite(id.value, payload); step.value = 'terms'; }
 catch(e) { error.value = errorMessage(e); } finally { busy.value = false; }
}
async function upload(kind: 'terms' | 'contract', event: Event) {
 const input = event.target as HTMLInputElement;
 const file = input.files?.[0];
 if (!file || !id.value || busy.value) return;
 if (!file.size || file.size > 10 * 1024 * 1024 || !/\.(pdf|docx?|txt)$/i.test(file.name)) {
   error.value = file.size ? 'Choose a PDF, Word or text file up to 10 MiB.' : 'This file is empty. Save a copy with content and choose it again.';
   input.value = '';
   return;
 }
 uploading.value = kind;
 busy.value = true; error.value = '';
 try { site.value = await uploadSiteDocument(id.value, kind, file); }
 catch(e) { error.value = errorMessage(e); } finally { input.value = ''; uploading.value = null; busy.value = false; }
}
async function finish() {
 if (busy.value || !site.value?.termsDocumentPresent || !site.value.contractTermsDocumentPresent) return;
 busy.value = true; error.value = '';
 try { await refreshUser(); if (user.value?.siteOnboarding?.setupRequired) { error.value = 'Setup is not complete yet. Check the buildings and both documents.'; return; } await router.push('/'); }
 catch(e) { error.value = errorMessage(e); } finally { busy.value = false; }
}
onMounted(load);
</script>
<template>
  <section class="site-setup">
    <header class="ff-page-heading">
      <div>
        <h1>Set up your site</h1>
        <p v-if="site">{{ site.name }}</p>
      </div>
    </header>

    <p v-if="error" class="setup-error" role="alert">{{ error }}</p>
    <p v-if="busy && !site" role="status">Loading site setup…</p>
    <button v-if="error && !site" class="action-link" type="button" @click="load">Try again</button>

    <template v-if="site">
      <ol class="setup-progress" aria-label="Site setup progress">
        <li v-for="(label, index) in steps" :key="label" :aria-current="stepIndex === index ? 'step' : undefined">
          <span class="step-number" aria-hidden="true">{{ index + 1 }}</span>
          <span>{{ label }}</span>
        </li>
      </ol>

      <section v-if="step === 'buildings'" class="setup-panel">
        <h2>Buildings and locations</h2>
        <p>Add at least one labeled building so reporters can tell you where an issue is.</p>
        <div class="action-row">
          <RouterLink class="action-link" :to="`/sites/${id}/subsites`">Manage buildings</RouterLink>
          <button class="setup-primary" type="button" :disabled="!ready || busy" @click="step = 'site'">Continue to site details</button>
        </div>
      </section>

      <form v-else-if="step === 'site'" class="setup-panel setup-fields" @submit.prevent="save">
        <h2>Site details</h2>
        <p>Confirm the site name, address and technician pool before uploading your documents.</p>
        <label>Site name<input v-model="form.name" required></label>
        <label>Site type<select v-model="form.type"><option value="school">School</option><option value="hostel">Hostel</option><option value="hotel">Hotel</option></select></label>
        <label>Technician pool<select v-model="form.contractStatus"><option value="contracted">Site-contracted technicians</option><option value="uncontracted">Open technician pool</option></select></label>
        <label>Address<input v-model.trim="form.address" required></label>
        <label>Description (optional)<textarea v-model="form.description" rows="3" /></label>
        <div class="action-row">
          <button class="action-link" type="button" :disabled="busy" @click="step = 'buildings'">Back</button>
          <button class="setup-primary" :disabled="busy">{{ busy ? 'Saving…' : 'Save and continue' }}</button>
        </div>
      </form>

      <section v-else class="setup-panel">
        <h2>Terms and contract</h2>
        <p>Upload both documents to finish. Use PDF, Word or text files up to 10 MiB each.</p>
        <div class="document-field">
          <p class="document-title">Site terms file</p>
          <input id="setup-terms" class="sr-only peer" type="file" accept=".pdf,.doc,.docx,.txt" :disabled="busy" @change="upload('terms', $event)">
          <label for="setup-terms" class="action-link document-picker peer-focus-visible:outline peer-focus-visible:outline-2" :class="{ 'picker-disabled': busy }">
            {{ site.termsDocumentPresent ? 'Replace site terms file' : 'Choose site terms file' }}
          </label>
          <p role="status">{{ uploading === 'terms' ? 'Uploading site terms…' : site.termsDocumentPresent ? 'Uploaded: ' + (site.termsDocumentName || 'Site terms') : 'No terms file uploaded' }}</p>
        </div>
        <div class="document-field">
          <p class="document-title">Site contract file</p>
          <input id="setup-contract" class="sr-only peer" type="file" accept=".pdf,.doc,.docx,.txt" :disabled="busy" @change="upload('contract', $event)">
          <label for="setup-contract" class="action-link document-picker peer-focus-visible:outline peer-focus-visible:outline-2" :class="{ 'picker-disabled': busy }">
            {{ site.contractTermsDocumentPresent ? 'Replace site contract file' : 'Choose site contract file' }}
          </label>
          <p role="status">{{ uploading === 'contract' ? 'Uploading site contract…' : site.contractTermsDocumentPresent ? 'Uploaded: ' + (site.contractTermsDocumentName || 'Site contract') : 'No contract file uploaded' }}</p>
        </div>
        <div class="action-row">
          <button class="action-link" type="button" :disabled="busy" @click="step = 'site'">Back</button>
          <button class="setup-primary" type="button" :disabled="busy || !site.termsDocumentPresent || !site.contractTermsDocumentPresent" @click="finish">Finish setup</button>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.site-setup { max-width: 48rem; color: var(--product-ink); }
.ff-page-heading { margin-bottom: 20px; }
.setup-progress { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 20px; }
.setup-progress li { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 2px solid var(--product-border); font-weight: 600; }
.setup-progress [aria-current=step] { border-color: var(--setup-accent, #006f65); }
.step-number { display: grid; place-items: center; flex: none; width: 26px; height: 26px; border-radius: 50%; background: var(--product-surface); border: 1px solid var(--product-border); }
.setup-panel { display: grid; gap: 16px; background: var(--product-surface); border: 1px solid var(--product-border); border-radius: 14px; padding: clamp(16px, 4vw, 28px); }
.setup-panel h2 { font-size: 1.375rem; font-weight: 750; }
.setup-panel p { line-height: 1.55; color: var(--product-muted); }
.setup-fields label, .document-field { display: grid; gap: 6px; font-weight: 650; min-width: 0; }
.setup-fields :is(input, select, textarea) { min-height: 44px; padding: 8px 12px; border: 1px solid var(--product-border); border-radius: 8px; background: var(--product-paper); font-weight: 400; }
.document-field { border-top: 1px solid var(--product-border); padding-top: 16px; }
.document-picker { justify-self: start; cursor: pointer; }
.picker-disabled { opacity: .6; cursor: not-allowed; }
.document-field p { overflow-wrap: anywhere; font-weight: 400; }
.setup-primary { min-height: 44px; border-radius: 8px; padding: 8px 16px; font-weight: 750; background: #00665c; color: white; }
.setup-primary:disabled { opacity: .6; }
.setup-error { margin-bottom: 16px; padding: 12px 16px; border: 1px solid #c86b78; border-radius: 8px; color: var(--product-ink); }
@media (max-width: 420px) { .setup-progress li { flex-direction: column; align-items: flex-start; } }
</style>
