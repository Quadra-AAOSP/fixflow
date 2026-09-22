<script setup lang="ts">
import { ref } from 'vue';
defineProps<{ initials: string }>();
const failed = ref(false);
// Decorative stock portraits for fictional preview users; never actual account photos.
const portraits: Record<string, string> = {
  AR: 'photo-1734434570358-21badf4ba1c6',
  PS: 'photo-1687360440094-949b8fe71c8c',
  ML: 'photo-1623184663110-89ba5b565eb6',
  EP: 'photo-1662850886700-4ec19bd30d11',
};
</script>

<template>
  <img v-if="portraits[initials] && !failed" class="avatar-portrait" :src="`https://images.unsplash.com/${portraits[initials]}?auto=format&fit=crop&crop=faces&w=96&h=96&q=80`" alt="" loading="lazy" @error="failed = true" />
  <template v-else>{{ initials }}</template>
</template>
