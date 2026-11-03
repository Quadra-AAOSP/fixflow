<script setup lang="ts">
import { useLocale } from '@/i18n';
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { TECHNICIAN_AGREEMENT_DRAFT_VERSION, technicianAgreementSections } from '@/constants/technicianAgreement';
const { t } = useLocale();
</script>
<template>
  <main class="agreement-page">
    <LanguageSelector />
    <RouterLink class="text-action" to="/">← {{ t('Return to workspace') }}</RouterLink>
    <article aria-labelledby="agreement-title">
      <p class="agreement-status">{{ t('Draft for review') }} · {{ TECHNICIAN_AGREEMENT_DRAFT_VERSION }}</p>
      <h1 id="agreement-title">{{ t('Technician participation agreement') }}</h1>
      <p role="note" class="agreement-notice">{{ t('This draft is awaiting review and is not available for acceptance.') }}</p>
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
