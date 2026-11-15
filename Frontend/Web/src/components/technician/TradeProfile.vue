<script setup lang="ts">
import { useLocale } from '@/i18n';
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import TextField from '@/components/ui/TextField.vue';
import Button from '@/components/ui/Button.vue';
import { useAuth } from '@/composables/useAuth';
import { addTechnicianSkill, listMyTechnicianSkills, type TechnicianTrade } from '@/services/technician';
import { errorMessage } from '@/services/api';
import LoadingStatus from '@/components/ui/LoadingStatus.vue';
const { t } = useLocale();
const { user } = useAuth();
const form = reactive({ category: '', specialty: '' });
const saving = ref(false);
const error = ref('');
const loadError = ref('');
const loading = ref(true);
const trades = ref<TechnicianTrade[]>([]);
const adding = ref(false);
const savedId = ref<number>();
const controller = new AbortController();
onBeforeUnmount(() => controller.abort());

async function load() {
  loading.value = true;
  loadError.value = '';
  try { trades.value = await listMyTechnicianSkills(controller.signal); }
  catch (err) { if (!controller.signal.aborted) loadError.value = errorMessage(err); }
  finally { loading.value = false; }
}
onMounted(load);

function closeForm() {
  adding.value = false;
  error.value = '';
  Object.assign(form, { category: '', specialty: '' });
}

async function submit() {
  if (loading.value || loadError.value || saving.value || user.value?.role !== 'technician') return;
  saving.value = true; error.value = '';
  try {
    const saved = await addTechnicianSkill(user.value.id, form.category, form.specialty);
    trades.value = [...trades.value.filter(trade => trade.id !== saved.id), saved];
    savedId.value = saved.id;
    closeForm();
  }
  catch (err) { error.value = errorMessage(err); }
  finally { saving.value = false; }
}
</script>

<template>
  <section class="dashboard-card">
    <h2>{{ t("Your trade profile") }}</h2>
    <p class="dialog-intro">{{ t("Manage the trades saved to your account. Proficiency starts at 2.5 and updates from confirmed reporter ratings. A reviewer verifies qualifications separately.") }}</p>
    <LoadingStatus v-if="loading" :label="t('Loading saved trades…')" />
    <p v-else-if="loadError" role="alert" class="live-error">{{ t(loadError) }} <button type="button" @click="load">{{ t('Retry') }}</button></p>
    <template v-else>
    <ul v-if="trades.length" class="reporter-list">
      <li v-for="trade in trades" :key="trade.id">
        <span :role="trade.id === savedId ? 'status' : undefined">{{ t('Saved: {category} · {specialty} · proficiency {level}/5.', { category: trade.category, specialty: trade.specialty || t('Not specified'), level: trade.proficiency }) }}</span>
      </li>
    </ul>
    <button v-if="!adding" type="button" class="text-action" @click="adding = true">{{ t(trades.length ? 'Add another trade →' : 'Add trade →') }}</button>
    <form v-if="adding" @submit.prevent="submit"><fieldset :disabled="saving">
      <TextField v-model="form.category" label="Primary trade" :maxlength="128" required />
      <TextField v-model="form.specialty" label="Specialty and work you are qualified to undertake (optional)" :maxlength="128" />
      <p class="dialog-intro">{{ t("New trades start at proficiency 2.5. The platform updates this from confirmed reporter ratings — you cannot set it yourself.") }}</p>
      <p v-if="error" role="alert" class="registration-error">{{ t(error) }} {{ t('If the connection was interrupted, reload your saved trades before trying again.') }}</p><Button label="Save trade details" type="submit" :loading="saving" />
      <button type="button" class="text-action" @click="closeForm">{{ t('Cancel') }}</button>
    </fieldset></form>
    </template>
    <h3>{{ t("Before you start work at a site") }}</h3>
    <p class="dialog-intro">{{ t("Arrange a review with the site administrator covering your identity, relevant work history and references, qualifications, applicable trade licences and expiry dates, and insurance appropriate to the work. Requirements depend on the trade and location.") }}</p>
    <p class="dialog-intro">{{ t("Site vetting approval is required before work. Contact your site administrator to request a review. Do not enter identity numbers or document links here. A saved trade or site contract is not proof of vetting.") }}</p>
  </section>
</template>
