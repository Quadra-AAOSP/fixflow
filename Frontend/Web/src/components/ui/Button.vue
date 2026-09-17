<script setup lang="ts">
defineProps<{
  label: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}>();
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled || loading"
    class="inline-flex min-h-12 w-full items-center justify-center rounded-lg px-4 py-3 text-base font-semibold transition active:opacity-80 disabled:opacity-50"
    :class="
      (variant ?? 'primary') === 'primary'
        ? 'bg-primary text-primary-foreground dark:bg-primary-dark dark:text-surface-dark'
        : 'border border-border bg-card text-ink dark:border-border-dark dark:bg-card-dark dark:text-ink-dark'
    "
  >
    <span
      v-if="loading"
      class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
    />
    {{ label }}
  </button>
</template>
