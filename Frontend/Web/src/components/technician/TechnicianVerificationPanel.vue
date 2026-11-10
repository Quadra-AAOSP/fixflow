<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useLocale } from '@/i18n';
import { errorMessage } from '@/services/api';
import { getVerification,submitVerification,type TechnicianVerification } from '@/services/technicianVerification';
const {t}=useLocale();
const value=ref<TechnicianVerification>(); const loading=ref(true);const busy=ref(false);const error=ref('');
const form=reactive({email:'',phone:'',trades:'',experience:'',qualifications:''});
async function load(){loading.value=true;error.value='';try{value.value=await getVerification();for(const key of Object.keys(form) as (keyof typeof form)[])form[key]=value.value[key]||'';}catch(e){error.value=errorMessage(e);}finally{loading.value=false;}}
async function submit(){busy.value=true;error.value='';try{value.value=await submitVerification(form);}catch(e){error.value=errorMessage(e);}finally{busy.value=false;}}
onMounted(load);
</script>
<template>
 <section class="dashboard-card verification-panel">
  <h2>{{t('Technician verification')}}</h2>
  <p>{{t('Manual platform review is separate from site contracts and job approval. Do not submit identity document numbers or images here.')}}</p>
  <p v-if="loading" role="status">{{t('Loading verification…')}}</p>
  <p v-if="error" role="alert" class="live-error">{{error}} <button type="button" class="text-action" :disabled="loading || busy" @click="load">{{t('Retry')}}</button></p>
  <template v-if="value"><p role="status" class="verification-status">{{t('Review status')}}: {{t(value.status)}}</p><p v-if="value.reason">{{t('Reviewer reason')}}: {{value.reason}}</p><p v-if="value.status==='pending'">{{t('Your application is awaiting manual review.')}}</p><p v-if="value.status==='suspended'">{{t('Your verification is suspended. Contact an administrator for help.')}}</p>
   <p v-if="value.status==='verified'">{{t('Manually reviewed: identity, contact email, contact phone and trade qualifications. This is not an automated OTP or safety guarantee.')}}</p>
   <form v-if="['unverified','rejected'].includes(value.status)" class="draft-form" @submit.prevent="submit">
    <fieldset class="report-fields" :disabled="busy"><legend>{{t('Your application')}}</legend><p>{{t('Provide your contact details, trades, experience and qualifications so an administrator can review them.')}}</p><label>{{t('Contact email')}}<input v-model="form.email" type="email" maxlength="255" required /></label>
    <label>{{t('Contact phone')}}<input v-model="form.phone" maxlength="128" required /></label>
    <label>{{t('Trades')}}<textarea v-model="form.trades" maxlength="2000" required /></label>
    <label>{{t('Experience')}}<textarea v-model="form.experience" maxlength="4000" required /></label>
    <label>{{t('Qualifications and references')}}<textarea v-model="form.qualifications" maxlength="4000" required /></label>
    <button class="report-issue-button" type="submit">{{t(busy?'Submitting…':'Submit for manual review')}}</button></fieldset>
   </form>
  </template>
 </section>
</template>

<style scoped>
.verification-panel .verification-status{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px;padding:12px 16px;border-radius:8px;background:var(--product-paper);border:1px solid var(--product-border);font-size:14px;font-weight:600}
</style>
