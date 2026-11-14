<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { useLocale } from "@/i18n";
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { MapPin, Plus, X } from "@lucide/vue";
import { useAuth } from "@/composables/useAuth";
import { useMaintenanceStore } from "@/stores/maintenance";
import { createSite, updateSite } from "@/services/maintenance";
import { errorMessage } from "@/services/api";
import { humanize } from "@/utils/maintenance";
import type { Site, SitePayload } from "@/types/maintenance";
const { t } = useLocale();
const { user } = useAuth();
const data = useMaintenanceStore();
const router = useRouter();
const editor = ref<HTMLDialogElement>();
const editingId = ref<number | null>(null);
const busy = ref(false);
const sort = ref("name");
const sortedSites = computed(() =>
  [...data.sites].sort((a, b) => {
    const left = sort.value === "location" ? a.address?.trim() : a.name;
    const right = sort.value === "location" ? b.address?.trim() : b.name;
    if (!left) return right ? 1 : a.name.localeCompare(b.name);
    if (!right) return -1;
    return (
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      }) || a.name.localeCompare(b.name)
    );
  }),
);
const error = ref("");
const form = reactive({
  name: "",
  type: "" as Site["type"] | "",
  contractStatus: "" as Site["contractStatus"] | "",
  address: "",
  description: "",
  imageUrl: "",
  contractFlatFee: "",
  contractFeeCurrency: "USD",
});
function formatFee(minor: number | null | undefined, currency = "USD") {
  if (minor == null) return t("Not set");
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(minor / 100);
}
const canCreate = computed(
  () =>
    user.value?.capabilities?.createSite ?? user.value?.role === "super_admin",
);
const canEdit = computed(
  () =>
    user.value?.capabilities?.editSite ??
    (canCreate.value || user.value?.role === "admin"),
);
async function viewReports(id: number) {
  await data.selectSite(id);
  await router.push("/reports");
}
const imageUrl = (value: string | null) =>
  value && /^https?:\/\//i.test(value) ? value : undefined;
function edit(site?: Site) {
  editingId.value = site?.id ?? null;
  error.value = "";
  Object.assign(form, {
    name: site?.name ?? "",
    type: site?.type ?? "",
    contractStatus: site?.contractStatus ?? "",
    address: site?.address ?? "",
    description: site?.description ?? "",
    imageUrl: site?.imageUrl ?? "",
    contractFlatFee:
      site?.contractFlatFeeMinor == null
        ? ""
        : (site.contractFlatFeeMinor / 100).toFixed(2),
    contractFeeCurrency: site?.contractFeeCurrency ?? "USD",
  });
  editor.value?.showModal();
}
async function save() {
  if (busy.value) return;
  error.value = "";
  if (!form.name.trim() || !form.type || !form.contractStatus) {
    error.value = "Enter a name, site type, and contract status.";
    return;
  }
  if (form.imageUrl && !imageUrl(form.imageUrl.trim())) {
    error.value = "Use an HTTP or HTTPS image URL.";
    return;
  }
  const feeMajor = form.contractFlatFee.trim();
  let contractFlatFeeMinor: number | null = null;
  if (feeMajor) {
    const parsed = Number(feeMajor);
    if (!Number.isFinite(parsed) || parsed < 0) {
      error.value = "Enter a valid non-negative contract flat fee.";
      return;
    }
    contractFlatFeeMinor = Math.round(parsed * 100);
  }
  const currency = form.contractFeeCurrency.trim().toUpperCase() || "USD";
  if (currency.length < 3 || currency.length > 8) {
    error.value = "Use a currency code between 3 and 8 characters.";
    return;
  }
  const payload: SitePayload = {
    name: form.name.trim(),
    type: form.type,
    contractStatus: form.contractStatus,
    address: form.address.trim() || null,
    description: form.description.trim() || null,
    imageUrl: form.imageUrl.trim() || null,
    contractFlatFeeMinor,
    contractFeeCurrency: currency,
  };
  busy.value = true;
  try {
    if (editingId.value != null) await updateSite(editingId.value, payload);
    else await createSite(payload);
    editor.value?.close();
    await data.refresh();
  } catch (err) {
    error.value = errorMessage(err);
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="sites-page live-page">
    <header class="operation-header">
      <div>
        <h1>{{ t(user?.role === 'reporter' ? 'My site' : 'Sites') }}</h1>
        <p>{{ t(user?.role === 'reporter' ? 'Your reporting site and buildings' : 'Manage site information and buildings') }}</p>
      </div>
      <button
        v-if="canCreate"
        class="report-issue-button"
        type="button"
        @click="edit()"
      >
        <Plus :size="19" />{{ t("Add site") }}
      </button>
    </header>
    <section v-if="sortedSites.length > 1" class="sites-toolbar" :aria-label="t('Site list controls')">
      <p>{{ t("{count} sites", { count: sortedSites.length }) }}</p>
      <label class="site-sort"
        >{{ t("Sort sites by") }}
        <select v-model="sort">
          <option value="name">{{ t("Name") }}</option>
          <option value="location">{{ t("Location") }}</option>
        </select>
      </label>
    </section>
    <section
      v-if="data.sites.length"
      class="site-list"
      :aria-label="t('Sites')"
    >
      <article
        v-for="site in sortedSites"
        :key="site.id"
        class="dashboard-card site-record"
      >
        <div class="site-record-image">
          <img
            v-if="imageUrl(site.imageUrl)"
            :src="imageUrl(site.imageUrl)"
            :alt="site.name"
            loading="lazy"
          />
          <div v-else class="site-image-placeholder"><MapPin :size="28" /></div>
        </div>
        <div class="site-record-content">
          <div class="site-record-heading">
            <h2>{{ site.name }}</h2>
            <span class="status-badge mint">{{ t(humanize(site.type)) }}</span>
          </div>
          <p>{{ site.description || t("No description provided.") }}</p>
          <p class="site-record-address">
            {{ site.address || t("No address provided.") }}
          </p>
          <p v-if="canEdit" class="site-record-meta">
            {{
              t("Technician pool: {status} · Site ID: {id}", {
                status: t(site.contractStatus === "contracted" ? "Site-contracted technicians" : "Open technician pool"),
                id: site.id,
              })
            }}
          </p>
          <p v-if="canEdit" class="site-record-meta">
            {{
              t("Contract flat fee: {fee}", {
                fee: formatFee(site.contractFlatFeeMinor, site.contractFeeCurrency),
              })
            }}
          </p>
        </div>
        <nav
          class="site-record-actions"
          :aria-label="t('Actions for {site}', { site: site.name })"
        >
          <RouterLink
            class="text-action"
            :to="{ name: 'site-detail', params: { siteId: site.id } }"
            >{{ t("Site details") }} →</RouterLink
          >
          <button
            class="text-action"
            type="button"
            :disabled="data.loading"
            @click="viewReports(site.id)"
          >
            {{ t("View reports") }} →
          </button>
          <RouterLink
            class="text-action"
            :to="{ name: 'subsites', params: { siteId: site.id } }"
            >{{
              t(canEdit ? "Manage buildings" : "View buildings")
            }}
            →</RouterLink
          >
          <button
            v-if="canEdit"
            class="text-action"
            type="button"
            @click="edit(site)"
          >
            {{ t("Edit site") }}
          </button>
        </nav>
      </article>
    </section>
    <LoadingStatus v-else-if="data.loading" :label="t('Loading sites…')" />
    <section
      v-else-if="canCreate && !data.sitesError"
      class="dashboard-card sites-empty"
    >
      <MapPin :size="28" />
      <h2>{{ t("Start with your first site") }}</h2>
      <p>
        {{
          t(
            "Add a site to start collecting and organizing maintenance reports.",
          )
        }}
      </p>
      <button class="report-issue-button" type="button" @click="edit()">
        <Plus :size="18" />{{ t("Add site") }}
      </button>
    </section>
    <p v-else-if="data.sitesError" class="live-error" role="alert">
      {{ t(data.sitesError) }}
      <button type="button" @click="data.refresh()">{{ t("Retry") }}</button>
    </p>
  </section>
  <dialog
    ref="editor"
    class="dashboard-dialog site-editor"
    :aria-label="t('Site editor')"
    @cancel="
      (event) => {
        if (busy) event.preventDefault();
      }
    "
  >
    <div class="dialog-heading">
      <h2>{{ t(editingId == null ? "Add site" : "Edit site") }}</h2>
      <button
        :disabled="busy"
        class="icon-button"
        :aria-label="t('Close site editor')"
        @click="editor?.close()"
      >
        <X :size="22" />
      </button>
    </div>
    <form class="draft-form" @submit.prevent="save">
      <p v-if="error" class="live-error" role="alert">{{ t(error) }}</p>
      <fieldset :disabled="busy" class="report-fields">
        <label
          >{{ t("Site name")
          }}<input v-model="form.name" maxlength="255" required
        /></label>
        <div class="form-two-columns">
          <label
            >{{ t("Site type")
            }}<select v-model="form.type" required>
              <option disabled value="">{{ t("Choose a type") }}</option>
              <option value="school">{{ t("School") }}</option>
              <option value="hostel">{{ t("Hostel") }}</option>
              <option value="hotel">{{ t("Hotel") }}</option>
            </select></label
          ><label
            >{{ t("Technician pool")
            }}<select v-model="form.contractStatus" required>
              <option disabled value="">{{ t("Choose a status") }}</option>
              <option value="contracted">{{ t("Site-contracted technicians") }}</option>
              <option value="uncontracted">{{ t("Open technician pool") }}</option>
            </select></label
          >
        </div>
        <label
          >{{ t("Address (optional)")
          }}<input v-model="form.address" maxlength="512" /></label
        ><label
          >{{ t("Description (optional)")
          }}<textarea v-model="form.description" rows="3" /></label
        ><label
          >{{ t("Image URL (optional)")
          }}<input v-model="form.imageUrl" type="url" maxlength="1024"
        /></label>
        <div class="form-two-columns">
          <label
            >{{ t("Contract flat fee")
            }}<input
              v-model="form.contractFlatFee"
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              :placeholder="t('Required before signing technicians')"
          /></label>
          <label
            >{{ t("Fee currency")
            }}<input
              v-model="form.contractFeeCurrency"
              maxlength="8"
              required
          /></label>
        </div>
        <button class="report-issue-button" type="submit" :disabled="busy">
          {{ t(busy ? "Saving…" : "Save site") }}
        </button>
      </fieldset>
    </form>
  </dialog>
</template>

<style scoped>
.sites-page {
  display: grid;
  gap: 20px;
}
.sites-eyebrow {
  color: #006f65;
  font-size: 10px;
  letter-spacing: 0.14em;
  font-weight: 750;
}
.sites-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border: 1px solid #e0e9e3;
  background: #fff;
  border-radius: 14px;
}
.sites-toolbar p {
  margin: 0;
  color: #52677b;
  font-size: 13px;
}
.site-sort {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #52677b;
}
.site-sort select {
  padding: 10px 14px;
  border: 1px solid #dbe5df;
  border-radius: 8px;
  background: #fff;
  color: #152742;
}
.site-list {
  display: grid;
  gap: 16px;
}
.site-record {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 165px;
  align-items: center;
  gap: 20px;
  padding: 20px;
}
.site-record-image,
.site-image-placeholder {
  width: 150px;
  height: 130px;
  border-radius: 14px;
  overflow: hidden;
  background: #eaf3ed;
}
.site-record-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.site-image-placeholder {
  display: grid;
  place-items: center;
  color: #006f65;
}
.site-record-content {
  min-width: 0;
}
.site-record-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.site-record-heading h2 {
  margin: 0;
  font-size: 19px;
  color: #152742;
}
.site-record-content > p {
  margin: 10px 0 0;
  color: #52677b;
  line-height: 1.55;
}
.site-record-meta {
  font-size: 12px;
}
.site-record-actions {
  display: grid;
  justify-items: start;
  gap: 10px;
  border-left: 1px solid #e4ebe6;
  padding-left: 18px;
}
.sites-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 42px 20px;
  text-align: center;
  color: #52677b;
}
.sites-empty h2,
.sites-empty p {
  margin: 0;
}
.site-editor {
  max-width: 680px;
}
@media (max-width: 900px) {
  .site-record {
    grid-template-columns: 110px minmax(0, 1fr);
  }
  .site-record-image,
  .site-image-placeholder {
    width: 110px;
    height: 110px;
  }
  .site-record-actions {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    border-left: 0;
    border-top: 1px solid #e4ebe6;
    padding: 14px 0 0;
  }
}
@media (max-width: 520px) {
  .sites-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
  .site-record {
    grid-template-columns: 1fr;
  }
  .site-record-image,
  .site-image-placeholder {
    width: 100%;
    height: 170px;
  }
}
.sites-page .operation-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:20px;border-bottom:1px solid #dfe7e2}.sites-page .operation-header h1{margin:0 0 8px;font-size:30px;line-height:1.2}.sites-page .operation-header p{margin:0;color:#52677b;line-height:1.6}.sites-page .operation-header>button{flex-shrink:0;min-height:44px}.site-record-actions{gap:14px}@media(max-width:480px){.sites-page .operation-header{align-items:start;flex-wrap:wrap;gap:14px}.sites-page .operation-header h1{font-size:26px}}
</style>
