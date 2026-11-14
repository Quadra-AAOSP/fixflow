<script setup lang="ts">
import { useLocale } from '@/i18n';
import ReportClassificationPanel from '@/components/ReportClassificationPanel.vue';
import ReportVisionPanel from '@/components/ReportVisionPanel.vue';
import type { Report, ReportVisionJob } from '@/types/maintenance';

defineProps<{
  report: Report;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'classification-busy': [value: boolean];
  classified: [report: Report];
  'vision-busy': [value: boolean];
  'vision-finished': [id: number];
  'vision-updated': [job: ReportVisionJob | null];
}>();

const { t } = useLocale();
</script>

<template>
  <section class="ff-surface rd-insights">
    <header class="ff-section-heading">
      <h2>{{ t('Insights') }}</h2>
      <p>{{ t('AI classification and image analysis') }}</p>
    </header>
    <div class="rd-insights-body">
      <ReportClassificationPanel
        :report="report"
        :disabled="disabled"
        @busy="emit('classification-busy', $event)"
        @saved="emit('classified', $event)"
      />
      <ReportVisionPanel
        :report="report"
        :disabled="disabled"
        @busy="emit('vision-busy', $event)"
        @finished="emit('vision-finished', $event)"
        @updated="emit('vision-updated', $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.rd-insights .ff-section-heading p {
  margin: 4px 0 0;
  color: #52677b;
  font-size: 12px;
}
.rd-insights-body {
  padding: 0 24px 22px;
  display: grid;
  gap: 18px;
}
</style>
