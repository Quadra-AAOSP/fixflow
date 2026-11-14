<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '@/i18n';
import { humanize, urgencyLabels } from '@/utils/maintenance';
import type { Report } from '@/types/maintenance';

const props = defineProps<{ report: Report }>();
const { t } = useLocale();

const effectiveUrgency = computed(
  () =>
    props.report.policy?.effectiveUrgency ??
    props.report.finalUrgency ??
    props.report.calculatedUrgency ??
    props.report.reporterUrgency,
);

const chips = computed(() => {
  const report = props.report;
  const list: Array<{ label: string; value: string }> = [
    {
      label: t('Urgency'),
      value: t(urgencyLabels[effectiveUrgency.value]),
    },
    {
      label: t('Category'),
      value: t(humanize(report.category)),
    },
    {
      label: t('Location'),
      value: report.address || t('Not shared or not provided'),
    },
    {
      label: t('Technician'),
      value:
        report.assignedTechnicianId == null
          ? t('Unassigned')
          : t('Technician #{id}', { id: report.assignedTechnicianId }),
    },
  ];
  if (report.visibility) {
    list.unshift({
      label: t('Report visibility'),
      value: t(
        report.visibility === 'private'
          ? 'Private report'
          : 'Public within your site',
      ),
    });
  }
  return list;
});
</script>

<template>
  <section class="ff-surface rd-summary">
    <p class="rd-description">{{ report.description }}</p>
    <ul class="rd-chips">
      <li v-for="chip in chips" :key="chip.label">
        <span class="rd-chip-label">{{ chip.label }}</span>
        <strong>{{ chip.value }}</strong>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rd-summary {
  padding: 22px 24px;
}
.rd-description {
  margin: 0 0 18px;
  font-size: 15px;
  line-height: 1.65;
  color: #152742;
  white-space: pre-wrap;
}
.rd-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.rd-chips li {
  display: grid;
  gap: 3px;
  min-width: 140px;
  padding: 10px 12px;
  border: 1px solid #e1ebe5;
  border-radius: 8px;
  background: #f7faf8;
}
.rd-chip-label {
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6a7f74;
}
.rd-chips strong {
  font-size: 13px;
  font-weight: 650;
  color: #152742;
}
</style>
