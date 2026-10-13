import { Stack } from 'expo-router';
import { themeColors } from '@/constants/theme';

/**
 * Nested stack under the More tab. Each secondary destination (sites, team
 * access, contracts, shop, notifications) gets its own back arrow and header
 * title while still being part of the bottom-bar navigation.
 *
 * Header chrome matches the dashboard topbar: white card background, hairline
 * `#e9edf0` bottom border, slate `#152742` ink, no shadow.
 */
export default function MoreStackLayout() {
  const palette = themeColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: palette.card,
        },
        headerTintColor: palette.ink,
        headerTitleStyle: { fontWeight: '600', fontSize: 16 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.surface },
      }}
    >
      {/* The menu screen renders its own heading, so suppress the stack
          header here to avoid a double title. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="sites" options={{ title: 'Sites' }} />
      <Stack.Screen name="team-access" options={{ title: 'Team access' }} />
      <Stack.Screen name="contracts" options={{ title: 'Site contracts' }} />
      <Stack.Screen name="shop" options={{ headerShown: false }} />
    </Stack>
  );
}
