import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

type ToastProps = {
  message: string;
  type?: 'info' | 'success' | 'error';
  visible: boolean;
  onClose: () => void;
};

const Toast = ({ message, type = 'info', visible, onClose }: ToastProps) => {
  const fadeAnim = new Animated.Value(0);

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
  }, [visible]);

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

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.toast, styles[type]]}>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.closeButton} onPress={handleClose}>×</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  toast: {
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  success: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  error: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  message: {
    flex: 1,
    fontSize: 14,
  },
  closeButton: {
    fontSize: 18,
    color: '#757575',
    padding: 5,
  },
});

export default Toast;

