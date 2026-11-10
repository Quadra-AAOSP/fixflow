<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { request, errorMessage } from '@/services/api';
import { useAuth } from '@/composables/useAuth';
const { user } = useAuth();
const rows = ref<{siteId:number; status:string; expiresAt:string|null}[]>([]); const error = ref('');
onMounted(async () => { try { const contracts = await request<{siteId:number}[]>('/api/technician-contracts'); rows.value = await Promise.all(contracts.map(async c => { const result = await request<{status:string;review:{expiresAt:string|null}|null}>(`/api/sites/${c.siteId}/technicians/${user.value?.id}/vetting`); return {siteId:c.siteId,status:result.status,expiresAt:result.review?.expiresAt ?? null}; })); } catch(e) { error.value=errorMessage(e); } });
</script>
<template><section class="contract-choice"><h2>Site vetting</h2><p>Site approval is required before work and is separate from platform verification, terms and contracts. Contact your site administrator to request a review.</p><p v-if="error" role="alert">{{ error }}</p><p v-for="row in rows" :key="row.siteId">Site #{{ row.siteId }}: {{ row.status }} <span v-if="row.expiresAt"> · expires {{ new Date(row.expiresAt).toLocaleDateString() }}</span></p><p v-if="!rows.length && !error">No site reviews to display.</p></section></template>
