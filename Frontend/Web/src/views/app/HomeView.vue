<script setup lang="ts">
import { Wrench } from '@lucide/vue';

import Button from '@/components/ui/Button.vue';
import UrgencyChip from '@/components/ui/UrgencyChip.vue';
import { useAuth } from '@/composables/useAuth';
import { colors } from '@/constants/theme';

const { user } = useAuth();
</script>

<template>
  <div>
    <div class="mb-6 flex items-center gap-3">
      <span
        class="inline-flex rounded-xl bg-primary/15 p-3 dark:bg-primary-dark/20"
      >
        <Wrench :size="28" :color="colors.light.primary" />
      </span>
      <div>
        <h1 class="text-2xl font-bold text-ink dark:text-ink-dark">
          Hello{{ user ? `, ${user.firstName}` : '' }}
        </h1>
        <p class="text-sm text-muted dark:text-muted-dark">
          Report and track site maintenance issues
        </p>
      </div>
    </div>

    <div
      class="mb-6 rounded-xl border border-border bg-card p-4 dark:border-border-dark dark:bg-card-dark"
    >
      <p class="mb-3 text-sm font-medium text-muted dark:text-muted-dark">
        Urgency levels
      </p>
      <div class="flex flex-wrap gap-2">
        <UrgencyChip level="low" />
        <UrgencyChip level="medium" />
        <UrgencyChip level="high" />
        <UrgencyChip level="critical" />
      </div>
    </div>

    <div class="max-w-xs">
      <Button label="New report" disabled />
    </div>
    <p class="mt-3 text-xs text-muted dark:text-muted-dark">
      Report creation comes next.
    </p>
  </div>
</template>
