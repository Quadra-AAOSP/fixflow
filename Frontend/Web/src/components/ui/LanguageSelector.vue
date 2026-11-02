<script setup lang="ts">
import { useLocale } from '@/i18n';
const { locale, t, setLocale } = useLocale();
</script>
<template>
  <label class="language-selector"><span>{{ t('Language') }}</span><select :value="locale" @change="setLocale(($event.target as HTMLSelectElement).value)"><option value="en" lang="en">English</option><option value="zh-CN" lang="zh-CN">简体中文</option></select></label>
</template>
<style scoped>
.language-selector{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:#36574e;white-space:nowrap}.language-selector select{border:1px solid #dce7e1;border-radius:8px;background:#fff;padding:7px 10px;max-width:124px;min-height:36px}.language-selector select:focus-visible{outline:2px solid #3a9480;outline-offset:3px}
</style>
