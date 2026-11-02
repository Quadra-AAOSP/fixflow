<script setup lang="ts">
import { useLocale } from '@/i18n';
import { ref, watch } from 'vue';
import { Package } from '@lucide/vue';
const { t } = useLocale();
const props = defineProps<{ src: string | null; alt: string }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
</script>
<template><div class="shop-product-image"><img v-if="src && !failed" :src="src" :alt="alt" loading="lazy" referrerpolicy="no-referrer" @error="failed = true" /><span v-else role="img" :aria-label="t('Image unavailable for {name}', { name: alt })"><Package :size="36" /><small>{{ t('Image unavailable') }}</small></span></div></template>
