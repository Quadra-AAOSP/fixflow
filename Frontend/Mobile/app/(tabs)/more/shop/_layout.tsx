import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/ui/HeaderBackButton';
import { themeColors } from '@/constants/theme';

/**
 * Shop stack — catalog is the index, the [orderId] screen is a deep-link
 * target for purchase-complete flows. Basket and checkout are presented as
 * sheets over the catalog (no extra route needed) so the bottom tabs stay
 * visible while a transaction is in progress.
 *
 * The back arrow is rendered explicitly (see `HeaderBackButton`): the catalog's
 * default back would have nothing to pop (its parent More stack suppresses the
 * header), and the [orderId] screen's default one resolves to the wrong route
 * on web.
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
      <Stack.Screen
        name="index"
        options={{
          title: 'Shop',
          headerLeft: () => <HeaderBackButton color={palette.ink} to="/more" />,
        }}
      />
      <Stack.Screen
        name="[orderId]"
        options={{
          title: 'Order details',
          headerLeft: () => (
            <HeaderBackButton color={palette.ink} to="/more/shop" />
          ),
        }}
      />
    </Stack>
  );
}
