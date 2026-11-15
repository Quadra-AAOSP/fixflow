<script setup lang="ts">
import LanguageSelector from '@/components/ui/LanguageSelector.vue';
import { useLocale } from '@/i18n';
import { ref } from 'vue';
import Button from '@/components/ui/Button.vue';
import { changePassword } from '@/services/auth';
import { errorMessage } from '@/services/api';
import { applyTheme } from '@/utils/themePreference';
const theme = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
function chooseTheme(value: 'light' | 'dark') {
  theme.value = value;
  applyTheme(value);
  localStorage.setItem('fixflow-web-theme', value);
}
const { t } = useLocale();
const passwordError = ref("");
const passwordSuccess = ref("");
const passwordBusy = ref(false);
const currentPassword = ref("");
const nextPassword = ref("");
const confirmPassword = ref("");

async function onChangePassword() {
  passwordError.value = "";
  passwordSuccess.value = "";
  if (nextPassword.value.length < 15) {
    passwordError.value = t("Use a password of at least 15 characters.");
    return;
  }
  if (nextPassword.value !== confirmPassword.value) {
    passwordError.value = t("New password and confirmation do not match.");
    return;
  }
  passwordBusy.value = true;
  try {
    await changePassword(currentPassword.value, nextPassword.value);
    currentPassword.value = "";
    nextPassword.value = "";
    confirmPassword.value = "";
    passwordSuccess.value = t("Password updated.");
  } catch (err) {
    passwordError.value = errorMessage(err);
  } finally {
    passwordBusy.value = false;
  }
}
</script>
<template>
  <section class="settings-page"><header><h1>{{ t('Settings') }}</h1></header><section class="settings-section">
    <h2>{{ t('Appearance') }}</h2>
    <div class="action-row" role="group" :aria-label="t('Appearance')">
      <button class="action-link" type="button" :aria-pressed="theme === 'light'" @click="chooseTheme('light')">{{ t('Light mode') }}</button>
      <button class="action-link" type="button" :aria-pressed="theme === 'dark'" @click="chooseTheme('dark')">{{ t('Dark mode') }}</button>
    </div>
  </section><div class="settings-language"><LanguageSelector /></div>    <section class="dashboard-card profile-password">
      <h2 class="font-semibold">{{ t("Change password") }}</h2>
      <p class="dialog-intro">
        {{ t("Enter your current password, then choose a new one of at least 15 characters.") }}
      </p>
      <form class="draft-form" @submit.prevent="onChangePassword">
        <label
          >{{ t("Current password") }}
          <input v-model="currentPassword" type="password" autocomplete="current-password" required />
        </label>
        <label
          >{{ t("New password") }}
          <input v-model="nextPassword" type="password" autocomplete="new-password" minlength="15" required />
        </label>
        <label
          >{{ t("Confirm new password") }}
          <input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="15" required />
        </label>
        <p v-if="passwordError" role="alert" class="live-error">{{ passwordError }}</p>
        <p v-if="passwordSuccess" role="status">{{ passwordSuccess }}</p>
        <Button
          label="Update password"
          :loading="passwordBusy"
          :disabled="passwordBusy || !currentPassword || !nextPassword || !confirmPassword"
        />
      </form>
    </section></section>
</template>
<style scoped>
.settings-page{max-width:720px}.settings-page h1{font-size:30px;font-weight:700;line-height:1.3;margin-bottom:28px}.settings-language{padding:24px 0;border-top:1px solid #dfe7e2;border-bottom:1px solid #dfe7e2}.settings-language :deep(label){font-size:16px;gap:24px;flex-wrap:wrap}.settings-language :deep(select){min-height:44px;font-size:16px;max-width:220px}

.settings-section,.profile-password{display:grid;gap:14px;margin:20px 0;padding:22px;border:1px solid var(--product-border);border-radius:12px;background:var(--product-surface);color:var(--product-ink)}
.settings-page h2{font-size:1.2rem;font-weight:700}.profile-password form,.profile-password label{display:grid;gap:10px}.profile-password input{min-height:44px;padding:8px 12px;border:1px solid var(--product-border);border-radius:8px;background:var(--product-paper)}.settings-page [aria-pressed=true]{border-color:currentColor;font-weight:750}
</style>
