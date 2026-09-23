import { useState, type ReactNode } from 'react';
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
 * Modal-driven single-select picker. Opens a sheet of options on tap. Used
 * for taxonomy-derived choices (categories) and the super_admin site
 * switcher. Wraps the native `<Modal>` rather than pulling in a heavier
 * library until we outgrow the basics.
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
          <Text className="mb-1.5 text-sm font-medium text-foreground">{label}</Text>
          <Pressable
            onPress={openSheet}
            className={`rounded-lg border bg-surface px-3 py-3 ${
              disabled ? 'border-border opacity-50' : 'border-border'
            }`}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled }}
          >
            <Text
              className={
                selected ? 'text-base text-foreground' : 'text-base text-muted-foreground'
              }
            >
              {selected ? selected.label : placeholder}
            </Text>
          </Pressable>
        </View>
      )}

      <Modal
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 bg-background pt-4">
          <View className="flex-row items-center justify-between border-b border-border px-5 pb-3">
            <Text className="text-lg font-semibold text-foreground">{label}</Text>
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
              <Text className="text-center text-sm text-muted-foreground">
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
                        isSelected ? 'font-semibold text-primary' : 'text-foreground'
                      }`}
                    >
                      {option.label}
                    </Text>
                    {option.subtitle ? (
                      <Text className="mt-0.5 text-xs text-muted-foreground">
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