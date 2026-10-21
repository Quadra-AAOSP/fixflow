import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { themeColors } from '@/constants/theme';

/**
 * Nested stack for the Reports tab. Without this, `reports/index`,
 * `reports/new`, and `reports/[id]` would all be siblings inside the Tabs
 * navigator (no push/pop, no back affordance). The parent Tabs layout sets
 * `headerShown: false` for the `reports` tab so this stack owns the header.
 *
 * The pushed screens render an explicit back arrow (see `HeaderBackButton`)
 * so "back" reliably returns to the list on web, where the default one
 * resolves to the wrong route.
 */
export default function ReportsStackLayout() {
  const palette = themeColors();
  const { t } = useTranslation('common');

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: palette.card,
        },
        headerTintColor: palette.ink,
        headerTitleStyle: { fontWeight: '600', fontSize: 16, color: palette.ink },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: palette.surface },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('reports.list.title') }} />
      <Stack.Screen
        name="new"
        options={{
          title: t('reports.list.newReport'),
          headerLeft: () => <HeaderBackButton color={palette.ink} to="/reports" />,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t('reports.detail.screenTitle'),
          headerLeft: () => <HeaderBackButton color={palette.ink} to="/reports" />,
        }}
      />
    </Stack>
  );
}
