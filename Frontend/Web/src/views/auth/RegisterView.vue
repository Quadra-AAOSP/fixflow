<script setup lang="ts">
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

const router = useRouter();
const { login } = useAuth();
const selectedRole = ref<UserRole | null>(null);
const details = reactive({ firstName: '', lastName: '', email: '', password: '', siteId: '', phone: '' });
const error = ref('');
const submitting = ref(false);
const accountCreated = ref(false);
const isPublicRole = computed(() => selectedRole.value === 'reporter' || selectedRole.value === 'technician');
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
      await router.replace(payload.role === 'technician' ? '/technician' : '/');
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
    <template v-if="accountCreated"><h1 class="text-3xl font-bold">Your account is ready</h1><p role="status" class="registration-note">{{ error || 'You can now sign in.' }}</p><RouterLink to="/login" class="registration-link">Continue to sign in →</RouterLink></template>
    <template v-else>
      <span class="form-kicker">FIND YOUR PLACE IN FIXFLOW</span><h1 class="registration-title">Join your community<span>.</span></h1><p class="registration-note">Choose how you’ll help keep things working.</p>
      <div v-if="!selectedRole" class="role-options"><button class="role-option" @click="selectedRole = 'reporter'"><span class="role-option-icon"><ClipboardList :size="23" /></span><span><strong>I’m a reporter</strong><small>Report and track issues at your site.</small></span><span>→</span></button><button class="role-option" @click="selectedRole = 'technician'"><span class="role-option-icon technician"><Wrench :size="23" /></span><span><strong>I’m a technician</strong><small>Register independently. A site contract is optional.</small></span><span>→</span></button><div class="managed-role-links"><span><ShieldCheck :size="17" />Joining a management team?</span><button @click="selectedRole = 'admin'">Site administrator</button><button @click="selectedRole = 'staff'">Site staff</button><button @click="selectedRole = 'super_admin'">Super administrator</button></div></div>
      <template v-else><button class="registration-back" :disabled="submitting" @click="selectedRole = null"><ArrowLeft :size="14" />Change role</button><div class="chosen-role">{{ roleLabels[selectedRole] }}</div>
        <template v-if="isPublicRole"><p class="role-guidance">{{ selectedRole === 'technician' ? 'Start with no contracted sites. You can remain independent and arrange site contracts later.' : 'Your site administrator will provide the site ID to use when registering.' }}</p><form @submit.prevent="submit"><fieldset :disabled="submitting"><div class="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-3"><TextField v-model="details.firstName" label="First name" autocomplete="given-name" :maxlength="128" required /><TextField v-model="details.lastName" label="Last name" autocomplete="family-name" :maxlength="128" required /></div><TextField v-model="details.email" label="Email" type="email" autocomplete="email" required /><TextField v-model="details.password" label="Password" type="password" autocomplete="new-password" :minlength="PASSWORD_MIN_LENGTH" :maxlength="PASSWORD_MAX_LENGTH" required /><p class="field-hint">Use at least {{ PASSWORD_MIN_LENGTH }} characters. A long, unique passphrase works well.</p><template v-if="selectedRole === 'reporter'"><TextField v-model="details.siteId" label="Site ID" type="number" :min="1" :step="1" required /><p class="field-hint">Use the actual ID from your site administrator.</p></template><TextField v-model="details.phone" label="Phone (optional)" type="tel" autocomplete="tel" :maxlength="64" /><p v-if="error" role="alert" class="registration-error">{{ error }}</p><Button :label="selectedRole === 'technician' ? 'Create technician account →' : 'Create reporter account →'" type="submit" :loading="submitting" /></fieldset></form></template>
        <div v-else class="managed-access-message"><ShieldCheck :size="30" /><h2>{{ selectedRole === 'super_admin' ? 'Privileged access requires verification' : 'Your account is created by an administrator' }}</h2><p v-if="selectedRole === 'admin'">A super administrator must approve your appointment and create your account for a specific site. This role is not available through public signup.</p><p v-else-if="selectedRole === 'staff'">Your site administrator or a super administrator must create your staff account for your site.</p><p v-else>Super-administrator access is reserved for approved platform operators. Identity verification, independent approval, and MFA must be established before access is granted.</p><p v-if="selectedRole === 'super_admin'" class="field-hint">Online super-admin enrollment is unavailable until these checks can be verified securely.</p><RouterLink to="/access-policy" class="registration-link">View access requirements →</RouterLink></div>
      </template>
      <p class="registration-signin">Already have an account? <RouterLink to="/login">Sign in</RouterLink></p>
    </template>
  </div>
</template>
