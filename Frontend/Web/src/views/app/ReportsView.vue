<script setup lang="ts">
import { ClipboardList } from '@lucide/vue';

import { colors } from '@/constants/theme';
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <ClipboardList :size="40" :color="colors.light.muted" />
    <h1 class="mt-4 text-lg font-semibold text-ink dark:text-ink-dark">
      Your reports
    </h1>
    <p class="mt-2 max-w-sm text-sm text-muted dark:text-muted-dark">
      Submitted maintenance reports will appear here.
    </p>
    <span
      class="mt-4 rounded-md bg-status-pending/15 px-3 py-1.5 text-xs font-medium text-status-pending"
    >
      Pending confirmation
    </span>
  </div>
</template>
