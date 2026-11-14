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
      <label class="ranking-route"
        >{{ t('Technician route') }}
        <select
          :value="route"
          :disabled="disabled"
          @change="
            emit(
              'update:route',
              ($event.target as HTMLSelectElement).value as TechnicianRoute,
            )
          "
        >
          <option v-if="routes.includes('contracted')" value="contracted">
            {{ t('Assign a contracted technician') }}
          </option>
          <option v-if="routes.includes('marketplace')" value="marketplace">
            {{ t('Publish to the job marketplace') }}
          </option>
        </select>
      </label>
      <p class="dialog-intro">
        {{
          t(
            route === 'contracted'
              ? 'Choose a technician already contracted to this site.'
              : 'Publish a job so eligible independent technicians can apply for this report.',
          )
        }}
      </p>
      <TechnicianAssignmentPanel
        v-show="route === 'contracted'"
        :report="report"
        :disabled="disabled"
        @busy="emit('assignment-busy', $event)"
        @saved="emit('assigned', $event)"
      />
      <MarketplacePublishPanel
        v-show="route === 'marketplace'"
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
  gap: 12px;
}
.ranking-route {
  display: grid;
  gap: 0.5rem;
  max-width: 32rem;
}
.ranking-route select {
  color: #152742;
  background: #fff;
  width: 100%;
  border: 1px solid #dfe8e2;
  border-radius: 8px;
  padding: 0.75rem;
}
</style>
