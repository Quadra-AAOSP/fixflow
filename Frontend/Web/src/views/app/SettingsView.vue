<script setup lang="ts">
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { useLocale } from '@/i18n';
const { t } = useLocale();
</script>
<template>
  <section class="settings-page"><header><h1>{{ t('Settings') }}</h1></header><div class="settings-language"><LanguageSelector /></div></section>
</template>
<style scoped>
.settings-page{max-width:720px}.settings-page h1{font-size:30px;font-weight:700;line-height:1.3;margin-bottom:28px}.settings-language{padding:24px 0;border-top:1px solid #dfe7e2;border-bottom:1px solid #dfe7e2}.settings-language :deep(label){font-size:16px;gap:24px;flex-wrap:wrap}.settings-language :deep(select){min-height:44px;font-size:16px;max-width:220px}
</style>
