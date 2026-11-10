<script setup lang="ts">
import AppLayout from '@/layouts/AppLayout.vue';
import { useAuth } from '@/composables/useAuth';
import '@/styles/shop.css';
const { user } = useAuth();
</script>
<template>
  <AppLayout v-if="user" />
</template>
