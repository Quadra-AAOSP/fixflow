import { Stack } from 'expo-router';

/**
 * Staff dashboard stack layout.
 */
export default function StaffDashboardLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Staff Dashboard' }}
      />
      <Stack.Screen
        name="reports"
        options={{ title: 'Manage Reports' }}
      />
    </Stack>
  );
}