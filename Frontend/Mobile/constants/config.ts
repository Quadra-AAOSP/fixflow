/** Public API base URL. Override with EXPO_PUBLIC_API_URL (e.g. http://192.168.x.x:8080). */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8080';
