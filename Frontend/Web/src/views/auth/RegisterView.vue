<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';

import Button from '@/components/ui/Button.vue';
import TextField from '@/components/ui/TextField.vue';
import { useAuth } from '@/composables/useAuth';
import { ApiError } from '@/services/auth';

const { register } = useAuth();

const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const siteId = ref('');
const phone = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

async function onSubmit() {
  error.value = null;

  const trimmedEmail = email.value.trim();
  const trimmedFirst = firstName.value.trim();
  const trimmedLast = lastName.value.trim();
  const parsedSiteId = Number(siteId.value.trim());

  if (!trimmedFirst || !trimmedLast || !trimmedEmail || !password.value) {
    error.value = 'First name, last name, email, and password are required.';
    return;
  }
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.';
    return;
  }
  if (!Number.isInteger(parsedSiteId) || parsedSiteId <= 0) {
    error.value = 'Enter a valid site ID from your site administrator.';
    return;
  }

  submitting.value = true;
  try {
    await register({
      email: trimmedEmail,
      password: password.value,
      firstName: trimmedFirst,
      lastName: trimmedLast,
      phone: phone.value.trim() || undefined,
      role: 'reporter',
      siteId: parsedSiteId,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      error.value = err.message;
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
    <h1 class="mb-1 text-3xl font-bold text-ink dark:text-ink-dark">
      Create account
    </h1>
    <p class="mb-6 text-sm text-muted dark:text-muted-dark">
      Register as a reporter for your school, hostel, or hotel site.
    </p>

    <form @submit.prevent="onSubmit">
      <div class="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-3">
        <TextField
          v-model="firstName"
          label="First name"
          autocomplete="given-name"
          placeholder="Alex"
        />
        <TextField
          v-model="lastName"
          label="Last name"
          autocomplete="family-name"
          placeholder="Ng"
        />
      </div>

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
        autocomplete="new-password"
        placeholder="At least 8 characters"
      />
      <TextField
        v-model="siteId"
        label="Site ID"
        type="number"
        placeholder="e.g. 1"
      />
      <p class="-mt-2 mb-4 text-xs text-muted dark:text-muted-dark">
        Ask your site admin for the numeric site ID. Sites are not listed
        publicly before login.
      </p>
      <TextField
        v-model="phone"
        label="Phone (optional)"
        type="tel"
        autocomplete="tel"
        placeholder="+65 …"
      />

      <p v-if="error" class="mb-3 text-sm text-urgency-critical">{{ error }}</p>

      <Button label="Create account" type="submit" :loading="submitting" />
    </form>

    <p class="mt-6 text-center text-sm text-muted dark:text-muted-dark">
      Already registered?
      <RouterLink
        to="/login"
        class="font-semibold text-primary dark:text-primary-dark"
      >
        Sign in
      </RouterLink>
    </p>
  </div>
</template>
