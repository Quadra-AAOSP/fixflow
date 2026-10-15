import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

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
 * Full-height modal sheet matching the web's `.dashboard-dialog`:
 *   - warm cream `#fffefa` background
 *   - 1px `#e4ebe6` border on the chrome
 *   - 18px corner radius (rounded to 16px on mobile to match the cards)
 *   - 26px padding on the body
 *   - 23px headline size
 *   - teal `#008f85` close action
 *
 * Replaces the browser `<dialog>` pattern used by the web build. `Picker`
 * keeps its own lighter implementation since it never needs a footer.
 */
export function ModalSheet({
  visible,
  title,
  onClose,
  children,
  footer,
  busy,
}: ModalSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      visible={visible}
      onRequestClose={busy ? () => {} : onClose}
    >
      <View className="flex-1 bg-surface">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            className="flex-row items-center justify-between border-b border-border bg-card px-5"
            style={{ paddingTop: insets.top + 16, paddingBottom: 16 }}
          >
            <Text
              className="flex-1 text-[19px] font-semibold text-ink"
              style={{ letterSpacing: -0.3 }}
            >
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className={`px-2 py-1 ${busy ? 'opacity-40' : ''}`}
            >
              <Text
                className="text-[13px] font-semibold"
                style={{ color: colors.mintInk }}
              >
                Close
              </Text>
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom, 16) + 16,
            }}
          >
            {children}
          </ScrollView>

          {footer ? (
            <View
              className="border-t border-border bg-card px-5"
              style={{
                paddingTop: 16,
                paddingBottom: Math.max(insets.bottom, 16),
              }}
            >
              {footer}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
