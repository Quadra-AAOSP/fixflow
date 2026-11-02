<script setup lang="ts">
import { useLocale } from '@/i18n';
import type { Urgency } from '@/types';
const { t } = useLocale();

const props = defineProps<{
  level: Urgency;
}>();

const labels: Record<Urgency, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const containerClass: Record<Urgency, string> = {
  low: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200',
  medium: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};
</script>

<template>
  <span
    class="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold"
    :class="containerClass[props.level]"
  >
    {{ t(labels[props.level]) }}
  </span>
</template>
