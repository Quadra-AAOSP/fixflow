<script setup lang="ts">
import LoadingStatus from "@/components/ui/LoadingStatus.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useLocale } from "@/i18n";
import { useAuth } from "@/composables/useAuth";
import {
  listManagedProducts,
  getManagedProduct,
  saveManagedProduct,
  deactivateManagedProduct,
  type ManagedProduct,
  type ProductDraft,
} from "@/services/shopAdmin";
import { errorMessage } from "@/services/api";
import { safeImageUrl } from "@/services/shop";
const { user } = useAuth();
const { t } = useLocale();
const allowed = computed(() =>
  ["shop_manager", "super_admin"].includes(user.value?.role ?? ""),
);
const products = ref<ManagedProduct[]>([]);
const loading = ref(false);
const busy = ref(false);
const error = ref("");
const message = ref("");
const search = ref("");
const editing = ref(false);
const formOpen = ref(false);
const deactivate = ref<ManagedProduct | null>(null);
const blank = (): ProductDraft => ({
  id: "",
  name: "",
  description: "",
  category: "",
  brand: null,
  imageUrl: null,
  priceMinor: 0,
  stock: 0,
  active: false,
});
const draft = ref(blank());
const editor = ref<HTMLFormElement>();
const confirmation = ref<HTMLElement>();
const tableWrap = ref<HTMLElement>();
const tableOverflow = ref(false);
let tableObserver: ResizeObserver | undefined;
function observeTable() {
  tableObserver?.disconnect();
  const element = tableWrap.value;
  if (!element) { tableOverflow.value = false; return; }
  const measure = () => { tableOverflow.value = element.scrollWidth > element.clientWidth + 1; };
  if (typeof ResizeObserver !== "undefined") {
    tableObserver = new ResizeObserver(measure);
    tableObserver.observe(element);
  }
  measure();
}

async function focusEditor() {
  await nextTick();
  editor.value
    ?.querySelector<HTMLInputElement>("input:not([readonly])")
    ?.focus();
}
async function requestDeactivation(product: ManagedProduct) {
  if (busy.value || loading.value) return;
  deactivate.value = product;
  formOpen.value = false;
  await nextTick();
  confirmation.value?.focus();
}
const visible = computed(() =>
  products.value.filter((p) =>
    `${p.id} ${p.name} ${p.category}`
      .toLocaleLowerCase()
      .includes(search.value.trim().toLocaleLowerCase()),
  ),
);
watch([loading, formOpen, visible], async () => { await nextTick(); observeTable(); }, { flush: "post" });
let generation = 0;
onBeforeUnmount(() => { generation++; tableObserver?.disconnect(); });
async function load() {
  if (!allowed.value || busy.value) return;
  const current = ++generation;
  loading.value = true;
  error.value = "";
  try {
    const result = await listManagedProducts();
    if (current === generation) products.value = result;
  } catch (err) {
    if (current === generation) error.value = errorMessage(err);
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function create() {
  if (busy.value || loading.value) return;
  draft.value = blank();
  editing.value = false;
  formOpen.value = true;
  deactivate.value = null;
  error.value = "";
  message.value = "";
  await focusEditor();
}
async function edit(id: string) {
  if (busy.value || loading.value) return;
  const current = ++generation;
  busy.value = true;
  error.value = "";
  message.value = "";
  formOpen.value = false;
  deactivate.value = null;
  try {
    const result = await getManagedProduct(id);
    if (current === generation) {
      draft.value = { ...result };
      editing.value = true;
      formOpen.value = true;
    }
  } catch (err) {
    if (current === generation) error.value = errorMessage(err);
  } finally {
    if (current === generation) {
      busy.value = false;
      if (formOpen.value) await focusEditor();
    }
  }
}
async function save() {
  if (!allowed.value || busy.value) return;
  const current = ++generation;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    const result = await saveManagedProduct(draft.value, editing.value);
    if (current !== generation) return;
    products.value = [
      result,
      ...products.value.filter((p) => p.id !== result.id),
    ];
    formOpen.value = false;
    message.value = "Product saved.";
  } catch (err) {
    if (current === generation) error.value = errorMessage(err);
  } finally {
    if (current === generation) busy.value = false;
  }
}
async function confirmDeactivation() {
  if (!allowed.value || busy.value || !deactivate.value) return;
  const current = ++generation;
  const id = deactivate.value.id;
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    await deactivateManagedProduct(id);
    if (current !== generation) return;
    products.value = products.value.map((p) =>
      p.id === id ? { ...p, active: false } : p,
    );
    deactivate.value = null;
    message.value = "Product deactivated. Existing orders are unchanged.";
  } catch (err) {
    if (current === generation) error.value = errorMessage(err);
  } finally {
    if (current === generation) busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <section v-if="allowed" class="product-admin live-page">
    <div class="product-admin-heading">
      <div>
        <h1>{{ t("Product management") }}</h1>
        <p>{{ t("Manage the live catalogue, prices and stock.") }}</p>
      </div>
      <button type="button" :disabled="busy || loading" @click="create">
        {{ t("New product") }}
      </button>
    </div>
    <p v-if="error" role="alert" class="product-error">
      {{ t(error) }}
      <button type="button" :disabled="busy || loading" @click="load">
        {{ t("Refresh") }}
      </button>
    </p>
    <p v-if="message" role="status">{{ t(message) }}</p>
    <div class="catalogue-workspace" :class="{ editing: formOpen }">
      <aside v-if="formOpen" class="catalogue-editor">
        <form
          ref="editor"
          v-if="formOpen"
          class="product-form"
          @submit.prevent="save"
        >
          <h2>{{ t(editing ? "Edit product" : "New product") }}</h2>
          <fieldset :disabled="busy">
            <label
              >{{ t("Product code")
              }}<input
                v-model="draft.id"
                required
                maxlength="64"
                aria-describedby="product-code-hint"
                :readonly="editing"
            /></label>
            <p id="product-code-hint">{{ t("Use a unique code of up to 64 characters, such as adjustable-wrench. It cannot be changed after creation.") }}</p>
            <label
              >{{ t("Product name")
              }}<input v-model="draft.name" required maxlength="255"
            /></label>
            <label
              >{{ t("Description")
              }}<textarea v-model="draft.description" required rows="4" />
            </label>
            <label
              >{{ t("Category")
              }}<input
                v-model="draft.category"
                required
                maxlength="128"
                list="product-categories" /><datalist id="product-categories">
                <option
                  v-for="category in [
                    ...new Set(products.map((p) => p.category)),
                  ]"
                  :key="category"
                  :value="category"
                /></datalist
            ></label>
            <label
              >{{ t("Brand (optional)")
              }}<input v-model="draft.brand" maxlength="128"
            /></label>
            <label
              >{{ t("Image URL (HTTPS, optional)")
              }}<input v-model="draft.imageUrl" type="url" maxlength="1024" aria-describedby="product-image-hint"
            /></label>
            <p id="product-image-hint">{{ t("Use a direct HTTPS image URL. The image must be viewable in a browser; no file extension is required. Leave blank for the image fallback.") }}</p>
            <label
              >{{ t("Price (minor units)")
              }}<input
                v-model.number="draft.priceMinor"
                required
                type="number"
                min="0"
                max="2147483647"
                step="1"
            /></label>
            <p>
              {{
                t(
                  "Enter the integer amount in the shop currency’s smallest unit. Currency is configured by the backend.",
                )
              }}
            </p>
            <label
              >{{ t("Stock")
              }}<input
                v-model.number="draft.stock"
                required
                type="number"
                min="0"
                max="2147483647"
                step="1"
            /></label>
            <label class="product-checkbox"
              ><input v-model="draft.active" type="checkbox" aria-describedby="product-visibility-hint" />{{
                t("Visible in catalogue")
              }}</label
            >
            <p id="product-visibility-hint">{{ t("Hidden products remain in product management but do not appear in the customer catalogue.") }}</p>
            <div class="product-actions">
              <button type="submit">
                {{ t(busy ? "Saving…" : "Save product") }}</button
              ><button type="button" @click="formOpen = false">
                {{ t("Cancel") }}
              </button>
            </div>
          </fieldset>
        </form>
      </aside>
      <section class="catalogue-inventory">
        <section
          ref="confirmation"
          v-if="deactivate"
          tabindex="-1"
          role="region"
          :aria-label="t('Confirm product deactivation')"
          class="product-confirm"
        >
          <p>
            {{
              t(
                "Deactivate {name}? It will no longer appear in the shop. You can reactivate it by editing the product.",
                { name: deactivate.name },
              )
            }}
          </p>
          <div class="product-actions">
            <button type="button" :disabled="busy" @click="confirmDeactivation">
              {{ t("Confirm deactivation") }}</button
            ><button type="button" :disabled="busy" @click="deactivate = null">
              {{ t("Cancel") }}
            </button>
          </div>
        </section>
        <div class="product-list-heading">
          <label class="product-search"
            >{{ t("Search products")
            }}<input
              v-model="search"
              type="search"
              :placeholder="t('Search by name, ID or category')" /></label
          ><span v-if="!loading && !error" role="status">{{
            t(visible.length === 1 ? "{count} product" : "{count} products", {
              count: visible.length,
            })
          }}</span>
        </div>
        <LoadingStatus v-if="loading" :label="t('Loading products…')" />
        <div
          v-else
          ref="tableWrap"
          class="product-table-wrap"
          role="region"
          tabindex="0"
          :aria-label="t('Product management')"
        >
          <p v-if="tableOverflow" class="table-scroll-hint">{{ t("Scroll horizontally to see all columns.") }}</p>
          <table class="product-table">
            <caption>
              {{
                t("Product management")
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ t("Product name") }}</th>
                <th scope="col">{{ t("Category") }}</th>
                <th scope="col">{{ t("Price (minor units)") }}</th>
                <th scope="col">{{ t("Stock") }}</th>
                <th scope="col">{{ t("Status") }}</th>
                <th scope="col">{{ t("Actions") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in visible" :key="product.id">
                <th scope="row">
                  <div class="product-name-cell">
                    <img
                      v-if="safeImageUrl(product.imageUrl)"
                      :src="safeImageUrl(product.imageUrl)!"
                      alt=""
                      loading="lazy"
                    /><span
                      >{{ product.name }}<small>{{ product.id }}</small></span
                    >
                  </div>
                </th>
                <td>{{ product.category }}</td>
                <td>{{ product.priceMinor }}</td>
                <td>{{ product.stock }}</td>
                <td>
                  <span
                    class="product-status"
                    :class="{ active: product.active }"
                    >{{ t(product.active ? "Active" : "Inactive") }}</span
                  >
                </td>
                <td>
                  <div class="product-actions">
                    <button
                      type="button"
                      :disabled="busy"
                      @click="edit(product.id)"
                    >
                      {{ t("Edit") }}</button
                    ><button
                      v-if="product.active"
                      type="button"
                      :disabled="busy"
                      @click="requestDeactivation(product)"
                    >
                      {{ t("Deactivate") }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!visible.length && !error">
            {{
              t(
                products.length
                  ? "No matching products."
                  : "No products yet. Add a product to get started.",
              )
            }}
          </p>
        </div>
      </section>
    </div>
  </section>
</template>
<style scoped>
.table-scroll-hint { display: block; color: #52677b; font-size: 13px; margin: 8px 0; }

.product-admin {
  color: var(--navy);
}
.product-admin h1 {
  font-size: 26px;
  font-weight: 750;
}
.product-admin h2 {
  font-size: 18px;
  font-weight: 650;
}
.product-admin-heading,
.product-actions {
  display: flex;
  gap: 14px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}
.product-admin p {
  font-size: 13px;
  line-height: 1.7;
  margin: 12px 0;
}
.product-admin button {
  padding: 10px 16px;
  background: #79e2cd;
  color: #173e35;
  border-radius: 8px;
  font-size: 14px;
}
.product-admin button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.product-form,
.product-confirm {
  padding: 22px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  margin: 20px 0;
}
.product-form fieldset {
  display: grid;
  gap: 16px;
}
.product-admin label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
.product-admin input,
.product-admin textarea {
  min-width: 0;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #b6c8bf;
  border-radius: 8px;
  background: #fff;
}
.product-form .product-checkbox {
  display: flex;
  align-items: center;
}
.product-checkbox input {
  width: auto;
}
.product-admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
  gap: 18px;
  margin-top: 20px;
}
.product-admin-grid article {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 20px;
  overflow-wrap: anywhere;
}
.product-admin-grid img {
  width: 100%;
  height: 150px;
  object-fit: contain;
}
.product-admin dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  font-size: 13px;
  margin: 16px 0;
}
.product-error {
  color: #a0434d;
}
.product-search {
  margin-top: 22px;
  max-width: 420px;
}
.product-table-wrap {
  overflow: auto;
  max-height: clamp(240px, 55dvh, 560px);
  max-width: 100%;
  scrollbar-gutter: stable;
  margin-top: 20px;
}
.product-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 700px;
  font-size: 14px;
  text-align: left;
}
.product-table caption {
  text-align: left;
  font-weight: 700;
  padding: 12px;
}
.product-table th,
.product-table td {
  padding: 14px 12px;
  border-bottom: 1px solid #d9e5dc;
  vertical-align: middle;
}
.product-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f5f8f5;
}
.product-name-cell {
  display: flex;
  gap: 12px;
  align-items: center;
}
.product-name-cell img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.product-name-cell small {
  display: block;
  font-weight: 400;
  color: #52677b;
}
.product-table .product-actions {
  justify-content: flex-start;
}

.product-admin {
  max-width: 1200px;
  margin: 0 auto;
}
.product-admin-heading {
  padding: 24px;
  border: 1px solid #fbefe0;
  border-radius: 15px;
  background: #fff9f1;
}
.product-admin-heading p {
  margin: 5px 0 0;
  color: #52677b;
}
.product-list-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  color: #52677b;
}
.product-search {
  flex: 1;
}
.product-table-wrap {
  border: 1px solid #e9edf0;
  border-radius: 11px;
  background: #fff;
}
.product-table caption {
  padding: 18px;
  color: #152742;
}
.product-table th,
.product-table td {
  padding: 16px 14px;
}
.product-table-wrap > p {
  padding: 12px 18px;
  color: #52677b;
}
.product-status {
  display: inline-block;
  border-radius: 20px;
  padding: 5px 10px;
  background: #f0f2f4;
  color: #52677b;
  font-size: 12px;
  font-weight: 600;
}
.product-status.active {
  background: #d3f6ef;
  color: #006f65;
}
.product-form fieldset {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.product-form label:has(textarea),
.product-form fieldset > p,
.product-form .product-actions {
  grid-column: 1/-1;
}
.product-form h2 {
  margin-bottom: 18px;
}
.product-form fieldset > p {
  margin: 0;
  color: #52677b;
}
.product-error,
[role="status"] {
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .product-form fieldset {
    grid-template-columns: 1fr;
  }
  .product-list-heading {
    align-items: start;
    flex-direction: column;
    gap: 8px;
  }
  .product-search {
    width: 100%;
  }
}

.product-admin.dashboard-card {
  max-width: none;
  margin: 0;
  padding: 24px;
}
.product-admin button {
  min-height: 44px;
  font-size: 14px;
}
@media (max-width: 650px) {
  .product-admin.dashboard-card {
    padding: 20px 16px;
  }
}

.catalogue-workspace {
  display: grid;
  gap: 24px;
  margin-top: 24px;
  align-items: start;
}
.catalogue-workspace.editing {
  grid-template-columns: minmax(300px, 0.85fr) minmax(0, 1.4fr);
}
.catalogue-editor {
  min-width: 0;
  position: sticky;
  top: 20px;
}
.catalogue-inventory {
  min-width: 0;
  border: 1px solid #dce5e4;
  border-radius: 14px;
  background: white;
  padding: 24px;
}
.product-admin-heading {
  padding: 0 0 24px;
  border: 0;
  border-bottom: 1px solid #dce5e4;
  border-radius: 0;
  background: transparent;
}
.product-admin h1 {
  font-size: 30px;
  letter-spacing: -0.035em;
}
.product-form {
  margin: 0;
  border-color: #dce5e4;
}
.product-form fieldset {
  grid-template-columns: 1fr;
}
.product-list-heading {
  align-items: center;
}
.product-search {
  margin-top: 0;
}
.product-table-wrap {
  margin-top: 24px;
  border: 0;
  border-radius: 0;
}
.product-table caption {
  padding-left: 0;
}
.product-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f1f6f4;
}
@media (max-width: 1100px) {
  .catalogue-workspace.editing {
    grid-template-columns: 1fr;
  }
  .catalogue-editor {
    position: static;
  }
}
@media (max-width: 650px) {
  .catalogue-inventory {
    padding: 16px;
  }
}
</style>

<style scoped>
.product-table-wrap:focus-visible{outline:3px solid #368575;outline-offset:3px}
.product-table-wrap::-webkit-scrollbar{height:12px}
.product-table-wrap::-webkit-scrollbar-track{background:#eef4f1}
.product-table-wrap::-webkit-scrollbar-thumb{background:#52766b;border:3px solid #eef4f1;border-radius:8px}
</style>
