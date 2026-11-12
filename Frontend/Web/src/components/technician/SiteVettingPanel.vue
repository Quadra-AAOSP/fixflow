<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { request, errorMessage } from '@/services/api';
const props = defineProps<{ siteId: number; technicians: number[]; initialTechnicianId?: number }>();
type Review = { status: string; expiresAt: string | null };
const technicianId = ref<number | undefined>(props.initialTechnicianId);
const existing = ref<{review: Review | null; status: string} | null>(null);
const error = ref(''); const busy = ref(false);
const identity = ref(false); const references = ref(false); const qualifications = ref(false); const expiry = ref('');
const licence = ref(''); const licenceChecked = ref(false); const licenceExpiry = ref('');
const insurance = ref(''); const insuranceChecked = ref(false); const insuranceExpiry = ref('');
const { user } = useAuth();
let generation = 0;
watch(() => [props.siteId, technicianId.value, user.value?.id, user.value?.role], () => { generation++; existing.value=null; error.value=''; busy.value=false; identity.value=false; references.value=false; qualifications.value=false; expiry.value=''; licence.value=''; licenceChecked.value=false; licenceExpiry.value=''; insurance.value=''; insuranceChecked.value=false; insuranceExpiry.value=''; }, { flush: 'sync' });
onBeforeUnmount(() => { generation++; });
const path = () => `/api/sites/${props.siteId}/technicians/${technicianId.value}/vetting`;
async function load() { if (!technicianId.value || busy.value) return; const current=++generation; const target=path(); busy.value=true; error.value=''; existing.value=null; try { const result=await request<typeof existing.value>(target); if (current === generation) existing.value=result; } catch(e) { if (current === generation) error.value=errorMessage(e); } finally { if (current === generation) busy.value=false; } }
async function save(status: 'approved' | 'revoked') {
 if (!technicianId.value || busy.value) return;
 if (!licence.value || !insurance.value) { error.value='Select whether licence and insurance apply.'; return; }
 const future = (date: string) => date && new Date(date).getTime() > Date.now();
 if (status === 'approved' && (!identity.value || !references.value || !qualifications.value || !future(expiry.value) || (licence.value === 'yes' && (!licenceChecked.value || !future(licenceExpiry.value))) || (insurance.value === 'yes' && (!insuranceChecked.value || !future(insuranceExpiry.value))))) { error.value='Complete all required checks and provide future expiry dates.'; return; }
 const current=++generation; const target=path(); busy.value=true; error.value=''; try { await request(target, { method:'POST', body:JSON.stringify({ status, expiresAt: expiry.value ? new Date(expiry.value).toISOString() : null, identityChecked:identity.value, referencesChecked:references.value, qualificationsChecked:qualifications.value, licenceApplicable:licence.value === 'yes', licenceChecked:licenceChecked.value, licenceExpiresAt:licenceExpiry.value ? new Date(licenceExpiry.value).toISOString() : null, insuranceApplicable:insurance.value === 'yes', insuranceChecked:insuranceChecked.value, insuranceExpiresAt:insuranceExpiry.value ? new Date(insuranceExpiry.value).toISOString() : null }) }); if (current !== generation) return; const result=await request<typeof existing.value>(target); if (current === generation) existing.value=result; } catch(e) { if (current === generation) error.value=errorMessage(e); } finally { if (current === generation) busy.value=false; }
}
</script>
<template>
<section class="contract-choice">
<h2>Site technician vetting</h2><p>Site approval is required before work and is separate from platform verification, terms and contracts. Do not enter identity numbers or document links.</p>
<label>Technician <select v-model.number="technicianId" @change="existing=null"><option :value="undefined">Select a technician</option><option v-for="id in technicians" :key="id" :value="id">Technician #{{ id }}</option></select></label>
<button type="button" :disabled="busy || !technicianId" @click="load">{{ busy ? 'Loading…' : 'Load review' }}</button>
<p v-if="error" role="alert">{{ error }}</p>
<template v-if="existing"><p role="status">Site vetting: {{ existing.status }} <span v-if="existing.review?.expiresAt"> · expires {{ new Date(existing.review.expiresAt).toLocaleDateString() }}</span></p>
<p>Record a new review after completing the checks:</p>
<label><input v-model="identity" type="checkbox" /> Identity checked</label>
<label><input v-model="references" type="checkbox" /> Work history and references checked</label>
<label><input v-model="qualifications" type="checkbox" /> Qualifications checked</label>
<label>Review expires <input v-model="expiry" type="date" /></label>
<label>Licence applies <select v-model="licence"><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></label>
<template v-if="licence === 'yes'"><label><input v-model="licenceChecked" type="checkbox" /> Licence checked</label><label>Licence expires <input v-model="licenceExpiry" type="date" /></label></template>
<label>Insurance applies <select v-model="insurance"><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></label>
<template v-if="insurance === 'yes'"><label><input v-model="insuranceChecked" type="checkbox" /> Insurance checked</label><label>Insurance expires <input v-model="insuranceExpiry" type="date" /></label></template>
<button type="button" :disabled="busy" @click="save('approved')">Record approval</button>
<button type="button" :disabled="busy" @click="save('revoked')">Revoke approval</button>
</template></section>
</template>
<style scoped>
label{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:12px 0;font-size:13px}select,input[type=date]{min-height:40px;padding:8px 12px;border:1px solid #cbdad2;border-radius:7px;background:white;max-width:100%;min-width:0;font:inherit}button{min-height:40px;padding:9px 14px;margin:8px 8px 8px 0;border:1px solid #cbdad2;border-radius:7px;color:#006f65;font-weight:600;background:white}button:disabled{opacity:.5;cursor:not-allowed}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #006f65;outline-offset:3px}
</style>
