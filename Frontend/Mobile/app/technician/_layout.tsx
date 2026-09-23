import { Stack } from 'expo-router';

import { themeColors } from '@/constants/theme';

/**
 * Stack for technician self-service screens. Mirrors the Reports tab stack so
 * pushed screens own a header and get a back affordance.
 */
export default function TechnicianStackLayout() {
  const palette = themeColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.foreground,
        headerTitleStyle: { color: palette.foreground },
        contentStyle: { backgroundColor: palette.background },
      }}
    >
      <Stack.Screen name="skills" options={{ title: 'Trades & skills' }} />
    </Stack>
  );
}
