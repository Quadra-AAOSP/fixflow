<script setup lang="ts">
import { useLocale } from '@/i18n';
import { formatDate, humanize } from '@/utils/maintenance';
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { getSiteAdminApplication } from '@/services/auth';
import { errorMessage } from '@/services/api';
import type { SiteAdminApplication } from '@/types';
const { t } = useLocale();

const application = ref<SiteAdminApplication | null>(null);
const loading = ref(true);
const error = ref('');

async function refresh() {
  loading.value = true;
  error.value = '';
  try { application.value = await getSiteAdminApplication(); }
  catch (err) { error.value = errorMessage(err); }
  finally { loading.value = false; }
}

onMounted(refresh);
</script>

<template>
  <section class="page-content max-w-2xl">
    <span class="form-kicker">{{ t("SITE ADMINISTRATOR") }}</span>
    <h1 class="text-3xl font-bold">{{ t("Your application") }}</h1>
    <p class="text-slate-600">{{ t("A super administrator reviews requests for site management access.") }}</p>
    <p v-if="loading" role="status">{{ t("Checking your application…") }}</p>
    <p v-else-if="error" role="alert">{{ t(error) }}</p>
    <div v-else-if="application" class="managed-access-message mt-6">
      <h2>{{ t('Status: {status}', { status: t(humanize(application.status)) }) }}</h2>
      <p>{{ t('Site ID: {id}', { id: application.siteId }) }}</p>
      <p v-if="application.status === 'pending'">{{ t("Your account currently has reporter access. You can continue using FixFlow while your request is reviewed.") }}</p>
      <p v-else-if="application.status === 'approved'">{{ t("Your request was approved. Sign out and sign in again to refresh your site-admin access.") }}</p>
      <p v-else>{{ t("Your request was not approved. Contact the platform owner if you need details or would like to discuss access.") }}</p>
      <p>{{ t('Submitted {date}', { date: formatDate(application.createdAt, true) }) }}</p>
    </div>
    <p v-else>{{ t("No site-admin application is associated with this account.") }}</p>
    <button type="button" class="registration-link" :disabled="loading" @click="refresh">{{ t("Refresh status") }}</button>
    <RouterLink class="registration-link" to="/">{{ t("Go to your workspace →") }}</RouterLink>
  </section>
</template>
