import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveApiUrl } from './apiUrl';

/** Override for production, tunnels, or a backend on a different computer. */
export const API_BASE_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined,
  Constants.expoConfig?.hostUri,
);
