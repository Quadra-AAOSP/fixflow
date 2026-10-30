<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';
import { computed } from 'vue';
import { useLocale } from '@/i18n';
import { usePageNavigation } from '@/composables/usePageNavigation';
usePageNavigation();

const { isLoading, user } = useAuth();
const { t } = useLocale();
const accountScope = computed(() => `${user.value?.id ?? 'guest'}:${user.value?.role ?? ''}:${user.value?.siteId ?? ''}`);
</script>

<template>
  <div
    v-if="isLoading"
    class="flex min-h-screen items-center justify-center bg-surface dark:bg-surface-dark"
  >
    <span
      class="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent dark:border-primary-dark"
      role="status"
    ><span class="sr-only">{{ t('Loading') }}</span></span>
  </div>
  <RouterView v-else :key="accountScope" />
</template>
