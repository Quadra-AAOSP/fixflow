import { Stack } from 'expo-router';
import { themeColors } from '@/constants/theme';

/**
 * Shop stack — catalog is the index, the [orderId] screen is a deep-link
 * target for purchase-complete flows. Basket and checkout are presented as
 * sheets over the catalog (no extra route needed) so the bottom tabs stay
 * visible while a transaction is in progress.
 */
export default function ShopStackLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Shop' }} />
      <Stack.Screen
        name="[orderId]"
        options={{ title: 'Order details' }}
      />
    </Stack>
  );
}
