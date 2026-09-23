import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

export type PickerOption = {
  value: string;
  label: string;
};

type PickerProps = {
  label: string;
  value: string | null;
  options: PickerOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
};

/**
 * Modal-driven single-select picker. Opens a sheet of options on tap. Used
 * for taxonomy-derived choices (categories, specialties, eventually a site
 * switcher for super_admin). Wraps the native `<Modal>` rather than pulling
 * in a heavier library until we outgrow the basics.
 */
export function Picker({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  emptyMessage = 'No options available',
  disabled,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-ink">{label}</Text>
      <Pressable
        onPress={() => {
          if (!disabled) setOpen(true);
        }}
        className={`rounded-lg border bg-card px-3 py-3 ${
          disabled ? 'border-border opacity-50' : 'border-border'
        }`}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text
          className={
            selected ? 'text-base text-ink' : 'text-base text-muted'
          }
        >
          {selected ? selected.label : placeholder}
        </Text>
      </Pressable>

      <Modal
        animationType="slide"
        presentationStyle={
          Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'
        }
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 bg-surface pt-4">
          <View className="flex-row items-center justify-between border-b border-border px-5 pb-3">
            <Text className="text-lg font-semibold text-ink">{label}</Text>
            <Pressable
              onPress={() => setOpen(false)}
              className="px-2 py-1"
              accessibilityRole="button"
            >
              <Text className="text-sm font-medium text-primary">Done</Text>
            </Pressable>
          </View>
          {options.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <Text className="text-center text-sm text-muted">
                {emptyMessage}
              </Text>
            </View>
          ) : (
            <ScrollView>
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
                      isSelected ? 'bg-primary/10' : 'bg-transparent'
                    }`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      className={`text-base ${
                        isSelected
                          ? 'font-semibold text-primary'
                          : 'text-ink'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}