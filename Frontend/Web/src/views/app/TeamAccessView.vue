<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ShieldCheck, UserPlus } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { provisionUser } from '@/services/access';
import { decideSiteAdminApplication, getPendingSiteAdminApplications } from '@/services/auth';
import { errorMessage } from '@/services/api';
import { buildProvisionPayload, type RegistrationInput } from '@/utils/registration';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, canProvision, roleLabels } from '@/constants/access';
import type { SiteAdminApplication, User } from '@/types';

const { user } = useAuth();
const data = useMaintenanceStore();
const form = reactive<RegistrationInput>({ firstName: '', lastName: '', email: '', password: '', phone: '', role: 'staff', siteId: '' });
const roles = computed(() => user.value?.role === 'super_admin' ? ['staff', 'admin'] as const : ['staff'] as const);
const busy = ref(false);
const error = ref('');
const created = ref<User | null>(null);
const applications = ref<SiteAdminApplication[]>([]);
const applicationsLoading = ref(false);
const applicationError = ref('');
const decidingId = ref<number | null>(null);

async function loadApplications() {
  if (user.value?.role !== 'super_admin') return;
  applicationsLoading.value = true;
  applicationError.value = '';
  try { applications.value = await getPendingSiteAdminApplications(); }
  catch (err) { applicationError.value = errorMessage(err); }
  finally { applicationsLoading.value = false; }
}

async function decide(id: number, decision: 'approve' | 'reject') {
  if (decidingId.value !== null) return;
  decidingId.value = id;
  applicationError.value = '';
  try {
    await decideSiteAdminApplication(id, decision);
    applications.value = applications.value.filter(item => item.id !== id);
  } catch (err) { applicationError.value = errorMessage(err); }
  finally { decidingId.value = null; }
}

onMounted(loadApplications);
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
    <section v-if="user?.role === 'super_admin'" class="detail-section access-policy-summary">
      <div class="card-heading"><h2>Site-admin applications</h2><button type="button" class="text-action" :disabled="applicationsLoading" @click="loadApplications">Refresh</button></div>
      <p class="dialog-intro">Review the applicant and site through your authorized records before granting site-wide access. Approval changes the account role.</p>
      <p v-if="applicationsLoading" role="status">Loading applications…</p>
      <p v-if="applicationError" class="live-error" role="alert">{{ applicationError }}</p>
      <p v-if="!applicationsLoading && !applications.length">No pending applications.</p>
      <ul v-else class="space-y-4">
        <li v-for="application in applications" :key="application.id" class="dashboard-card p-4">
          <strong>Applicant #{{ application.userId }}</strong>
          <p>Site: {{ data.siteName(application.siteId) }} (ID {{ application.siteId }})</p>
          <p>Applied {{ new Date(application.createdAt).toLocaleString() }}</p>
          <div class="flex gap-3 mt-3">
            <button type="button" class="report-issue-button" :disabled="decidingId !== null" @click="decide(application.id, 'approve')">Approve</button>
            <button type="button" class="text-action" :disabled="decidingId !== null" @click="decide(application.id, 'reject')">Reject</button>
          </div>
        </li>
      </ul>
    </section>
    <section class="detail-section access-policy-summary"><h2>Super-admin access is separate</h2><p class="dialog-intro">This form cannot grant super-admin privileges. Organizational identity, independent approval, MFA, and audit controls must be verifiable before online elevation is enabled.</p><RouterLink to="/access-policy" class="text-action">View privileged-access criteria →</RouterLink></section>
  </section>
</template>
