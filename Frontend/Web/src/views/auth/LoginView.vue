<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { Wrench } from '@lucide/vue';

import Button from '@/components/ui/Button.vue';
import TextField from '@/components/ui/TextField.vue';
import { useAuth } from '@/composables/useAuth';
import { colors } from '@/constants/theme';
import { ApiError } from '@/services/auth';

const { login } = useAuth();

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

async function onSubmit() {
  error.value = null;
  const trimmedEmail = email.value.trim();
  if (!trimmedEmail || !password.value) {
    error.value = 'Email and password are required.';
    return;
  }

  submitting.value = true;
  try {
    await login({ email: trimmedEmail, password: password.value });
  } catch (err) {
    if (err instanceof ApiError) {
      error.value =
        err.status === 401 ? 'Invalid email or password.' : err.message;
    } else {
      error.value =
        'Unable to reach the server. Check your connection and API URL.';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-8 text-center">
      <div
        class="mx-auto mb-4 inline-flex rounded-2xl bg-primary/15 p-4 dark:bg-primary-dark/20"
      >
        <Wrench :size="36" :color="colors.light.primary" />
      </div>
      <h1 class="text-3xl font-bold text-ink dark:text-ink-dark">FixFlow</h1>
      <p class="mt-2 text-sm text-muted dark:text-muted-dark">
        Sign in to report and track site maintenance
      </p>
    </div>

    <form @submit.prevent="onSubmit">
      <TextField
        v-model="email"
        label="Email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
      />
      <TextField
        v-model="password"
        label="Password"
        type="password"
        autocomplete="current-password"
        placeholder="••••••••"
      />

      <p v-if="error" class="mb-3 text-sm text-urgency-critical">{{ error }}</p>

      <Button label="Sign in" type="submit" :loading="submitting" />
    </form>

    <p class="mt-6 text-center text-sm text-muted dark:text-muted-dark">
      No account?
      <RouterLink
        to="/register"
        class="font-semibold text-primary dark:text-primary-dark"
      >
        Register
      </RouterLink>
    </p>
  </div>
</template>
