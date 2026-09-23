import { Tabs } from 'expo-router';
import { ClipboardList, House, User } from 'lucide-react-native';

import { SiteProvider } from '@/stores/site';
import { themeColors } from '@/constants/theme';
import { useClientOnlyValue } from '@/hooks/useClientOnlyValue';

export default function TabLayout() {
  const palette = themeColors();

  return (
    <SiteProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: palette.tabIconSelected,
          tabBarInactiveTintColor: palette.tabIconDefault,
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
          },
          headerStyle: {
            backgroundColor: palette.surface,
          },
          headerTintColor: palette.foreground,
          headerShown: useClientOnlyValue(false, true),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            // The nested Reports stack owns its own header so `new` and `[id]`
            // get back buttons. Leaving this on would double the headers.
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <ClipboardList color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
      </Tabs>
    </SiteProvider>
  );
}