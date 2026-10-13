import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

type ModalSheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scroll area — the primary action, usually. */
  footer?: ReactNode;
  /** Disables the close affordance while a submit is in flight. */
  busy?: boolean;
};

/**
 * Full-height modal sheet with a header, scrolling body and optional pinned
 * footer. Replaces the browser `<dialog>` pattern used by the web build.
 * `Picker` keeps its own lighter implementation since it never needs a
 * footer.
 */
export function ModalSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  busy,
}: ModalSheetProps) {
  return (
    <Modal
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      visible={visible}
      onRequestClose={busy ? () => {} : onClose}
    >
      <View className="flex-1 bg-surface">
        <View className="flex-row items-center justify-between border-b border-border bg-card px-5 py-4">
          <Text className="flex-1 text-lg font-semibold text-ink">{title}</Text>
          <Pressable
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className={`px-2 py-1 ${busy ? 'opacity-40' : ''}`}
          >
            <Text className="text-sm font-medium text-primary">Close</Text>
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 py-4"
        >
          {children}
        </ScrollView>

        {footer ? (
          <View className="border-t border-border bg-card px-5 py-4">
            {footer}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
