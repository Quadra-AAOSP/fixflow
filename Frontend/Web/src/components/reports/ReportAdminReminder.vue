<script setup lang="ts">
import { ref } from 'vue';
import { useLocale } from '@/i18n';
import { errorMessage } from '@/services/api';
import { notifyReportSiteAdmins } from '@/services/reportWorkflow';

const props = defineProps<{ reportId: number }>();
const { t } = useLocale();
const busy = ref(false);
const sent = ref(false);
const error = ref('');

async function notify() {
  if (busy.value || sent.value) return;
  busy.value = true;
  error.value = '';
  try {
    await notifyReportSiteAdmins(props.reportId);
    sent.value = true;
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="rd-status">
    <button type="button" class="ff-secondary" :disabled="busy || sent" @click="notify">
      {{ t('Notify site administrators') }}
    </button>
    <p v-if="sent" role="status">{{ t('Site administrators notified.') }}</p>
    <p v-if="error" role="alert" class="live-error">{{ t(error) }}</p>
  </div>
</template>
