<script setup lang="ts">
import { useLocale } from '@/i18n';
import { urgencyLabels } from '@/utils/maintenance';
import type { Report } from '@/types/maintenance';
import type { Urgency } from '@/types';
import type { ReportEdit } from '@/services/maintenance';

defineProps<{
  report: Report;
  edit: ReportEdit | null;
  confirmingArchive: boolean;
  canJoin: boolean;
  canLeave: boolean;
  canOverrideUrgency: boolean;
  actionInProgress: boolean;
  busy: boolean;
  overrideUrgency: Urgency;
  overrideReason: string;
}>();

const emit = defineEmits<{
  'begin-edit': [];
  'cancel-edit': [];
  'save-edit': [];
  'update:edit': [value: ReportEdit | null];
  'update:confirmingArchive': [value: boolean];
  'update:overrideUrgency': [value: Urgency];
  'update:overrideReason': [value: string];
  archive: [];
  join: [];
  leave: [];
  'save-override': [];
}>();

const { t } = useLocale();
</script>

<template>
  <section
    v-if="
      report.policy?.canEdit ||
      report.policy?.canDelete ||
      canJoin ||
      canLeave ||
      canOverrideUrgency
    "
    class="ff-surface rd-actions"
  >
    <header class="ff-section-heading">
      <h2>{{ t('Report actions') }}</h2>
    </header>
    <div class="rd-actions-body">
      <div class="rd-action-row">
        <button
          v-if="report.policy?.canEdit && !edit"
          class="ff-secondary"
          type="button"
          :disabled="actionInProgress"
          @click="emit('begin-edit')"
        >
          {{ t('Edit report') }}
        </button>
        <button
          v-if="report.policy?.canDelete && !confirmingArchive"
          class="ff-secondary"
          type="button"
          :disabled="actionInProgress"
          @click="
            emit('update:edit', null);
            emit('update:confirmingArchive', true);
          "
        >
          {{ t('Archive report') }}
        </button>
        <button
          v-if="canJoin"
          class="ff-primary"
          type="button"
          :disabled="actionInProgress"
          @click="emit('join')"
        >
          {{ t(busy ? 'Saving…' : 'This issue affects me too') }}
        </button>
        <button
          v-if="canLeave"
          class="ff-secondary"
          type="button"
          :disabled="actionInProgress"
          @click="emit('leave')"
        >
          {{ t(busy ? 'Leaving…' : 'Leave report') }}
        </button>
      </div>
      <p v-if="canJoin" class="dialog-intro">
        {{
          t(
            'Joining attaches your account to the report and gives you access to its shared details.',
          )
        }}
      </p>

      <form
        v-if="edit"
        class="draft-form"
        @submit.prevent="emit('save-edit')"
      >
        <fieldset class="report-fields" :disabled="actionInProgress">
          <label
            >{{ t('Description')
            }}<textarea
              :value="edit.description"
              required
              maxlength="10000"
              rows="4"
              @input="
                emit('update:edit', {
                  ...edit!,
                  description: ($event.target as HTMLTextAreaElement).value,
                })
              "
            />
          </label>
          <label
            >{{ t('Address')
            }}<input
              :value="edit.address ?? ''"
              maxlength="512"
              @input="
                emit('update:edit', {
                  ...edit!,
                  address: ($event.target as HTMLInputElement).value,
                })
              "
          /></label>
          <label
            >{{ t('Reporter urgency')
            }}<select
              :value="edit.reporterUrgency"
              @change="
                emit('update:edit', {
                  ...edit!,
                  reporterUrgency: ($event.target as HTMLSelectElement)
                    .value as Urgency,
                })
              "
            >
              <option
                v-for="(label, value) in urgencyLabels"
                :key="value"
                :value="value"
              >
                {{ t(label) }}
              </option>
            </select></label
          >
          <label
            >{{ t('Urgency reason')
            }}<textarea
              :value="edit.reporterReason ?? ''"
              maxlength="2000"
              rows="3"
              @input="
                emit('update:edit', {
                  ...edit!,
                  reporterReason: ($event.target as HTMLTextAreaElement).value,
                })
              "
            />
          </label>
          <div class="rd-action-row">
            <button class="ff-primary" type="submit">
              {{ t('Save changes') }}
            </button>
            <button
              class="ff-secondary"
              type="button"
              @click="emit('cancel-edit')"
            >
              {{ t('Cancel') }}
            </button>
          </div>
        </fieldset>
      </form>

      <div v-if="confirmingArchive" class="rd-archive">
        <p class="dialog-intro">
          {{
            t(
              'Archiving removes this report from default lists and notifies joined people and other participants. Existing records and access permissions are retained.',
            )
          }}
        </p>
        <div class="rd-action-row">
          <button
            class="ff-primary"
            type="button"
            :disabled="actionInProgress"
            @click="emit('archive')"
          >
            {{ t('Confirm archive') }}
          </button>
          <button
            class="ff-secondary"
            type="button"
            :disabled="actionInProgress"
            @click="emit('update:confirmingArchive', false)"
          >
            {{ t('Cancel') }}
          </button>
        </div>
      </div>

      <div v-if="canOverrideUrgency" class="rd-override">
        <h3>{{ t('Override urgency') }}</h3>
        <p class="dialog-intro">
          {{
            t(
              'Manual final urgency takes precedence over reporter and join-based calculated urgency. Join boosts never reach Critical.',
            )
          }}
        </p>
        <form class="draft-form" @submit.prevent="emit('save-override')">
          <fieldset class="report-fields" :disabled="actionInProgress">
            <label
              >{{ t('Final urgency')
              }}<select
                :value="overrideUrgency"
                @change="
                  emit(
                    'update:overrideUrgency',
                    ($event.target as HTMLSelectElement).value as Urgency,
                  )
                "
              >
                <option
                  v-for="(label, value) in urgencyLabels"
                  :key="value"
                  :value="value"
                >
                  {{ t(label) }}
                </option>
              </select></label
            >
            <label
              >{{ t('Override reason')
              }}<textarea
                :value="overrideReason"
                required
                maxlength="500"
                rows="3"
                @input="
                  emit(
                    'update:overrideReason',
                    ($event.target as HTMLTextAreaElement).value,
                  )
                "
              />
            </label>
            <button class="ff-primary" type="submit">
              {{ t(busy ? 'Saving…' : 'Save urgency override') }}
            </button>
          </fieldset>
        </form>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rd-actions-body {
  padding: 0 24px 22px;
  display: grid;
  gap: 16px;
}
.rd-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.rd-override h3 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 650;
}
.rd-archive,
.rd-override {
  padding-top: 4px;
  border-top: 1px solid #e7eee9;
}
</style>
