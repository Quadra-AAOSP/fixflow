<script setup lang="ts">
import { useLocale } from '@/i18n';
import { useAccountPolicyStore } from '@/stores/accountPolicy';
import { formatDate } from '@/utils/maintenance';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { ShieldCheck, UserPlus } from '@lucide/vue';
import { useAuth } from '@/composables/useAuth';
import { useMaintenanceStore } from '@/stores/maintenance';
import { provisionUser } from '@/services/access';
import { decideSiteAdminApplication, getPendingSiteAdminApplications } from '@/services/auth';
import { errorMessage } from '@/services/api';
import { buildProvisionPayload, type RegistrationInput } from '@/utils/registration';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, canProvision, roleLabels } from '@/constants/access';
import type { SiteAdminApplication, User } from '@/types';
const { t } = useLocale();

const { user } = useAuth();
const data = useMaintenanceStore();
const accessPolicy = useAccountPolicyStore();
onMounted(() => accessPolicy.load());
const form = reactive<RegistrationInput>({ firstName: '', lastName: '', email: '', password: '', phone: '', role: 'staff', siteId: '' });
const roles = computed(() => (user.value?.capabilities?.provisionableRoles ??
  (user.value?.role === 'super_admin' ? ['staff', 'admin', 'shop_manager'] : ['staff']))
  .filter(role => role === 'staff' || role === 'admin' || role === 'shop_manager'));
const busy = ref(false);
const error = ref('');
const created = ref<User | null>(null);
const applications = ref<SiteAdminApplication[]>([]);
const applicationsLoading = ref(false);
const applicationError = ref('');
const decidingId = ref<number | null>(null);
let disposed = false;
onBeforeUnmount(() => { disposed = true; });

async function loadApplications() {
  if (user.value?.role !== 'super_admin' || applicationsLoading.value || decidingId.value !== null) return;
  applicationsLoading.value = true;
  applicationError.value = '';
  applications.value = [];
  try { const result = await getPendingSiteAdminApplications(); if (!disposed) applications.value = result; }
  catch (err) { if (!disposed) applicationError.value = errorMessage(err); }
  finally { if (!disposed) applicationsLoading.value = false; }
}

async function decide(id: number, decision: 'approve' | 'reject') {
  if (user.value?.role !== 'super_admin' || applicationsLoading.value || decidingId.value !== null || !applications.value.some(item => item.id === id)) return;
  decidingId.value = id;
  applicationError.value = '';
  try {
    await decideSiteAdminApplication(id, decision);
    if (!disposed) applications.value = applications.value.filter(item => item.id !== id);
  } catch (err) { if (!disposed) applicationError.value = errorMessage(err); }
  finally { if (!disposed) decidingId.value = null; }
}

onMounted(loadApplications);
watch(() => data.selectedSiteId, id => { if (!busy.value) form.siteId = id == null ? '' : String(id); }, { immediate: true });
async function submit() {
  if (busy.value || !accessPolicy.policy) return;
  error.value = ''; created.value = null;
  try {
    if (!roles.value.some(role => role === form.role)) throw new Error('Choose a role available to your account.');
    const payload = buildProvisionPayload(form, user.value?.role, data.sites.map(site => site.id), accessPolicy.policy.passwordMinLength);
    busy.value = true;
    created.value = await provisionUser(payload);
    form.password = ''; form.firstName = ''; form.lastName = ''; form.email = ''; form.phone = '';
  } catch (err) { error.value = errorMessage(err); }
  finally { busy.value = false; }
}
</script>
<template>
  <section class="dashboard-card live-page report-form-page"><div class="card-heading"><div><h1>{{ t("Team access") }}</h1><p>{{ t(user?.role === 'super_admin' ? 'Create approved site-administrator, staff, and shop-manager accounts.' : 'Create staff accounts for your site.') }}</p><p class="dialog-intro">{{ t("Site administrators are appointed by a super administrator. Staff and site-admin accounts belong to a site. Shop managers have no site assignment.") }}</p></div><ShieldCheck :size="30" /></div>
    <p v-if="!canProvision(user?.role)" class="live-empty">{{ t("Only site administrators and super administrators can create team accounts.") }}</p><p v-else-if="data.loading" class="live-empty">{{ t("Loading available sites…") }}</p>
    <p v-else-if="accessPolicy.loading" role="status">{{ t('Loading registration policy…') }}</p>
    <p v-else-if="accessPolicy.error" class="live-error" role="alert">{{ t(accessPolicy.error) }} <button type="button" @click="accessPolicy.load()">{{ t('Retry') }}</button></p>
    <template v-else-if="accessPolicy.policy"><div v-if="created" class="draft-notice" role="status">{{ t(created.role === 'shop_manager' ? '{role} account created for {name} ({email}) with platform shop access. This account can now sign in.' : '{role} account created for {name} ({email}) at {site}. This account can now sign in.', { role: t(roleLabels[created.role]), name: `${created.firstName} ${created.lastName}`, email: created.email, site: data.siteName(created.siteId) }) }}</div><form class="draft-form" @submit.prevent="submit"><p v-if="error" class="live-error" role="alert">{{ t(error) }}</p><fieldset class="report-fields" :disabled="busy"><div class="form-two-columns"><label>{{ t("Role") }}<select v-model="form.role" required><option v-for="role in roles" :key="role" :value="role">{{ t(roleLabels[role]) }}</option></select></label><label v-if="form.role !== 'shop_manager'">{{ t("Site") }}<select v-model="form.siteId" required><option disabled value="">{{ t("Choose a site") }}</option><option v-for="site in data.sites" :key="site.id" :value="String(site.id)">{{ site.name }}</option></select></label></div><div class="form-two-columns"><label>{{ t("First name") }}<input v-model="form.firstName" required maxlength="128" autocomplete="off" /></label><label>{{ t("Last name") }}<input v-model="form.lastName" required maxlength="128" autocomplete="off" /></label></div><label>{{ t("Work email") }}<input v-model="form.email" type="email" :maxlength="EMAIL_MAX_LENGTH" autocomplete="off" required /></label><label>{{ t("Initial password") }}<input v-model="form.password" type="password" autocomplete="new-password" :minlength="accessPolicy.policy.passwordMinLength" :maxlength="PASSWORD_MAX_LENGTH" required /></label><p class="field-hint">{{ t('Use a unique passphrase of at least {min} characters. This creates an account directly; email invitations and mandatory first-login password reset are not available yet.', { min: accessPolicy.policy.passwordMinLength }) }}</p><label>{{ t("Phone (optional)") }}<input v-model="form.phone" type="tel" maxlength="64" /></label><button class="report-issue-button" :disabled="busy" type="submit"><UserPlus :size="18" />{{ t(busy ? 'Creating account…' : 'Create approved account') }}</button></fieldset></form></template>
    <section v-if="user?.role === 'super_admin'" class="detail-section access-policy-summary">
      <div class="card-heading"><h2>{{ t("Site-admin applications") }}</h2><button type="button" class="text-action" :disabled="applicationsLoading || decidingId !== null" @click="loadApplications">{{ t("Refresh") }}</button></div>
      <p class="dialog-intro">{{ t("Review the applicant and site through your authorized records before granting site-wide access. Approval changes the account role.") }}</p>
      <p v-if="applicationsLoading" role="status">{{ t("Loading applications…") }}</p>
      <p v-if="applicationError" class="live-error" role="alert">{{ t(applicationError) }}</p>
      <p v-if="!applicationsLoading && !applicationError && !applications.length">{{ t("No pending applications.") }}</p>
      <ul v-if="!applicationsLoading && applications.length" class="space-y-4">
        <li v-for="application in applications" :key="application.id" class="dashboard-card p-4">
          <strong>{{ t('Applicant #{id}', { id: application.userId }) }}</strong>
          <p>{{ t('Site: {site} (ID {id})', { site: data.siteName(application.siteId), id: application.siteId }) }}</p>
          <p>{{ t('Applied {date}', { date: formatDate(application.createdAt, true) }) }}</p>
          <div class="flex gap-3 mt-3">
            <button type="button" class="report-issue-button" :disabled="applicationsLoading || decidingId !== null" @click="decide(application.id, 'approve')">{{ t("Approve") }}</button>
            <button type="button" class="text-action" :disabled="applicationsLoading || decidingId !== null" @click="decide(application.id, 'reject')">{{ t("Reject") }}</button>
          </div>
        </li>
      </ul>
    </section>
    <section class="detail-section access-policy-summary"><h2>{{ t("Super-admin access is separate") }}</h2><p class="dialog-intro">{{ t("This form cannot grant super-admin privileges. Organizational identity, independent approval, MFA, and audit controls must be verifiable before online elevation is enabled.") }}</p><RouterLink to="/access-policy" class="text-action">{{ t("View privileged-access criteria →") }}</RouterLink></section>
  </section>
</template>
