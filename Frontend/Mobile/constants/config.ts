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

/**
 * Web only. The API must be called on the SAME host the page was loaded from:
 * the backend's session cookie is `SameSite=Lax`, so if the page is on
 * `localhost` but the API is on `127.0.0.1` (as Metro's `hostUri` can report),
 * the browser treats it as cross-site and never sends the cookie — the user
 * appears signed in for one request, then gets bounced back to login. Mimicking
 * `window.location.hostname` keeps the cookie same-site. Native has no page
 * origin, so it keeps using the dev-server/LAN host.
 */
function pageHost(): string | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  return window.location?.hostname || null;
}

export const API_BASE_URL =
  OVERRIDE ?? `http://${pageHost() ?? devServerHost() ?? fallbackHost()}:8080`;

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
  // Skip the loopback alias on web: it is a different *site* than the page
  // origin, so the SameSite=Lax session cookie would be dropped and the user
  // would be bounced back to login the moment the app makes its first call.
  if (Platform.OS !== 'web') {
    urls.push('http://127.0.0.1:8080'); // native / same-machine
  }
  return [...new Set(urls)];
})();

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log(
    `[config] API candidates: ${API_BASE_URL_CANDIDATES.join(' → ')}`,
  );
}
