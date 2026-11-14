<script setup lang="ts">
import { useLocale } from '@/i18n';
import { useReportDetail } from '@/composables/useReportDetail';
import ReportDetailSkeleton from '@/components/reports/ReportDetailSkeleton.vue';
import ReportDetailHeader from '@/components/reports/ReportDetailHeader.vue';
import ReportDetailSummary from '@/components/reports/ReportDetailSummary.vue';
import ReportDetailActions from '@/components/reports/ReportDetailActions.vue';
import ReportDetailMeta from '@/components/reports/ReportDetailMeta.vue';
import ReportDetailPeople from '@/components/reports/ReportDetailPeople.vue';
import ReportDetailInsights from '@/components/reports/ReportDetailInsights.vue';
import ReportDetailTechnician from '@/components/reports/ReportDetailTechnician.vue';
import ReportAssistantPanel from '@/components/ReportAssistantPanel.vue';
import ReportPhotosPanel from '@/components/ReportPhotosPanel.vue';
import ReportWorkflowPanel from '@/components/ReportWorkflowPanel.vue';
import '@/styles/report-detail.css';

const { t } = useLocale();
const {
  user,
  data,
  report,
  reporters,
  reportersLoaded,
  reportersError,
  loading,
  error,
  actionError,
  message,
  busy,
  edit,
  confirmingArchive,
  assignmentBusy,
  workflowBusy,
  classificationBusy,
  visionBusy,
  marketplaceBusy,
  overrideUrgency,
  overrideReason,
  technicianRoute,
  technicianRoutes,
  visionOverview,
  visionOverviewChecking,
  visionPending,
  actionInProgress,
  canLeave,
  canJoin,
  canOverrideUrgency,
  load,
  beginEdit,
  saveEdit,
  archiveReport,
  join,
  leave,
  saveUrgencyOverride,
  workflowSaved,
  assigned,
  classified,
  visionFinished,
  refreshVisionOverview,
  syncVisionOverview,
} = useReportDetail();
</script>

<template>
  <section class="report-detail-page">
    <ReportDetailSkeleton v-if="loading" />
    <p v-else-if="error" role="alert" class="live-error">{{ t(error) }}</p>
    <template v-else-if="report">
      <ReportDetailHeader
        :report="report"
        :site-name="data.siteName(report.siteId)"
        :loading="loading"
        :disabled="actionInProgress"
        @reload="load()"
      />

      <ReportDetailSummary :report="report" />

      <div class="rd-status">
        <p v-if="message" class="draft-notice" role="status">{{ t(message) }}</p>
        <p v-if="actionError" class="live-error" role="alert">
          {{ t(actionError) }}
        </p>
      </div>

      <ReportDetailActions
        :report="report"
        :edit="edit"
        :confirming-archive="confirmingArchive"
        :can-join="canJoin"
        :can-leave="canLeave"
        :can-override-urgency="canOverrideUrgency"
        :action-in-progress="actionInProgress"
        :busy="busy"
        :override-urgency="overrideUrgency"
        :override-reason="overrideReason"
        @begin-edit="beginEdit()"
        @cancel-edit="edit = null"
        @save-edit="saveEdit()"
        @update:edit="edit = $event"
        @update:confirming-archive="confirmingArchive = $event"
        @update:override-urgency="overrideUrgency = $event"
        @update:override-reason="overrideReason = $event"
        @archive="archiveReport()"
        @join="join()"
        @leave="leave()"
        @save-override="saveUrgencyOverride()"
      />

      <div class="rd-columns">
        <div class="rd-main">
          <ReportDetailTechnician
            :report="report"
            :routes="technicianRoutes"
            :route="technicianRoute"
            :disabled="actionInProgress"
            @update:route="technicianRoute = $event"
            @assignment-busy="assignmentBusy = $event"
            @assigned="assigned"
            @marketplace-busy="marketplaceBusy = $event"
          />

          <ReportDetailPeople
            :reporters="reporters"
            :reporters-loaded="reportersLoaded"
            :reporters-error="reportersError"
            :current-user-id="user?.id"
          />

          <section class="ff-surface">
            <header class="ff-section-heading">
              <h2>{{ t('Repair workflow') }}</h2>
            </header>
            <div class="rd-workflow">
              <ReportWorkflowPanel
                supplementary
                :report="report"
                :disabled="actionInProgress"
                @busy="workflowBusy = $event"
                @saved="workflowSaved"
              />
            </div>
          </section>

          <section class="ff-surface">
            <header class="ff-section-heading">
              <h2>{{ t('Report assistant') }}</h2>
            </header>
            <div class="rd-assistant">
              <ReportAssistantPanel :report="report" />
            </div>
          </section>
        </div>

        <aside class="rd-support">
          <ReportDetailMeta
            :report="report"
            :site-name="data.siteName(report.siteId)"
            :people-count="reporters.length"
            :vision-overview="visionOverview"
            :vision-pending="visionPending"
            :vision-overview-checking="visionOverviewChecking"
            @check-vision="refreshVisionOverview()"
          />

          <section class="ff-surface">
            <header class="ff-section-heading">
              <h2>{{ t('Report photos') }}</h2>
            </header>
            <div class="rd-photos">
              <ReportPhotosPanel :report="report" />
            </div>
          </section>

          <ReportDetailInsights
            :report="report"
            :disabled="actionInProgress"
            @classification-busy="classificationBusy = $event"
            @classified="classified"
            @vision-busy="visionBusy = $event"
            @vision-finished="visionFinished"
            @vision-updated="syncVisionOverview"
          />
        </aside>
      </div>
    </template>
  </section>
</template>
