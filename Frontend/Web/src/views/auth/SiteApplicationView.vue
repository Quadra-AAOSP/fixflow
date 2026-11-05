<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRoute, RouterLink } from 'vue-router';
import { request, errorMessage } from '@/services/api';
import '@/styles/dashboard.css';
const route=useRoute();
const setup=computed(()=>route.name==='site-admin-setup');
const tracking=computed(()=>route.name==='site-application-status');
const token=ref(''); const password=ref('');const busy=ref(false);const error=ref('');const success=ref('');
const status=ref<{status:string;message:string|null;siteId:number|null;setupComplete:boolean}|null>(null);
const fields=[['organization','Organization',255],['siteName','Site name',255],['address','Site address',512],
 ['contactEmail','Applicant contact email',255],['contactPhone','Applicant contact phone',64],['relationship','Your relationship to the organization',1000],
 ['adminFirstName','Proposed site admin first name',128],['adminLastName','Proposed site admin last name',128],
 ['adminEmail','Proposed site admin email',255],['adminPhone','Proposed site admin contact phone',64]] as const;
const form=reactive<Record<string,string>>({siteType:'school',...Object.fromEntries(fields.map(([key])=>[key,'']))});
async function run(action:()=>Promise<void>){busy.value=true;error.value='';success.value='';try{await action();}catch(e){error.value=errorMessage(e);}finally{busy.value=false;}}
function submit(){return run(async()=>{const receipt=await request<{trackingToken:string}>('/api/site-applications',{method:'POST',body:JSON.stringify(form)});token.value=receipt.trackingToken;success.value='Application submitted. Save this private tracking token; it is only shown here.';});}
function load(){return run(async()=>{status.value=await request('/api/site-applications/status',{headers:{'X-Application-Token':token.value}});});}
function amend(){return run(async()=>{status.value=await request('/api/site-applications/information',{method:'PUT',headers:{'X-Application-Token':token.value},body:JSON.stringify(form)});success.value='Updated application submitted for review.';});}
function activate(){return run(async()=>{await request('/api/site-applications/setup',{method:'POST',headers:{'X-Setup-Token':token.value},body:JSON.stringify({password:password.value})});password.value='';token.value='';success.value='Administrator password set. Sign in with the proposed administrator email.';});}
</script>
<template><section class="dashboard-card live-page"><h1>{{ setup?'Set up site administrator access':tracking?'Track your site application':'Request a new site' }}</h1>
<p v-if="!setup">Provide your organization and intended site administrator. Approval creates the site and that administrator account; reporter registration is not required.</p>
<p v-if="error" role="alert">{{ error }}</p><p v-if="success" role="status">{{ success }}</p>
<form v-if="setup" class="draft-form" @submit.prevent="activate"><label>Private setup token<input v-model="token" type="password" autocomplete="off" required /></label><label>New password<input v-model="password" type="password" minlength="15" maxlength="100" autocomplete="new-password" required /></label><button :disabled="busy">Set password</button></form>
<template v-else><form v-if="tracking" class="draft-form" @submit.prevent="load"><label>Private tracking token<input v-model="token" type="password" autocomplete="off" required /></label><button :disabled="busy">Check application</button></form>
<div v-if="tracking && status"><h2>Application: {{ status.status }}</h2><p>{{ status.message }}</p><p v-if="status.siteId">Created site #{{ status.siteId }}</p><p v-if="status.status==='approved'">The proposed administrator receives setup instructions through the approving administrator. Contact them for secure delivery.</p></div>
<form v-if="!tracking || status?.status==='information_requested'" class="draft-form" @submit.prevent="tracking?amend():submit()"><fieldset :disabled="busy"><label v-for="[key,label,max] in fields" :key="key">{{ label }}<input v-model="form[key]" :type="key.toLowerCase().includes('email')?'email':'text'" :maxlength="max" required /></label><label>Site type<select v-model="form.siteType"><option value="school">School</option><option value="hostel">Hostel</option><option value="hotel">Hotel</option></select></label><button>{{ tracking?'Submit requested information':'Submit site application' }}</button></fieldset></form>
<div v-if="!tracking && token"><label>Private tracking token<input :value="token" readonly autocomplete="off" /></label><p>Anyone holding this token can see your status and submit requested corrections. Keep it private.</p></div></template>
<p><RouterLink to="/site-application">Track an application</RouterLink> · <RouterLink to="/request-site">Request a site</RouterLink> · <RouterLink to="/login">Sign in</RouterLink></p>
</section></template>
<style scoped>
.live-page{max-width:760px;margin:32px auto;padding:28px}h1{font-size:1.6rem;margin-bottom:16px}p{margin:12px 0}fieldset{display:grid;gap:16px;border:0;padding:0}label{display:flex;flex-direction:column;gap:6px}input,select{width:100%;padding:10px;border:1px solid currentColor;border-radius:6px}button{padding:10px 18px;margin:12px 0;border:1px solid currentColor;border-radius:6px}button:disabled{opacity:.5}a{text-decoration:underline} @media(max-width:600px){.live-page{margin:12px;padding:18px}}
</style>
