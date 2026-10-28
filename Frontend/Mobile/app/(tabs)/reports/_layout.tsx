import { Stack } from 'expo-router';

/**
 * Reports stack layout. Mirrors the web's Reports tab.
 */
export default function ReportsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Reports' }}
      />
      <Stack.Screen
        name="new"
        options={{ title: 'New Report' }}
      />
      <Stack.Screen
        name="[id]"
        options={{ title: 'Report Details' }}
      />
    </Stack>
  );
}