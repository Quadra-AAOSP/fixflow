<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { listTechnicians, rankTechnicians } from '@/services/technician';
import { assignTechnician } from '@/services/maintenance';
import { ApiError, errorMessage } from '@/services/api';
import type { Report } from '@/types/maintenance';
import type { RankingMode, TechnicianRanking, TechnicianSummary } from '@/types/technician';

const props = defineProps<{ report: Report; disabled?: boolean }>();
const emit = defineEmits<{ saved: [report: Report]; busy: [value: boolean] }>();
const { user } = useAuth();
const manager = computed(() => user.value?.role === 'admin' || user.value?.role === 'super_admin');
const allowed = computed(() => (props.report.policy?.canAssign ?? (manager.value || user.value?.role === 'staff')) &&
  !['confirmed', 'resolved_pending_confirmation'].includes(props.report.status));
const directory = ref<TechnicianSummary[]>([]);
const ranking = ref<TechnicianRanking | null>(null);
const mode = ref<RankingMode>('STANDARD');
const selectedId = ref<number | null>(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const directoryError = ref('');
const candidates = computed(() => {
  if (manager.value) return ranking.value?.candidates.map(item => ({ ...item, activeCases: item.activeCases as number | null })) ?? [];
  return directory.value.filter(item => item.availabilityStatus === 'available' &&
    item.contracts.some(contract => contract.siteId === props.report.siteId)).flatMap(item => {
    const skills = item.skills.filter(skill => skill.proficiency >= 1 && skill.proficiency <= 5 && skill.category.toLowerCase() === props.report.category.toLowerCase() &&
      (!props.report.specialty || skill.specialty?.toLowerCase() === props.report.specialty.toLowerCase()));
    if (!skills.length) return [];
    return [{ technicianId: item.id, proficiency: Math.max(...skills.map(skill => skill.proficiency)),
      specialtyMatch: !!props.report.specialty, activeCases: null }];
  });
});
const technicianName = (id: number) => {
  const item = directory.value.find(person => person.id === id);
  return item ? `${item.firstName} ${item.lastName}` : `Technician #${id}`;
};
let generation = 0;
onBeforeUnmount(() => { generation++; });
async function load() {
  const current = ++generation;
  directory.value = []; ranking.value = null; selectedId.value = null; error.value = ''; directoryError.value = '';
  loading.value = false;
  if (!allowed.value) return;
  loading.value = true;
  const results = await Promise.allSettled([listTechnicians(), manager.value ? rankTechnicians(props.report.id, mode.value) : Promise.resolve(null)]);
  if (current !== generation) return;
  if (results[0].status === 'fulfilled') directory.value = results[0].value;
  else directoryError.value = errorMessage(results[0].reason);
  if (results[1].status === 'fulfilled') ranking.value = results[1].value;
  else error.value = errorMessage(results[1].reason);
  loading.value = false;
}
watch([() => props.report.id, () => props.report.siteId, () => props.report.category, () => props.report.specialty, () => allowed.value, () => user.value?.id, () => user.value?.role], load, { immediate: true });
async function assign() {
  const id = selectedId.value;
  if (!allowed.value || loading.value || saving.value || props.disabled || !candidates.value.some(item => item.technicianId === id)) return;
  const current = generation;
  saving.value = true; emit('busy', true); error.value = '';
  try {
    const saved = await assignTechnician(props.report.id, id!);
    if (current === generation) { emit('saved', saved); await load(); }
  } catch (err) {
    if (current !== generation) return;
    const message = errorMessage(err);
    if (err instanceof ApiError && err.status === 409) {
      const reloading = generation + 1;
      await load();
      if (generation === reloading) error.value = message;
    } else error.value = message;
  } finally { saving.value = false; emit('busy', false); }
}
</script>

<template>
  <section v-if="allowed" class="detail-section">
    <div class="card-heading"><h2>{{ report.assignedTechnicianId ? 'Reassign technician' : 'Assign a technician' }}</h2><button type="button" class="text-action" :disabled="loading || saving || disabled" @click="load">Refresh candidates</button></div>
    <label v-if="manager" class="ranking-mode">Ranking method<select v-model="mode" :disabled="loading || saving || disabled" @change="load"><option value="STANDARD">Standard</option><option value="AI">AI assisted</option></select></label>
    <p v-if="ranking" class="dialog-intro">Requested: {{ ranking.requestedMode }} · Method used: {{ ranking.methodUsed }}</p>
    <p v-if="ranking?.fallbackReason" class="draft-notice" role="status">{{ ranking.fallbackReason }}</p>
    <p v-if="!manager" class="dialog-intro">Available technicians with a contract and matching trade are shown. The service checks current terms when you assign. Ranking and workload counts require administrator access.</p>
    <p v-if="error" class="live-error" role="alert">{{ error }}</p><p v-if="directoryError" class="live-error" role="alert">Directory: {{ directoryError }}</p>
    <p v-if="loading" role="status">Loading contracted candidates…</p>
    <p v-else-if="!error && !directoryError && !candidates.length">No matching available contracted technicians were returned. Refresh after a contract, skill, availability, or terms update.</p>
    <form v-else-if="candidates.length" @submit.prevent="assign"><fieldset :disabled="loading || saving || disabled" class="candidate-options">
      <legend class="sr-only">Choose a technician</legend>
      <label v-for="item in candidates" :key="item.technicianId" class="candidate-option"><input v-model="selectedId" type="radio" name="technician" :value="item.technicianId" required /><span><strong>{{ technicianName(item.technicianId) }}</strong><small>Account #{{ item.technicianId }} · Proficiency {{ item.proficiency }}/5<template v-if="item.specialtyMatch"> · Specialty match</template><template v-if="item.activeCases !== null"> · {{ item.activeCases }} active cases at this site</template></small></span></label>
      <button type="submit" class="report-issue-button" :disabled="selectedId === null">{{ saving ? 'Saving assignment…' : 'Save assignment' }}</button>
    </fieldset></form>
  </section>
</template>

<style scoped>
.ranking-mode{display:flex;align-items:center;gap:12px;margin:16px 0;font-size:13px}.ranking-mode select{border:1px solid #dfe8e2;border-radius:8px;padding:8px 12px}.candidate-options{display:grid;gap:12px;margin-top:16px}.candidate-option{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #dfe8e2;border-radius:12px}.candidate-option small{display:block;margin-top:5px;color:#62778a;line-height:1.6}.candidate-options button{justify-self:start}
</style>
