<script setup lang="ts">
import { useLocale } from '@/i18n';
const { t } = useLocale();
</script>
<template>
  <a class="skip-link" href="#main-content">{{ t('Skip to main content') }}</a>
</template>
