<script setup lang="ts">
import { useLocale } from '@/i18n';
import ContractApplicationsPanel from '@/components/technician/ContractApplicationsPanel.vue';
const { t } = useLocale();
</script>
<template>
  <section class="live-page">
    <div class="welcome-banner"><div><h1>{{ t('Find sites hiring') }}</h1><p>{{ t('Discover site opportunities and keep track of your contract requests.') }}</p></div></div>
    <section class="dashboard-card"><h2>{{ t('Sites open to hiring') }}</h2><p role="status" class="dialog-intro">{{ t('Hiring listings are awaiting backend support. No sites are being presented as hiring without a published listing.') }}</p><p>{{ t('Already have a site ID? You can submit a contract request below and track the response.') }}</p></section>
    <ContractApplicationsPanel />
  </section>
</template>
