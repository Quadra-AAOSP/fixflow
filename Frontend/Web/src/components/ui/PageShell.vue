<script setup lang="ts">
defineProps<{
  className?: string;
}>();
</script>

<template>
  <div
    class="min-h-full bg-surface text-ink dark:bg-surface-dark dark:text-ink-dark"
    :class="className"
  >
    <slot />
  </div>
</template>
