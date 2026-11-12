<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { useLocale } from "@/i18n";
import { ArrowLeft, ArrowRight, FileText } from "@lucide/vue";
import { useMaintenanceStore } from "@/stores/maintenance";
import {
  formatDate,
  humanize,
  statusLabels,
  statusTone,
  effectiveUrgency,
  urgencyLabels,
} from "@/utils/maintenance";
import type { Report } from "@/types/maintenance";
const { t } = useLocale();
const props = defineProps<{ reports: Report[]; loadingLabel?: string }>();
const data = useMaintenanceStore();
const region = ref<HTMLElement>();
const overflowing = ref(false);const atStart = ref(true);const atEnd = ref(true);
function measure() { const e=region.value;if(!e)return;overflowing.value=e.scrollWidth>e.clientWidth+1;atStart.value=e.scrollLeft<=1;atEnd.value=e.scrollLeft+e.clientWidth>=e.scrollWidth-1; }
function scrollColumns(direction:number){region.value?.scrollBy({left:direction*Math.max(180,region.value.clientWidth*.7),behavior:'auto'});}
let observer:ResizeObserver|undefined;
onMounted(()=>{measure();if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(measure);if(region.value)observer.observe(region.value);}window.addEventListener('resize',measure);});
onBeforeUnmount(()=>{observer?.disconnect();window.removeEventListener('resize',measure);});
watch(()=>[props.reports,props.loadingLabel],async()=>{await nextTick();measure();},{deep:true});
</script>
<template>
  <div v-if="overflowing" class="record-scroll-controls"><span>{{ t('More report columns') }}</span><div><button type="button" :disabled="atStart" :aria-label="t('Scroll report columns left')" @click="scrollColumns(-1)"><ArrowLeft :size="16" /></button><button type="button" :disabled="atEnd" :aria-label="t('Scroll report columns right')" @click="scrollColumns(1)"><ArrowRight :size="16" /></button></div></div>
  <div ref="region" @scroll="measure"
    class="ff-records"
    role="region"
    :aria-label="t('Reports table')"
    tabindex="0"
  >
    <table>
      <caption class="sr-only">
        {{
          t("Reports for the selected site")
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ t("Report") }}</th>
          <th scope="col">{{ t("Status") }}</th>
          <th scope="col">{{ t("Urgency") }}</th>
          <th scope="col">{{ t("Assignee") }}</th>
          <th scope="col">{{ t("Created") }}</th>
          <th scope="col">
            <span class="sr-only">{{ t("Details") }}</span>
          </th>
        </tr>
      </thead>
      <tbody v-if="loadingLabel">
        <tr>
          <td colspan="6" class="ff-empty">
            <span role="status">{{ loadingLabel }}</span>
          </td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="report in reports" :key="report.id">
          <td class="ff-record-main">
            <RouterLink :to="`/reports/${report.id}`"
              ><span class="ff-record-icon"><FileText :size="19" /></span
              ><span
                ><strong>{{ report.description }}</strong
                ><small
                  >#{{ report.id }} · {{ t(humanize(report.category)) }} ·
                  {{ data.siteName(report.siteId) }}</small
                ></span
              ></RouterLink
            >
          </td>
          <td>
            <span class="ff-status" :class="statusTone(report.status)"
              ><i />{{ t(statusLabels[report.status]) }}</span
            >
          </td>
          <td>
            <span class="ff-urgency" :class="effectiveUrgency(report)">{{
              t(urgencyLabels[effectiveUrgency(report)])
            }}</span>
          </td>
          <td class="ff-record-assignee">
            {{
              report.assignedTechnicianId == null
                ? t("Unassigned")
                : t("Technician #{id}", { id: report.assignedTechnicianId })
            }}
          </td>
          <td>
            <time>{{ formatDate(report.createdAt) }}</time>
          </td>
          <td>
            <RouterLink
              class="ff-record-open"
              :to="`/reports/${report.id}`"
              :aria-label="t('View report {id}', { id: report.id })"
              ><ArrowRight :size="18"
            /></RouterLink>
          </td>
        </tr>
        <tr v-if="!reports.length">
          <td colspan="6" class="ff-empty">
            {{ t("No reports match this view.") }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<style scoped>
.ff-records {
  overflow: auto;
  width: 100%;
}
.ff-records table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  min-width: 760px;
}
.ff-records th {
  padding: 13px 20px;
  background: #f4f7f6;
  color: #52677b;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.ff-records td {
  padding: 20px;
  border-top: 1px solid #e8eeeb;
  font-size: 12px;
  color: #52677b;
  vertical-align: middle;
}
.ff-records tbody tr:hover {
  background: #fafcfb;
}
.ff-record-main {
  width: 40%;
}
.ff-record-main a {
  display: flex;
  gap: 12px;
  align-items: center;
}
.ff-record-main strong {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.55;
  color: #152742;
}
.ff-record-main small {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  color: #52677b;
}
.ff-record-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 40px;
  border: 1px solid #e0eae5;
  border-radius: 8px;
  color: #006f65;
  background: #f4faf7;
}
.ff-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
}
.ff-status i {
  height: 6px;
  width: 6px;
  background: currentColor;
  border-radius: 50%;
}
.ff-status.coral {
  color: #ac454e;
}
.ff-status.mint {
  color: #00766b;
}
.ff-status.citron {
  color: #626c23;
}
.ff-status.sky {
  color: #2773a1;
}
.ff-urgency {
  white-space: nowrap;
}
.ff-urgency.critical {
  color: #b91c1c;
  font-weight: 700;
}
.ff-urgency.high {
  color: #9c5b08;
  font-weight: 600;
}
.ff-record-open {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e0eae5;
  border-radius: 50%;
  color: #006f65;
}
.ff-record-open:hover {
  background: #d3f6ef;
}
.ff-records .ff-empty {
  text-align: center;
  padding: 48px 20px;
}
.ff-records a:focus-visible {
  outline: 2px solid #006f65;
  outline-offset: 4px;
  border-radius: 4px;
}
@media (max-width: 700px) {
  .ff-records table {
    min-width: 0;
    table-layout: fixed;
  }
  .ff-records thead {
    display: none;
  }
  .ff-records tbody,
  .ff-records tr {
    display: block;
  }
  .ff-records tr {
    padding: 16px;
    border-top: 1px solid #e8eeeb;
    position: relative;
  }
  .ff-records td {
    display: inline-block;
    border: 0;
    padding: 6px 0;
    font-size: 11px;
    vertical-align: top;
  }
  .ff-records .ff-record-main {
    display: block;
    width: calc(100% - 30px);
    padding: 0 0 10px;
  }
  .ff-records td:nth-child(2) {
    margin-right: 16px;
  }
  .ff-records td:nth-child(3) {
    margin-right: 16px;
  }
  .ff-records td:nth-child(4) {
    display: none;
  }
  .ff-records td:nth-child(5) {
    display: block;
    margin-left: 48px;
    color: #52677b;
  }
  .ff-records td:last-child:not(.ff-empty) {
    position: absolute;
    right: 14px;
    top: 18px;
  }
  .ff-record-main strong {
    font-size: 12px;
  }
  .ff-records .ff-empty {
    display: block;
    padding: 28px 12px;
  }
  .ff-record-main small {
    line-height: 1.6;
  }
}
.ff-records{max-width:100%;min-width:0;overflow-x:auto;overflow-y:hidden;touch-action:pan-x pan-y;overscroll-behavior-x:contain;scrollbar-color:#6a887d #edf3ef;scrollbar-width:auto}.ff-records::-webkit-scrollbar{height:12px}.ff-records::-webkit-scrollbar-track{background:#edf3ef}.ff-records::-webkit-scrollbar-thumb{background:#6a887d;border:2px solid #edf3ef;border-radius:8px}.ff-records td.ff-record-main{padding:0}.ff-record-main a{padding:20px;min-height:80px;width:100%;box-sizing:border-box}.record-scroll-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px;border-top:1px solid #e3ebe6;color:#52677b;font-size:12px}.record-scroll-controls>div{display:flex;gap:8px}.record-scroll-controls button{display:inline-grid;place-items:center;width:36px;height:36px;border:1px solid #cbdad2;background:white;border-radius:6px;color:#006f65}.record-scroll-controls button:disabled{opacity:.4;cursor:default}@media(max-width:700px){.ff-records td.ff-record-main{padding:0 0 10px}.ff-record-main a{padding:0;min-height:48px}}
</style>
