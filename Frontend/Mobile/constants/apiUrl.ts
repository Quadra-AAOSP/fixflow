export function resolveApiUrl(
  configured: string | undefined,
  webOrigin: string | undefined,
  expoHostUri: string | undefined,
): string {
  const override = configured?.trim();
  if (override) return override.replace(/\/+$/, '');
  // Keep browser requests on the same hostname so SameSite cookies work.
  if (webOrigin) {
    const url = new URL(webOrigin);
    url.port = '8080';
    return url.origin;
  }
  // Expo's LAN host is the development PC, not the phone's loopback address.
  if (expoHostUri) {
    const url = new URL(`http://${expoHostUri}`);
    url.port = '8080';
    return url.origin;
  }
  throw new Error('Set EXPO_PUBLIC_API_URL to your backend URL. No development host is available.');
}
