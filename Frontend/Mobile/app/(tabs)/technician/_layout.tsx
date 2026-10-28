import { Stack } from 'expo-router';

/**
 * Technician stack layout.
 */
export default function TechnicianLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: 'Technician Dashboard' }}
      />
      <Stack.Screen
        name="contract-requests"
        options={{ title: 'Contract Requests' }}
      />
      <Stack.Screen
        name="terms"
        options={{ title: 'Terms' }}
      />
      <Stack.Screen
        name="invitations"
        options={{ title: 'Invitations' }}
      />
    </Stack>
  );
}