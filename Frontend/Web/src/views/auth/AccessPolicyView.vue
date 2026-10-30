<script setup lang="ts">
import { useLocale } from '@/i18n';
import { ShieldCheck } from '@lucide/vue';
import { superAdminCriteria } from '@/constants/access';

const { t } = useLocale();
</script>
<template>
  <div class="registration-flow"><span class="form-kicker">{{ t("ACCESS THAT FITS YOUR RESPONSIBILITY") }}</span><h1 class="registration-title">{{ t("Trusted access") }}<span>.</span></h1><p class="registration-note">{{ t("Reporters and technicians can self-register. Site-admin applicants can register for one site and receive reporter access while a super administrator reviews the request. Site staff need an administrator to create their account.") }}</p><div class="managed-access-message"><ShieldCheck :size="28" /><h2>{{ t("Super-administrator requirements") }}</h2><p>{{ t("For FixFlow, we recommend the following privileged-access policy. These are approval requirements, not self-certification checkboxes.") }}</p></div><ol class="access-criteria"><li v-for="criterion in superAdminCriteria" :key="criterion.title"><strong>{{ t(criterion.title) }}</strong><p>{{ t(criterion.detail) }}</p></li></ol><p class="registration-note">{{ t("The current service cannot verify these requirements online. Super-admin self-registration and online elevation are unavailable. Contact your platform owner for approved access.") }}</p><p class="policy-sources">{{ t('Guidance:') }} <a href="https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html" target="_blank" rel="noopener noreferrer">{{ t("OWASP authorization") }}</a> · <a href="https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html" target="_blank" rel="noopener noreferrer">{{ t("Privileged-account MFA") }}</a></p><RouterLink class="registration-link" to="/register">{{ t("← Back to registration") }}</RouterLink><RouterLink class="registration-link" to="/">{{ t("Go to your workspace →") }}</RouterLink></div>
</template>
