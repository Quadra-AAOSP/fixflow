import { useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

export type PickerOption = {
  value: string;
  label: string;
  /** Optional second line rendered under the label in the option list. */
  subtitle?: string;
};

type TriggerArgs = {
  selected: PickerOption | null;
  open: () => void;
  disabled: boolean;
};

type PickerProps = {
  label: string;
  value: string | null;
  options: PickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  /**
   * Replaces the default labeled-field trigger when the trigger needs a
   * different visual (e.g. the inline site switcher on Home). The modal and
   * option list are still owned by this component, so there is one sheet
   * implementation to maintain.
   */
  renderTrigger?: (args: TriggerArgs) => ReactNode;
};

/**
 * Modal-driven single-select picker. The trigger and the open sheet both use
 * the web's `.dashboard-dialog` warm cream (`#fffefa`) background and the
 * teal `#008e82` selected highlight, so the trigger field on Reports and the
 * site switcher in the topbar read as the same control.
 */
export function Picker({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  emptyMessage = 'No options available',
  disabled,
  renderTrigger,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value) ?? null;

  const openSheet = () => {
    if (!disabled) setOpen(true);
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ selected, open: openSheet, disabled: !!disabled })
      ) : (
        <View className="mb-4">
          <Text className="mb-1.5 text-[12px] font-medium text-ink">{label}</Text>
          <Pressable
            onPress={openSheet}
            className={`flex-row items-center justify-between rounded-lg border bg-card px-3 py-3 ${
              disabled ? 'border-border opacity-50' : 'border-border'
            }`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
          >
            <Text
              numberOfLines={1}
              className={`flex-1 ${
                selected ? 'text-[12px] text-ink' : 'text-[12px] text-muted'
              }`}
            >
              {selected ? selected.label : placeholder}
            </Text>
            <Text className="ml-2 text-[10px] text-muted">▾</Text>
          </Pressable>
        </View>
      )}

      <Modal
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <View
          className="flex-1 bg-surface"
          style={{ paddingTop: insets.top }}
        >
          <View className="flex-row items-center justify-between border-b border-border bg-card px-5 pb-3 pt-4">
            <Text
              numberOfLines={1}
              className="flex-1 text-lg font-semibold text-ink"
            >
              {label}
            </Text>
            <Pressable
              onPress={() => setOpen(false)}
              className="px-2 py-1"
              accessibilityRole="button"
            >
              <Text
                className="text-sm font-semibold"
                style={{ color: colors.mintInk }}
              >
                Done
              </Text>
            </Pressable>
          </View>
          {options.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-center text-sm text-muted">
                {emptyMessage}
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                paddingBottom: Math.max(insets.bottom, 24),
              }}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`px-5 py-3 ${
                      isSelected
                        ? 'bg-dashboard-teal-soft'
                        : 'bg-transparent'
                    }`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      className={`text-[13px] ${
                        isSelected
                          ? 'font-semibold text-dashboard-teal'
                          : 'text-ink'
                      }`}
                    >
                      {option.label}
                    </Text>
                    {option.subtitle ? (
                      <Text className="mt-0.5 text-[11px] text-muted">
                        {option.subtitle}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}
