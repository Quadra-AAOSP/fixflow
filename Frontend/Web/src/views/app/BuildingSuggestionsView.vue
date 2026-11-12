<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useMaintenanceStore } from "@/stores/maintenance";
import { requestSubsiteAddition } from "@/services/maintenance";
import { errorMessage } from "@/services/api";
import { useLocale } from "@/i18n";
const { t } = useLocale();
const auth = useAuthStore();
const data = useMaintenanceStore();
const site = computed(() =>
  data.sites.find((item) => item.id === auth.user?.siteId),
);
const note = ref("");
const busy = ref(false);
const error = ref("");
const receipts = ref<
  Array<{ id: number; siteId: number; status: string; note: string }>
>([]);
let generation = 0;
onBeforeUnmount(() => generation++);
async function submit() {
  if (busy.value || !auth.user?.siteId || !note.value.trim()) return;
  const current = generation;
  const description = note.value.trim();
  busy.value = true;
  error.value = "";
  try {
    const result = await requestSubsiteAddition(auth.user.siteId, description);
    if (current !== generation) return;
    receipts.value.unshift({ ...result, note: description });
    note.value = "";
  } catch (err) {
    if (current === generation) error.value = errorMessage(err);
  } finally {
    if (current === generation) busy.value = false;
  }
}
</script>
<template>
  <section class="ff-suggestions">
    <header class="ff-page-heading">
      <div>
        <p class="ff-context">{{ site?.name || t("Your account site") }}</p>
        <h1>{{ t("My building suggestions") }}</h1>
        <p>
          {{
            t(
              "Tell your site administrator about a building missing from the report form.",
            )
          }}
        </p>
      </div>
    </header>
    <section class="ff-surface suggestion-editor">
      <header>
        <h2>{{ t("Suggest a building") }}</h2>
        <p>{{ t("Describe the missing location") }}</p>
      </header>
      <form @submit.prevent="submit">
        <fieldset :disabled="busy || !auth.user?.siteId">
          <label for="missing-building">{{
            t("Missing building details")
          }}</label
          ><textarea
            id="missing-building"
            v-model="note"
            required
            maxlength="1000"
            rows="5"
          />
          <p v-if="error" role="alert" class="ff-alert">{{ t(error) }}</p>
          <footer>
            <p>{{ t("You can have one pending suggestion per site.") }}</p>
            <button class="ff-primary" :disabled="!note.trim()">
              {{ t(busy ? "Saving…" : "Submit suggestion") }}
            </button>
          </footer>
        </fieldset>
      </form>
    </section>
    <section v-if="receipts.length" class="ff-surface">
      <header class="ff-section-heading">
        <h2>{{ t("Submitted this visit") }}</h2>
      </header>
      <ul class="suggestion-receipts">
        <li v-for="item in receipts" :key="item.id">
          <div>
            <strong>#{{ item.id }}</strong
            ><span>{{ t(item.status) }}</span>
          </div>
          <p>{{ item.note }}</p>
        </li>
      </ul>
    </section>
    <p class="ff-notice">
      {{
        t(
          "Earlier suggestions are not available here. Your submitted requests remain saved.",
        )
      }}
    </p>
  </section>
</template>
<style scoped>
.ff-suggestions {
  max-width: 1000px;
}
.suggestion-editor {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  padding: 28px;
  gap: 36px;
}
.suggestion-editor h2 {
  font-size: 16px;
  font-weight: 650;
}
.suggestion-editor header p {
  font-size: 12px;
  color: #718079;
  margin-top: 9px;
  line-height: 1.7;
}
.suggestion-editor fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
.suggestion-editor label {
  font-weight: 600;
  font-size: 12px;
  display: block;
  margin-bottom: 10px;
}
.suggestion-editor textarea {
  width: 100%;
  border: 1px solid #cddbd3;
  border-radius: 7px;
  padding: 12px;
  background: #fafcfb;
  font-size: 13px;
  resize: vertical;
}
.suggestion-editor footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-top: 18px;
}
.suggestion-editor footer p {
  font-size: 11px;
  color: #75847c;
  max-width: 190px;
  line-height: 1.6;
}
.suggestion-receipts {
  list-style: none;
  padding: 0 24px 16px;
}
.suggestion-receipts li {
  padding: 16px 0;
  border-top: 1px solid #e5ece7;
}
.suggestion-receipts li div {
  display: flex;
  gap: 12px;
  font-size: 12px;
}
.suggestion-receipts span {
  color: #006f65;
}
.suggestion-receipts p {
  margin-top: 8px;
  font-size: 13px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.ff-suggestions > .ff-surface + .ff-surface {
  margin-top: 24px;
}
@media (max-width: 800px) {
  .suggestion-editor {
    grid-template-columns: 1fr;
    gap: 22px;
    padding: 20px;
  }
  .suggestion-editor footer {
    flex-wrap: wrap;
  }
}
</style>
