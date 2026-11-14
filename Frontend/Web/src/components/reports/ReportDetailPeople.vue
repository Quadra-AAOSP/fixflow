<script setup lang="ts">
import { useLocale } from '@/i18n';
import { formatDate } from '@/utils/maintenance';
import type { ReportReporter } from '@/types/maintenance';

defineProps<{
  reporters: ReportReporter[];
  reportersLoaded: boolean;
  reportersError: string;
  currentUserId?: number | null;
}>();

const { t } = useLocale();
</script>

<template>
  <section class="ff-surface rd-people">
    <header class="ff-section-heading">
      <h2>{{ t('People attached to this report') }}</h2>
    </header>
    <div class="rd-people-body">
      <p v-if="reportersError" class="live-error">{{ t(reportersError) }}</p>
      <ul v-else-if="reportersLoaded" class="reporter-list">
        <li v-for="person in reporters" :key="person.userId">
          {{
            person.userId === currentUserId
              ? t('You')
              : person.name || t('User #{id}', { id: person.userId })
          }}<span>{{
            t('Joined {date}', { date: formatDate(person.joinedAt, true) })
          }}</span>
        </li>
      </ul>
      <p v-else class="dialog-intro">
        {{
          t(
            'Reporter identities are only available to people with access to this report.',
          )
        }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.rd-people-body {
  padding: 0 24px 22px;
}
</style>
