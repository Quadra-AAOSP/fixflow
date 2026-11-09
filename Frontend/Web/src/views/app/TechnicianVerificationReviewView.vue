<script setup lang="ts">
import {onMounted,ref} from 'vue';
import {useLocale} from '@/i18n';
import {errorMessage,request} from '@/services/api';
import {listVerifications,decideVerification,type TechnicianVerification} from '@/services/technicianVerification';
const {t}=useLocale();const items=ref<TechnicianVerification[]>([]);const error=ref('');const busy=ref(false);const selected=ref<TechnicianVerification>();const reason=ref('');
const identityChecked=ref(false),emailChecked=ref(false),phoneChecked=ref(false),tradeChecked=ref(false);
const terms=ref<{currentVersion:string|null;documentUrl:string|null;enforcementRequired:boolean;acceptedCurrentVersion:boolean}|null>(null);
const history=ref<{id:number;status:string;actorId:number;createdAt:string}[]>([]);
async function load(){error.value='';try{items.value=await listVerifications();}catch(e){error.value=errorMessage(e);}}
async function review(item:TechnicianVerification){selected.value=item;reason.value='';identityChecked.value=item.identityChecked;emailChecked.value=item.emailChecked;phoneChecked.value=item.phoneChecked;tradeChecked.value=item.tradeChecked;history.value=[];terms.value=null;try{terms.value=await request(`/api/technician-terms/${item.technicianId}`);history.value=await request(`/api/admin/technician-verifications/${item.technicianId}/history`);}catch(e){error.value=errorMessage(e);}}
async function decide(status:string){if(!selected.value)return;busy.value=true;error.value='';try{await decideVerification(selected.value.technicianId,{status,reason:reason.value,version:selected.value.version,identityChecked:identityChecked.value,emailChecked:emailChecked.value,phoneChecked:phoneChecked.value,tradeChecked:tradeChecked.value});selected.value=undefined;await load();}catch(e){error.value=errorMessage(e);}finally{busy.value=false;}}
onMounted(load);
</script>
<template><section class="dashboard-card"><h1>{{t('Technician verification')}}</h1><p>{{t('Reviewers must perform and record real manual checks. Contact checks are not automated email or SMS verification.')}}</p>
 <p v-if="error" role="alert">{{error}}</p><button :disabled="busy" @click="load">{{t('Refresh')}}</button>
 <ul><li v-for="item in items" :key="item.technicianId"><button :disabled="busy" @click="review(item)">#{{item.technicianId}} · {{item.email}} · {{t(item.status)}}</button></li></ul>
 <form v-if="selected" class="draft-form" @submit.prevent="decide('verified')"><h2>{{t('Manual review')}}</h2>
 <p>{{selected.email}} · {{selected.phone}}</p><p>{{selected.trades}}</p><p>{{selected.experience}}</p><p>{{selected.qualifications}}</p>
 <p>{{t('Professional terms are separate from a site contract.')}}</p><p v-if="terms">{{t('Professional terms')}}: {{terms.currentVersion || t('Not configured')}} � {{t(terms.acceptedCurrentVersion ? 'Accepted' : 'Not accepted')}} � {{t(terms.enforcementRequired ? 'Required' : 'Optional')}} <a v-if="terms.documentUrl" :href="terms.documentUrl" target="_blank" rel="noopener noreferrer">{{t('View terms')}}</a></p><p v-else>{{t('Professional terms status unavailable.')}}</p>
 <fieldset :disabled="busy"><label><input v-model="identityChecked" type="checkbox" />{{t('Identity manually checked')}}</label><label><input v-model="emailChecked" type="checkbox" />{{t('Contact email manually checked')}}</label><label><input v-model="phoneChecked" type="checkbox" />{{t('Contact phone manually checked')}}</label><label><input v-model="tradeChecked" type="checkbox" />{{t('Trade qualifications manually checked')}}</label>
 <label>{{t('Decision reason')}}<textarea v-model="reason" required maxlength="2000" /></label>
 <template v-if="selected.status==='pending'"><button type="submit" :disabled="!terms || (terms.enforcementRequired && !terms.acceptedCurrentVersion)">{{t('Approve verification')}}</button><button type="button" :disabled="!reason.trim()" @click="decide('rejected')">{{t('Reject')}}</button></template>
 <button v-if="selected.status==='verified'" type="button" :disabled="!reason.trim()" @click="decide('suspended')">{{t('Suspend')}}</button>
 <button v-if="['rejected','suspended'].includes(selected.status)" type="button" :disabled="!reason.trim()" @click="decide('pending')">{{t('Return to review')}}</button></fieldset>
 <h3>{{t('Decision history')}}</h3><ul><li v-for="entry in history" :key="entry.id">{{entry.createdAt}} · {{t(entry.status)}} · #{{entry.actorId}}</li></ul>
 </form></section></template>
