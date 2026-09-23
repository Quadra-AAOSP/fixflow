import { Stack } from 'expo-router';

import { themeColors } from '@/constants/theme';

/**
 * Nested stack for the Reports tab. Without this, `reports/index`,
 * `reports/new`, and `reports/[id]` would all be siblings inside the Tabs
 * navigator (no push/pop, no back affordance). The parent Tabs layout sets
 * `headerShown: false` for the `reports` tab so this stack owns the header.
 */
export default function ReportsStackLayout() {
  const palette = themeColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.card },
        headerTintColor: palette.ink,
        headerTitleStyle: { color: palette.ink },
        contentStyle: { backgroundColor: palette.surface },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Reports' }} />
      <Stack.Screen name="new" options={{ title: 'New report' }} />
      <Stack.Screen name="[id]" options={{ title: 'Report' }} />
    </Stack>
  );
}