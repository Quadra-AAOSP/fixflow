<script setup lang="ts">
import { useLocale } from '@/i18n';
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ClipboardList, Wrench, ShieldCheck, ArrowLeft } from '@lucide/vue';
import Button from '@/components/ui/Button.vue';
import TextField from '@/components/ui/TextField.vue';
import { useAuth } from '@/composables/useAuth';
import * as authApi from '@/services/auth';
import { errorMessage } from '@/services/api';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, roleLabels } from '@/constants/access';
import { buildRegistrationPayload, type RegistrationInput } from '@/utils/registration';
import type { UserRole } from '@/types';

const { t } = useLocale();

const router = useRouter();
const { login } = useAuth();
const selectedRole = ref<UserRole | null>(null);
const details = reactive({ firstName: '', lastName: '', email: '', password: '', siteId: '', phone: '', address: '' });
const error = ref('');
const submitting = ref(false);
const accountCreated = ref(false);
const isPublicRole = computed(() => selectedRole.value === 'reporter' || selectedRole.value === 'technician' || selectedRole.value === 'admin');
watch(selectedRole, () => { details.siteId = ''; error.value = ''; });
async function submit() {
  if (submitting.value || accountCreated.value || !selectedRole.value) return;
  error.value = '';
  try {
    const payload = buildRegistrationPayload({ ...details, role: selectedRole.value } as RegistrationInput);
    submitting.value = true;
    await authApi.register(payload);
    accountCreated.value = true;
    try {
      await login({ email: payload.email, password: payload.password });
      details.password = '';
      await router.replace(payload.role === 'technician' ? '/technician' : payload.role === 'admin' ? '/admin-application' : '/');
    } catch {
      details.password = '';
      error.value = 'Your account was created, but automatic sign-in did not finish. Sign in with your new account.';
    }
  } catch (err) { error.value = errorMessage(err); }
  finally { submitting.value = false; }
}
</script>

<template>
  <div class="registration-flow">
    <template v-if="accountCreated"><h1 class="text-3xl font-bold">{{ t("Your account is ready") }}</h1><p role="status" class="registration-note">{{ t(error || 'You can now sign in.') }}</p><RouterLink to="/login" class="registration-link">{{ t("Continue to sign in →") }}</RouterLink></template>
    <template v-else>
      <span class="form-kicker">{{ t("FIND YOUR PLACE IN FIXFLOW") }}</span><h1 class="registration-title">{{ t("Join your community") }}<span>.</span></h1><p class="registration-note">{{ t("Choose how you’ll help keep things working.") }}</p>
      <div v-if="!selectedRole" class="role-options"><button class="role-option" @click="selectedRole = 'reporter'"><span class="role-option-icon"><ClipboardList :size="23" /></span><span><strong>{{ t("I’m a reporter") }}</strong><small>{{ t("Report and track issues at your site.") }}</small></span><span>→</span></button><button class="role-option" @click="selectedRole = 'technician'"><span class="role-option-icon technician"><Wrench :size="23" /></span><span><strong>{{ t("I’m a technician") }}</strong><small>{{ t("Register independently. A site contract is optional.") }}</small></span><span>→</span></button><div class="managed-role-links"><span><ShieldCheck :size="17" />{{ t("Joining a management team?") }}</span><button @click="selectedRole = 'admin'">{{ t("Site administrator") }}</button><button @click="selectedRole = 'staff'">{{ t("Site staff") }}</button><button @click="selectedRole = 'super_admin'">{{ t("Super administrator") }}</button></div></div>
      <template v-else><button class="registration-back" :disabled="submitting" @click="selectedRole = null"><ArrowLeft :size="14" />{{ t("Change role") }}</button><div class="chosen-role">{{ t(roleLabels[selectedRole]) }}</div>
        <template v-if="isPublicRole"><p class="role-guidance">{{ t(selectedRole === 'technician' ? 'Start with no contracted sites. You can remain independent and arrange site contracts later.' : selectedRole === 'admin' ? 'Apply for one site. Your account starts with reporter access until a super administrator reviews your application.' : 'Your site administrator will provide the site ID to use when registering.') }}</p><form @submit.prevent="submit"><fieldset :disabled="submitting"><div class="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-3"><TextField v-model="details.firstName" :label="selectedRole === 'technician' ? 'Legal first name' : 'First name'" autocomplete="given-name" :maxlength="128" required /><TextField v-model="details.lastName" :label="selectedRole === 'technician' ? 'Legal last name' : 'Last name'" autocomplete="family-name" :maxlength="128" required /></div><TextField v-model="details.email" label="Email" type="email" autocomplete="email" required /><TextField v-model="details.password" label="Password" type="password" autocomplete="new-password" :minlength="PASSWORD_MIN_LENGTH" :maxlength="PASSWORD_MAX_LENGTH" required /><p class="field-hint">{{ t('Use at least {min} characters. A long, unique passphrase works well.', { min: PASSWORD_MIN_LENGTH }) }}</p><template v-if="selectedRole === 'reporter' || selectedRole === 'admin'"><TextField v-model="details.siteId" label="Site ID" type="number" :min="1" :step="1" required /><p class="field-hint">{{ t("Use the actual ID from your site administrator.") }}</p></template><TextField v-model="details.phone" :label="selectedRole === 'technician' ? 'Contact phone' : 'Phone (optional)'" :required="selectedRole === 'technician'" type="tel" autocomplete="tel" :maxlength="64" /><template v-if="selectedRole === 'technician'"><TextField v-model="details.address" label="Business or correspondence address" autocomplete="street-address" :maxlength="512" required /><p class="field-hint">{{ t("Next: add your trade and specialty. Registration creates an account; it does not verify your identity or qualifications.") }}</p><p class="field-hint">{{ t("Before site work, arrange qualification, applicable licence, insurance, and reference checks with the site administrator. Secure document submission is not available yet. Do not put identity numbers or document links in these fields.") }}</p></template><p v-if="error" role="alert"  class="registration-error">{{ t(error) }}</p><Button :label="selectedRole === 'technician' ? 'Create account & add trade →' : selectedRole === 'admin' ? 'Submit site-admin application →' : 'Create reporter account →'" type="submit" :loading="submitting" /></fieldset></form></template>
        <div v-else class="managed-access-message"><ShieldCheck :size="30" /><h2>{{ t(selectedRole === 'super_admin' ? 'Privileged access requires verification' : 'Your account is created by an administrator') }}</h2><p v-if="selectedRole === 'staff'">{{ t("Your site administrator or a super administrator must create your staff account for your site.") }}</p><p v-else>{{ t("Super-administrator access is reserved for approved platform operators. Identity verification, independent approval, and MFA must be established before access is granted.") }}</p><p v-if="selectedRole === 'super_admin'" class="field-hint">{{ t("Online super-admin enrollment is unavailable until these checks can be verified securely.") }}</p><RouterLink to="/access-policy" class="registration-link">{{ t("View access requirements →") }}</RouterLink></div>
      </template>
      <p class="registration-signin">{{ t("Already have an account?") }} <RouterLink to="/login">{{ t("Sign in") }}</RouterLink></p>
    </template>
  </div>
</template>
