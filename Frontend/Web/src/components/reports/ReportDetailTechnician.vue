<script setup lang="ts">
import { useLocale } from '@/i18n';
import TechnicianAssignmentPanel from '@/components/technician/TechnicianAssignmentPanel.vue';
import MarketplacePublishPanel from '@/components/technician/MarketplacePublishPanel.vue';
import type { Report } from '@/types/maintenance';
import type { TechnicianRoute } from '@/composables/useReportDetail';

defineProps<{
  report: Report;
  routes: TechnicianRoute[];
  route: TechnicianRoute;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'update:route': [value: TechnicianRoute];
  'assignment-busy': [value: boolean];
  assigned: [report: Report];
  'marketplace-busy': [value: boolean];
}>();

const { t } = useLocale();
</script>

<template>
  <section v-if="routes.length" class="ff-surface rd-technician">
    <header class="ff-section-heading">
      <h2>{{ t('Find a technician') }}</h2>
    </header>
    <div class="rd-technician-body">
      <TechnicianAssignmentPanel
        v-if="routes.includes('contracted')"
        :report="report"
        :disabled="disabled"
        @busy="emit('assignment-busy', $event)"
        @saved="emit('assigned', $event)"
      />
      <MarketplacePublishPanel
        v-if="routes.includes('marketplace')"
        :report="report"
        :disabled="disabled"
        @busy="emit('marketplace-busy', $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.rd-technician-body {
  padding: 0 24px 22px;
  display: grid;
  gap: 18px;
}
</style>
