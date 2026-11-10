<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLocale } from '@/i18n';
import { usePageNavigation } from '@/composables/usePageNavigation';
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
usePageNavigation();

const { isLoading, user } = useAuth();
const { t } = useLocale();
const route = useRoute();
const router = useRouter();
const accountScope = computed(() => `${user.value?.id ?? 'guest'}:${user.value?.role ?? ''}:${user.value?.siteId ?? ''}:${user.value?.applicationOnly ?? false}`);
const restrictedRoute = computed(() => (user.value?.applicationOnly && route.name !== 'application-access') || (!isLoading.value && !user.value && !!route.name && !route.meta.public));
watch(restrictedRoute, restricted => {
  if (restricted && route.name) void router.replace(user.value?.applicationOnly ? { name: 'application-access' } : { name: 'landing', query: { redirect: route.fullPath } });
});
</script>

<template>
  <div
    v-if="isLoading"
    class="flex min-h-screen items-center justify-center bg-surface dark:bg-surface-dark"
  >
    <LoadingStatus :label="t('Loading')" class="w-full max-w-2xl px-5" />
  </div>
  <RouterView v-else-if="!restrictedRoute" :key="accountScope" />
</template>
