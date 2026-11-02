<script setup lang="ts">
import { useLocale } from '@/i18n';
import { reactive, ref } from 'vue';
import TextField from '@/components/ui/TextField.vue';
import Button from '@/components/ui/Button.vue';
import { useAuth } from '@/composables/useAuth';
import { addTechnicianSkill } from '@/services/technician';
import { errorMessage } from '@/services/api';
const { t } = useLocale();
const { user } = useAuth();
const form = reactive({ category: '', specialty: '', proficiency: '' });
const saving = ref(false);
const error = ref('');
const saved = ref<Awaited<ReturnType<typeof addTechnicianSkill>> | null>(null);
async function submit() {
  if (saving.value || saved.value || user.value?.role !== 'technician') return;
  saving.value = true; error.value = '';
  try { saved.value = await addTechnicianSkill(user.value.id, form.category, form.specialty, form.proficiency); }
  catch (err) { error.value = errorMessage(err); }
  finally { saving.value = false; }
}
</script>

<template>
  <section class="dashboard-card">
    <h2>{{ t("Your trade profile") }}</h2>
    <p class="dialog-intro">{{ t("Add your trade after creating your account. These details are self-reported, not verified qualifications.") }}</p>
    <div v-if="saved" role="status"><p>{{ t('Saved: {category} · {specialty} · proficiency {level}/5.', { category: saved.category, specialty: saved.specialty || t('Not specified'), level: saved.proficiency }) }}</p><button class="text-action" @click="saved = null; form.category = ''; form.specialty = ''; form.proficiency = ''">{{ t("Add another trade →") }}</button></div>
    <form v-else @submit.prevent="submit"><fieldset :disabled="saving">
      <TextField v-model="form.category" label="Primary trade" :maxlength="128" required />
      <TextField v-model="form.specialty" label="Specialty and work you are qualified to undertake (optional)" :maxlength="128" />
      <label class="mb-4 block">{{ t("Self-assessed proficiency") }}<select v-model="form.proficiency" required class="mt-2 block w-full rounded-lg border p-3"><option disabled value="">{{ t("Choose a level") }}</option><option value="1">{{ t("1 — Beginner") }}</option><option value="2">{{ t("2 — Basic practical experience") }}</option><option value="3">{{ t("3 — Independent routine work") }}</option><option value="4">{{ t("4 — Advanced work") }}</option><option value="5">{{ t("5 — Expert") }}</option></select></label>
      <p v-if="error" role="alert" class="registration-error">{{ t(error) }} {{ t('If the connection was interrupted, confirm with an administrator before submitting again to avoid a duplicate skill.') }}</p><Button label="Save trade details" type="submit" :loading="saving" />
    </fieldset></form>
    <p class="dialog-intro">{{ t("Previously saved skills cannot be displayed yet. Only add a trade you have not already submitted.") }}</p>
    <h3>{{ t("Before you start work at a site") }}</h3>
    <p class="dialog-intro">{{ t("Arrange a review with the site administrator covering your identity, relevant work history and references, qualifications, applicable trade licences and expiry dates, and insurance appropriate to the work. Requirements depend on the trade and location.") }}</p>
    <p class="dialog-intro">{{ t("Secure evidence uploads and approval tracking are not available yet. Do not enter identity numbers or document links here. A saved trade or site contract is not proof of vetting.") }}</p>
  </section>
</template>
