<script setup lang="ts">
import { useAuth } from '@/composables/useAuth';

const { isLoading } = useAuth();
</script>

<template>
  <div
    v-if="isLoading"
    class="flex min-h-screen items-center justify-center bg-surface dark:bg-surface-dark"
  >
    <span
      class="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent dark:border-primary-dark"
      aria-label="Loading"
    />
  </div>
  <RouterView v-else />
</template>
