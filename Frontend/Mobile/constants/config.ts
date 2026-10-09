import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Public API base URL resolution order:
 *
 * 1. EXPO_PUBLIC_API_URL env override (e.g. http://192.168.x.x:8080) — wins if set.
 * 2. The host the bundle was served from in development: the machine running
 *    Metro is the same machine the backend runs on, so whichever network Metro
 *    is reachable on (hotspot, school Wi-Fi, …) the backend is reachable on too.
 *    This adapts automatically when the dev PC changes networks.
 * 3. Per-platform fallbacks (web loopback, Android emulator host alias).
 *
 * Release builds have no dev server — set EXPO_PUBLIC_API_URL to the
 * production server URL before building for distribution.
 */

const OVERRIDE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function devServerHost(): string | null {
  const hostUri =
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost ??
    (Constants.expoConfig as { hostUri?: string } | undefined)?.hostUri;

  if (!hostUri) return null;
  const host = hostUri.split(':')[0];

  if (host === 'localhost') {
    // Emulator reaches the host through its own alias; adb reverse only
    // proxies Metro's port, not the backend's, so localhost itself won't work.
    return Platform.OS === 'android' ? '10.0.2.2' : host;
  }
  if (IPV4.test(host)) return host; // LAN address of the dev machine
  return null; // tunnel relay (u.expo.dev / ngrok) — backend is not reachable there
}

function fallbackHost(): string {
  if (Platform.OS === 'android') return '10.0.2.2'; // emulator alias for host loopback
  return '127.0.0.1';
}

export const API_BASE_URL =
  OVERRIDE ?? `http://${devServerHost() ?? fallbackHost()}:8080`;

/**
 * Ordered base URLs for the API client to try when a request dies at the
 * network level (host unreachable). The first entry is always the primary
 * API_BASE_URL; the rest cover the cases the primary guess can miss, e.g. the
 * emulator leaking the dev machine's LAN IP that the Windows Firewall then
 * blocks. Whichever answers first is cached by the client for the session.
 */
export const API_BASE_URL_CANDIDATES: readonly string[] = (() => {
  const urls = [API_BASE_URL];
  if (Platform.OS === 'android') {
    urls.push('http://10.0.2.2:8080'); // emulator alias for the host's loopback
  }
  urls.push('http://127.0.0.1:8080'); // web / same-machine
  return [...new Set(urls)];
})();

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log(
    `[config] API candidates: ${API_BASE_URL_CANDIDATES.join(' → ')}`,
  );
}
