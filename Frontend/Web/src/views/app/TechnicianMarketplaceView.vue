<script setup lang="ts">
import { useLocale } from "@/i18n";
import ContractApplicationsPanel from "@/components/technician/ContractApplicationsPanel.vue";
const { t } = useLocale();
</script>
<template>
  <div class="hiring-page">
    <header class="hiring-header">
      <h1>{{ t("Find sites hiring") }}</h1>
      <p>
        {{
          t(
            "Discover site opportunities and keep track of your contract requests.",
          )
        }}
      </p>
    </header>
    <section class="dashboard-card hiring-status">
      <h2>{{ t("Sites open to hiring") }}</h2>
      <p role="status">
        {{
          t(
            "Hiring listings are awaiting backend support. No sites are being presented as hiring without a published listing.",
          )
        }}
      </p>
      <p>
        {{
          t(
            "Already have a site ID? You can submit a contract request below and track the response.",
          )
        }}
      </p>
    </section>
    <section class="hiring-requests">
      <h2>{{ t("Contract requests") }}</h2>
      <ContractApplicationsPanel />
    </section>
  </div>
</template>
<style scoped>
.hiring-page {
  display: grid;
  gap: 24px;
}
.hiring-header {
  padding: 10px 0 24px;
  border-bottom: 1px solid #e0e9e4;
}
.hiring-header h1 {
  font-size: 32px;
  letter-spacing: -0.03em;
  font-weight: 700;
}
.hiring-header p,
.hiring-status p {
  color: #52677b;
  line-height: 1.6;
  margin-top: 8px;
}
.hiring-status {
  padding: 24px;
}
.hiring-status h2,
.hiring-requests > h2 {
  font-size: 18px;
  font-weight: 700;
}
.hiring-requests > h2 {
  margin-bottom: 14px;
}
</style>
