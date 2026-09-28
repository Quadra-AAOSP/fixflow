<script setup lang="ts">
import { ref, watch } from 'vue';
import { Package } from '@lucide/vue';
const props = defineProps<{ src: string | null; alt: string }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
</script>
<template><div class="shop-product-image"><img v-if="src && !failed" :src="src" :alt="alt" loading="lazy" referrerpolicy="no-referrer" @error="failed = true" /><span v-else><Package :size="36" /><small>Image unavailable</small></span></div></template>
