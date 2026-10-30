<script setup lang="ts">
import { useId } from 'vue';
import { useLocale } from '@/i18n';
const { t } = useLocale();
const fieldId = useId();
defineProps<{
  label: string;
  error?: string;
  modelValue: string;
  type?: string;
  autocomplete?: string;
  placeholder?: string;
  required?: boolean;
  minlength?: number;
  maxlength?: number;
  min?: number;
  step?: number;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
</script>

<template>
  <label class="mb-4 block">
    <span class="mb-1.5 block text-sm font-medium text-ink dark:text-ink-dark">
      {{ t(label) }}
    </span>
    <input
      :type="type ?? 'text'"
      :id="fieldId"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? `${fieldId}-error` : undefined"
      :value="modelValue"
      :autocomplete="autocomplete"
      :placeholder="placeholder ? t(placeholder) : undefined"
      :required="required"
      :minlength="minlength"
      :maxlength="maxlength"
      :min="min"
      :step="step"
      class="w-full rounded-lg border bg-card px-3 py-3 text-base text-ink outline-none ring-primary focus:ring-2 dark:bg-card-dark dark:text-ink-dark"
      :class="
        error
          ? 'border-urgency-critical'
          : 'border-border dark:border-border-dark'
      "
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" :id="`${fieldId}-error`" role="alert" class="mt-1 block text-xs text-urgency-critical">
      {{ t(error) }}
    </span>
  </label>
</template>
