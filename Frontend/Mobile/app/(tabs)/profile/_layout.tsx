import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { authColors, themeColors } from '@/constants/theme';

/**
 * Nested stack under the Profile tab.
 *
 * Settings lives here — it was moved out of the More stack, where the back
 * arrow's only possible target was the More menu, so tapping "back" from
 * Settings dumped the user onto the More tab instead of returning to where
 * they came from.
 *
 * As with the More and Reports stacks, the tab's own header is suppressed in
 * `(tabs)/_layout.tsx` so this stack is the single header owner — that avoids
 * a double bar and leaves the back button a well-defined target.
 */
export default function ProfileStackLayout() {
  const palette = themeColors();
  const { t } = useTranslation('common');

  return (
    <Stack>
      {/* Profile keeps the auth pages' warm cream bar that the tab header
          rendered before this route became a stack. */}
      <Stack.Screen
        name="index"
        options={{
          title: t('tabs.profile'),
          headerStyle: { backgroundColor: authColors.bg },
          headerTintColor: authColors.ink,
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          headerStyle: { backgroundColor: palette.card },
          headerTintColor: palette.ink,
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.surface },
          // Pops back to Profile. `popTo` only matters for a cold entry
          // (deep link or a web refresh), where there is no stack to pop.
          headerLeft: () => (
            <HeaderBackButton color={palette.ink} popTo="/profile" />
          ),
        }}
      />
    </Stack>
  );
}
