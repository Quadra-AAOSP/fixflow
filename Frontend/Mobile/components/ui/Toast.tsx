import React from 'react';
import { View, Text, Animated } from 'react-native';

import { colors } from '@/constants/theme';

type ToastProps = {
  message: string;
  type?: 'info' | 'success' | 'error';
  visible: boolean;
  onClose: () => void;
};

/**
 * Floating feedback banner. Colours resolve through the mode-aware palette
 * during render, so the toast follows the active light/dark theme instead of
 * flashing a light pastel card over a dark screen.
 */
const Toast = ({ message, type = 'info', visible, onClose }: ToastProps) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [fadeAnim, visible]);

  const handleClose = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (onClose) onClose();
    });
  };

  if (!visible) return null;

  const tone =
    type === 'success'
      ? { bg: colors.successSoft, ink: colors.successInk }
      : type === 'error'
        ? { bg: colors.dangerSoft, ink: colors.dangerInk }
        : { bg: colors.infoSoft, ink: colors.infoInk };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        zIndex: 1000,
        opacity: fadeAnim,
      }}
    >
      <View
        accessibilityRole="alert"
        style={{
          padding: 15,
          borderRadius: 8,
          marginHorizontal: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: tone.bg,
          borderLeftWidth: 4,
          borderLeftColor: tone.ink,
        }}
      >
        <Text style={{ flex: 1, fontSize: 14, color: colors.ink }}>{message}</Text>
        <Text
          accessibilityRole="button"
          onPress={handleClose}
          style={{ fontSize: 18, padding: 5, color: tone.ink }}
        >
          ×
        </Text>
      </View>
    </Animated.View>
  );
};

export default Toast;
