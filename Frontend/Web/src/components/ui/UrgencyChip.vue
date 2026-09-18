<script setup lang="ts">
import type { Urgency } from '@/types';

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
  low: 'bg-urgency-low/15 text-urgency-low',
  medium: 'bg-urgency-medium/15 text-urgency-medium',
  high: 'bg-urgency-high/15 text-urgency-high',
  critical: 'bg-urgency-critical/15 text-urgency-critical',
};
</script>

<template>
  <span
    class="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold"
    :class="containerClass[props.level]"
  >
    {{ labels[props.level] }}
  </span>
</template>
