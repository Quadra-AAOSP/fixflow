import { Stack } from 'expo-router';

/**
 * Technician stack layout.
 */
export default function TechnicianLayout() {
  return (
    <Stack>
      {/* The screen renders its own editorial hero + back affordance,
          so the stack header would duplicate the title. */}
      <Stack.Screen
        name="contract-requests"
        options={{ title: 'Contract Requests', headerShown: false }}
      />
      <Stack.Screen
        name="terms"
        options={{ title: 'Terms' }}
      />
      <Stack.Screen
        name="open-jobs"
        options={{ title: 'Open Jobs', headerShown: false }}
      />
      <Stack.Screen
        name="invitations"
        options={{ title: 'Invitations' }}
      />
    </Stack>
  );
}