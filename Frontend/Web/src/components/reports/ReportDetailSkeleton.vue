<template>
  <div class="rd-skeleton" aria-busy="true" aria-label="Loading report">
    <div class="rd-skeleton-header">
      <div class="rd-skel rd-skel-line short" />
      <div class="rd-skel rd-skel-line title" />
      <div class="rd-skel rd-skel-badge" />
    </div>
    <div class="rd-skel rd-skel-block summary" />
    <div class="rd-skel rd-skel-line actions" />
    <div class="rd-skeleton-columns">
      <div class="rd-skel rd-skel-panel" />
      <div class="rd-skel rd-skel-panel aside" />
    </div>
  </div>
</template>

<style scoped>
.rd-skeleton {
  display: grid;
  gap: 20px;
}
.rd-skeleton-header {
  display: grid;
  gap: 10px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e1ebe5;
}
.rd-skeleton-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
.rd-skel {
  background: linear-gradient(90deg, #eef3f0 25%, #f7faf8 50%, #eef3f0 75%);
  background-size: 200% 100%;
  animation: rd-pulse 1.2s ease-in-out infinite;
  border-radius: 8px;
}
.rd-skel-line {
  height: 14px;
  width: 42%;
}
.rd-skel-line.short {
  width: 18%;
  height: 11px;
}
.rd-skel-line.title {
  width: 36%;
  height: 28px;
}
.rd-skel-line.actions {
  width: 55%;
  height: 40px;
}
.rd-skel-badge {
  width: 96px;
  height: 28px;
  border-radius: 999px;
}
.rd-skel-block.summary {
  height: 120px;
}
.rd-skel-panel {
  height: 280px;
}
.rd-skel-panel.aside {
  height: 220px;
}
@keyframes rd-pulse {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
@media (max-width: 1050px) {
  .rd-skeleton-columns {
    grid-template-columns: 1fr;
  }
}
</style>
