<script setup lang="ts">
import { ArrowLeft, RefreshCw } from '@lucide/vue';
import { useLocale } from '@/i18n';
import { statusLabels, statusTone } from '@/utils/maintenance';
import type { Report } from '@/types/maintenance';

defineProps<{
  report: Report;
  siteName: string;
  loading: boolean;
  disabled: boolean;
}>();

const emit = defineEmits<{ reload: [] }>();
const { t } = useLocale();
</script>

<template>
  <header class="ff-page-heading rd-header">
    <div>
      <RouterLink class="ff-inline rd-back" to="/reports">
        <ArrowLeft :size="16" />{{ t('All reports') }}
      </RouterLink>
      <p class="ff-context">{{ siteName }}</p>
      <h1>{{ t('Report #{id}', { id: report.id }) }}</h1>
    </div>
    <div class="rd-header-aside">
      <span class="status-badge" :class="statusTone(report.status)">{{
        t(statusLabels[report.status])
      }}</span>
      <button
        class="icon-button"
        type="button"
        :disabled="loading || disabled"
        :aria-label="t('Reload report')"
        @click="emit('reload')"
      >
        <RefreshCw :size="17" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.rd-header {
  align-items: flex-start;
}
.rd-back {
  margin-bottom: 10px;
}
.rd-header-aside {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
</style>
