<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ShieldCheck, UserPlus } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { provisionUser } from '@/services/access';
import { errorMessage } from '@/services/api';
import { buildProvisionPayload, type RegistrationInput } from '@/utils/registration';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, canProvision, roleLabels } from '@/constants/access';
import type { User } from '@/types';

const { user } = useAuth();
const data = useMaintenanceStore();
const form = reactive<RegistrationInput>({ firstName: '', lastName: '', email: '', password: '', phone: '', role: 'staff', siteId: '' });
const roles = computed(() => user.value?.role === 'super_admin' ? ['staff', 'admin'] as const : ['staff'] as const);
const busy = ref(false);
const error = ref('');
const created = ref<User | null>(null);
watch(() => data.selectedSiteId, id => { if (!busy.value) form.siteId = id == null ? '' : String(id); }, { immediate: true });
async function submit() {
  if (busy.value) return;
  error.value = ''; created.value = null;
  try {
    const payload = buildProvisionPayload(form, user.value?.role, data.sites.map(site => site.id));
    busy.value = true;
    created.value = await provisionUser(payload);
    form.password = ''; form.firstName = ''; form.lastName = ''; form.email = ''; form.phone = '';
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="dashboard-card live-page report-form-page"><div class="card-heading"><div><h1>Team access</h1><p>{{ user?.role === 'super_admin' ? 'Create site-administrator and staff accounts for approved team members.' : 'Create staff accounts for your site.' }}</p><p class="dialog-intro">Site administrators are appointed by a super administrator. Every account is tied to a specific site.</p></div><ShieldCheck :size="30" /></div>
    <p v-if="!canProvision(user?.role)" class="live-empty">Only site administrators and super administrators can create team accounts.</p><p v-else-if="data.loading" class="live-empty">Loading available sites…</p><p v-else-if="!data.sites.length" class="live-empty">An accessible site is required before a team account can be created.</p>
    <template v-else><div v-if="created" class="draft-notice" role="status">{{ roleLabels[created.role] }} account created for {{ created.firstName }} {{ created.lastName }} ({{ created.email }}), at {{ data.siteName(created.siteId) }}. This account can now sign in.</div><form class="draft-form" @submit.prevent="submit"><p v-if="error" class="live-error" role="alert">{{ error }}</p><fieldset class="report-fields" :disabled="busy"><div class="form-two-columns"><label>Role<select v-model="form.role" required><option v-for="role in roles" :key="role" :value="role">{{ roleLabels[role] }}</option></select></label><label>Site<select v-model="form.siteId" required><option disabled value="">Choose a site</option><option v-for="site in data.sites" :key="site.id" :value="String(site.id)">{{ site.name }}</option></select></label></div><div class="form-two-columns"><label>First name<input v-model="form.firstName" required maxlength="128" autocomplete="off" /></label><label>Last name<input v-model="form.lastName" required maxlength="128" autocomplete="off" /></label></div><label>Work email<input v-model="form.email" type="email" autocomplete="off" required /></label><label>Initial password<input v-model="form.password" type="password" autocomplete="new-password" :minlength="PASSWORD_MIN_LENGTH" :maxlength="PASSWORD_MAX_LENGTH" required /></label><p class="field-hint">Use a unique passphrase of at least {{ PASSWORD_MIN_LENGTH }} characters. This creates an account directly; email invitations and mandatory first-login password reset are not available yet.</p><label>Phone (optional)<input v-model="form.phone" type="tel" maxlength="64" /></label><button class="report-issue-button" :disabled="busy" type="submit"><UserPlus :size="18" />{{ busy ? 'Creating account…' : 'Create approved account' }}</button></fieldset></form></template>
    <section class="detail-section access-policy-summary"><h2>Super-admin access is separate</h2><p class="dialog-intro">This form cannot grant super-admin privileges. Organizational identity, independent approval, MFA, and audit controls must be verifiable before online elevation is enabled.</p><RouterLink to="/access-policy" class="text-action">View privileged-access criteria →</RouterLink></section>
  </section>
</template>
