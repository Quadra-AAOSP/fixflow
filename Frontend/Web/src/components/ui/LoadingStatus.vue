<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <p class="live-empty" role="status">{{ label }}</p>
</template>
