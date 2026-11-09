<script setup lang="ts">
import { useLocale } from '@/i18n';
import { onMounted, ref } from 'vue';
import { request } from '@/services/api';
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { TECHNICIAN_AGREEMENT_DRAFT_VERSION, technicianAgreementSections } from '@/constants/technicianAgreement';
const { t } = useLocale();
const isCurrent = ref(false);
onMounted(async () => {
  try {
    const current = await request<{ currentVersion: string | null; documentUrl: string | null }>('/api/technician-terms/current');
    const url = current.documentUrl ? new URL(current.documentUrl, window.location.origin) : null;
    isCurrent.value = current.currentVersion === TECHNICIAN_AGREEMENT_DRAFT_VERSION && url?.origin === window.location.origin && url.pathname === '/agreements/technician/draft-2026-11-03';
  } catch { /* The document remains available even when status cannot be checked. */ }
});
</script>
<template>
  <main class="agreement-page">
    <LanguageSelector />
    <RouterLink class="text-action" to="/">← {{ t('Return to workspace') }}</RouterLink>
    <article aria-labelledby="agreement-title">
      <p class="agreement-status">{{ t(isCurrent ? 'Current agreement' : 'Agreement version') }} · {{ TECHNICIAN_AGREEMENT_DRAFT_VERSION }}</p>
      <h1 id="agreement-title">{{ t('Technician participation agreement') }}</h1>
      <p v-if="!isCurrent" role="note" class="agreement-notice">{{ t('Check the technician terms panel for the current agreement and acceptance status.') }}</p>
      <section v-for="(section, index) in technicianAgreementSections" :key="section.title">
        <h2>{{ index + 1 }}. {{ t(section.title) }}</h2>
        <p>{{ t(section.body) }}</p>
      </section>
      <p><a href="https://www.oecd.org/en/topics/privacy-principles.html" target="_blank" rel="noopener noreferrer">{{ t('Privacy drafting reference') }}: OECD ↗</a></p>
    </article>
  </main>
</template>
<style scoped>
.agreement-page{max-width:850px;margin:auto;padding:clamp(18px,5vw,56px);color:#18334b;line-height:1.7;overflow-wrap:anywhere}
.agreement-page article{margin-top:24px}.agreement-page h1{font-size:clamp(1.8rem,5vw,2.7rem);line-height:1.2}.agreement-page h2{font-size:1.2rem;margin-top:30px}.agreement-status{font-weight:700;color:#006f65}.agreement-notice{background:#fff1e9;border-left:4px solid #e27979;padding:16px;border-radius:8px}.agreement-page a{color:#006f65;text-decoration:underline}
@media print{.agreement-page{padding:0;max-width:none}.agreement-page> a{display:none}}
</style>
