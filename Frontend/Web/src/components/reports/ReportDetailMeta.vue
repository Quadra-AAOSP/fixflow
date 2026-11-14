<script setup lang="ts">
import { useLocale } from '@/i18n';
import { formatDate, humanize, urgencyLabels } from '@/utils/maintenance';
import type { Report, ReportVisionJob } from '@/types/maintenance';

defineProps<{
  report: Report;
  siteName: string;
  peopleCount: number;
  visionOverview: ReportVisionJob | null;
  visionPending: boolean;
  visionOverviewChecking: boolean;
}>();

const emit = defineEmits<{ 'check-vision': [] }>();
const { t } = useLocale();
</script>

<template>
  <section class="ff-surface rd-meta">
    <header class="ff-section-heading">
      <h2>{{ t('Report information') }}</h2>
    </header>
    <dl class="report-detail-grid rd-meta-grid">
      <div v-if="report.visibility">
        <dt>{{ t('Report visibility') }}</dt>
        <dd>
          {{
            t(
              report.visibility === 'private'
                ? 'Private report'
                : 'Public within your site',
            )
          }}
        </dd>
      </div>
      <div>
        <dt>{{ t('Site') }}</dt>
        <dd>{{ siteName }}</dd>
      </div>
      <div>
        <dt>{{ t('Location') }}</dt>
        <dd>{{ report.address || t('Not shared or not provided') }}</dd>
      </div>
      <div>
        <dt>{{ t('Category') }}</dt>
        <dd>{{ t(humanize(report.category)) }}</dd>
      </div>
      <div>
        <dt>{{ t('Specialty') }}</dt>
        <dd>
          {{
            report.specialty
              ? t(humanize(report.specialty))
              : t('Not specified')
          }}
        </dd>
      </div>
      <div>
        <dt>{{ t('Reported by') }}</dt>
        <dd>{{ report.createdByName || t('Not shared') }}</dd>
      </div>
      <div>
        <dt>{{ t('Technician') }}</dt>
        <dd>
          {{
            report.assignedTechnicianId == null
              ? t('Unassigned')
              : t('Technician #{id}', { id: report.assignedTechnicianId })
          }}
        </dd>
      </div>
      <div>
        <dt>{{ t('Reporter urgency') }}</dt>
        <dd>{{ t(urgencyLabels[report.reporterUrgency]) }}</dd>
      </div>
      <div>
        <dt>{{ t('Calculated urgency') }}</dt>
        <dd>
          {{
            report.calculatedUrgency
              ? t(urgencyLabels[report.calculatedUrgency])
              : t('Not determined')
          }}
        </dd>
      </div>
      <div>
        <dt>{{ t('People joined') }}</dt>
        <dd>{{ report.participationCount ?? peopleCount }}</dd>
      </div>
      <div>
        <dt>{{ t('AI urgency') }}</dt>
        <dd>
          {{
            report.aiUrgency
              ? t(urgencyLabels[report.aiUrgency])
              : t(report.aiReport?.failed ? 'AI classification failed' : 'Not classified')
          }}
        </dd>
      </div>
      <div>
        <dt>{{ t('AI image analysis') }}</dt>
        <dd>
          <template v-if="visionOverview">
            {{ t(visionOverview.status.replaceAll('_', ' '))
            }}<template v-if="visionOverview.model">
              · {{ visionOverview.model }}</template
            >
            <button
              v-if="visionPending"
              type="button"
              class="text-action"
              :disabled="visionOverviewChecking"
              @click="emit('check-vision')"
            >
              {{
                t(
                  visionOverviewChecking
                    ? 'Checking…'
                    : 'Check analysis status',
                )
              }}
            </button>
          </template>
          <template v-else>{{ t('No image analysis yet') }}</template>
        </dd>
      </div>
      <div>
        <dt>{{ t('Final urgency') }}</dt>
        <dd>
          {{
            report.finalUrgency
              ? t(urgencyLabels[report.finalUrgency])
              : t('Not determined')
          }}
        </dd>
      </div>
      <div>
        <dt>{{ t('Urgency reason') }}</dt>
        <dd>{{ report.reporterReason || t('Not shared or not provided') }}</dd>
      </div>
      <div>
        <dt>{{ t('Created') }}</dt>
        <dd>{{ formatDate(report.createdAt, true) }}</dd>
      </div>
      <div>
        <dt>{{ t('Updated') }}</dt>
        <dd>{{ formatDate(report.updatedAt, true) }}</dd>
      </div>
      <div>
        <dt>{{ t('Times reopened') }}</dt>
        <dd>{{ report.reopenCount }}</dd>
      </div>
    </dl>
    <div
      v-if="report.confirmedAt || report.reopenReason"
      class="rd-meta-notes"
    >
      <p v-if="report.confirmedAt">
        {{
          report.confirmedByName
            ? t('Confirmed {date} by {name}', {
                date: formatDate(report.confirmedAt, true),
                name: report.confirmedByName,
              })
            : t('Confirmed {date}', {
                date: formatDate(report.confirmedAt, true),
              })
        }}
      </p>
      <p v-if="report.reopenReason">
        {{ t('Reopen reason: {reason}', { reason: report.reopenReason }) }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.rd-meta-grid {
  padding: 0 24px 22px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.rd-meta-notes {
  padding: 0 24px 22px;
  display: grid;
  gap: 8px;
  color: #52677b;
  font-size: 13px;
}
@media (max-width: 650px) {
  .rd-meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
