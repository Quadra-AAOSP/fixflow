import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';

import { colors } from '@/constants/theme';
import {
  parseMarketplaceTimingValue,
  toMarketplaceTimingValue,
} from '@/utils/marketplace';

type DateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  /** Earliest selectable instant; defaults to now. */
  minimumDate?: Date;
  placeholder?: string;
};

/**
 * Date + time field for marketplace expected timing.
 * Web uses `datetime-local`; iOS/Android use the community picker.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  disabled = false,
  error,
  minimumDate,
  placeholder,
}: DateTimeFieldProps) {
  const { t, i18n } = useTranslation('common');
  const resolvedMin = minimumDate ?? new Date();
  const selected = useMemo(
    () => parseMarketplaceTimingValue(value) ?? roundToMinute(new Date()),
    [value],
  );
  const [open, setOpen] = useState(false);
  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(null);
  const [draft, setDraft] = useState(selected);

  const parsed = parseMarketplaceTimingValue(value);
  const display = parsed
    ? new Intl.DateTimeFormat(i18n.language || 'en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed)
    : (placeholder ?? t('marketplace.timingPlaceholder'));

  function commit(next: Date) {
    const clamped =
      next.getTime() < resolvedMin.getTime() ? new Date(resolvedMin) : next;
    onChange(toMarketplaceTimingValue(roundToMinute(clamped)));
  }

  function openPicker() {
    if (disabled) return;
    setDraft(selected);
    if (Platform.OS === 'android') {
      setAndroidStep('date');
      return;
    }
    setOpen(true);
  }

  function onIosChange(_event: DateTimePickerEvent, date?: Date) {
    if (date) setDraft(date);
  }

  function onAndroidChange(event: DateTimePickerEvent, date?: Date) {
    if (event.type === 'dismissed') {
      setAndroidStep(null);
      return;
    }
    if (!date) {
      setAndroidStep(null);
      return;
    }
    if (androidStep === 'date') {
      const merged = new Date(draft);
      merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setDraft(merged);
      setAndroidStep('time');
      return;
    }
    const merged = new Date(draft);
    merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
    setAndroidStep(null);
    commit(merged);
  }

  if (Platform.OS === 'web') {
    return (
      <View className="mb-4">
        <Text className="mb-1.5 text-[12px] font-medium text-ink">{label}</Text>
        <TextInput
          accessibilityLabel={label}
          editable={!disabled}
          value={value}
          onChangeText={onChange}
          // @ts-expect-error RN web accepts HTML input types
          type="datetime-local"
          min={toMarketplaceTimingValue(resolvedMin)}
          className={`rounded-lg border bg-card px-3 py-3 text-[16px] text-ink ${
            error
              ? 'border-[1.5px] border-tone-danger'
              : 'border-[1.5px] border-border'
          }`}
        />
        {error ? (
          <Text className="mt-1 text-[11px] text-tone-danger">{error}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-[12px] font-medium text-ink">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={openPicker}
        className={`rounded-lg border bg-card px-3 py-3 active:opacity-80 ${
          error
            ? 'border-[1.5px] border-tone-danger'
            : 'border-[1.5px] border-border'
        }`}
        style={{ opacity: disabled ? 0.5 : 1 }}
      >
        <Text
          className={`text-[16px] ${value ? 'text-ink' : 'text-subtitle'}`}
        >
          {display}
        </Text>
      </Pressable>
      {error ? (
        <Text className="mt-1 text-[11px] text-tone-danger">{error}</Text>
      ) : null}

      {Platform.OS === 'android' && androidStep ? (
        <DateTimePicker
          key={androidStep}
          value={draft}
          mode={androidStep}
          display="default"
          minimumDate={resolvedMin}
          onChange={onAndroidChange}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/40"
            onPress={() => setOpen(false)}
          >
            <Pressable
              className="rounded-t-2xl bg-card px-4 pb-8 pt-3"
              onPress={(event) => event.stopPropagation()}
            >
              <View className="mb-2 flex-row items-center justify-between">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setOpen(false)}
                  className="px-2 py-2"
                >
                  <Text className="text-[15px] text-dashboard-subtitle">
                    {t('marketplace.timingCancel')}
                  </Text>
                </Pressable>
                <Text className="text-[15px] font-semibold text-ink">{label}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    commit(draft);
                    setOpen(false);
                  }}
                  className="px-2 py-2"
                >
                  <Text
                    className="text-[15px] font-semibold"
                    style={{ color: colors.primary }}
                  >
                    {t('marketplace.timingDone')}
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="datetime"
                display="spinner"
                minimumDate={resolvedMin}
                onChange={onIosChange}
                style={{ alignSelf: 'center' }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function roundToMinute(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  return next;
}
