import { useRouter } from 'expo-router';
import { ArrowUpRight, Wrench } from 'lucide-react-native';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authColors, fontFamilies } from '@/constants/theme';

/**
 * Chrome shared by every public auth screen. A 1:1 port of the web's
 * `AuthLayout.vue` (+ the `.auth-page` block in `Frontend/Web/src/styles/global.css`),
 * collapsed from the web's two-column grid into a single stacked column.
 *
 * Web parity notes:
 *  - The centred header note ("Little fixes. Better places.") is hidden below
 *    900px on the web, so it is correctly absent here.
 *  - The web story panel's campus photo is intentionally omitted: it is a
 *    remote Unsplash asset, and making the sign-in button reachable without a
 *    scroll matters more on a phone than the decorative image does.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-auth-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandHeader />
          <View className="px-5">
            <StoryPanel />
            <View className="mt-7 w-full max-w-[370px] self-center">
              {children}
            </View>
            <AuthFooter />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * `.brand-header` / `.brand` / `.header-link`. The brand mark is the coral tile
 * rotated -7deg; the icon inherits the page ink exactly as the web's
 * `currentColor` does.
 */
function BrandHeader() {
  const router = useRouter();

  return (
    <View className="h-16 flex-row items-center justify-between px-5">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="fixflow home"
        onPress={() => router.push('/(auth)/login')}
        className="flex-row items-center active:opacity-70"
      >
        <View
          className="mr-2.5 h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-coral"
          style={{ transform: [{ rotate: '-7deg' }] }}
        >
          <Wrench color={authColors.ink} size={17} />
        </View>
        <Text
          className="text-[23px] text-auth-ink"
          style={{ fontFamily: fontFamilies.headExtraBold, letterSpacing: -1.2 }}
        >
          fixflow<Text className="text-coral-deep">.</Text>
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Join your community"
        onPress={() => router.push('/(auth)/register')}
        className="flex-row items-center gap-1.5 active:opacity-70"
      >
        <Text
          className="text-[13px] text-auth-ink"
          style={{ fontFamily: fontFamilies.bodySemiBold }}
        >
          Join your community
        </Text>
        <ArrowUpRight color={authColors.ink} size={16} />
      </Pressable>
    </View>
  );
}

/** `.story-panel` — the cream editorial card. */
function StoryPanel() {
  return (
    <View className="rounded-[22px] bg-auth-panel px-5 pb-5 pt-6">
      <View className="flex-row items-center gap-2">
        <View className="h-[7px] w-[7px] rounded-full bg-auth-sage" />
        <Text
          className="text-[10px] text-auth-ink"
          style={{ fontFamily: fontFamilies.headBold, letterSpacing: 1.4 }}
        >
          A LITTLE CARE GOES A LONG WAY
        </Text>
      </View>

      <Text
        className="mt-4 text-[30px] text-auth-ink"
        style={{
          fontFamily: fontFamilies.head,
          letterSpacing: -1.5,
          lineHeight: 35,
        }}
      >
        Good spaces.{'\n'}Happy people.{'\n'}
        <Text className="text-auth-olive">Let’s keep it that way.</Text>
      </Text>

      <Text className="mt-3.5 text-[13px] leading-[22px] text-auth-body">
        From a leaky tap to a flickering light, help make the places you share
        feel a little more like home.
      </Text>

      <View className="mt-5 flex-row items-center justify-between">
        <StoryDot dotClassName="bg-coral" label="Report it." />
        <StoryDot dotClassName="bg-accent" label="Track it." />
        <StoryDot dotClassName="bg-lime" label="Feel at home." />
      </View>
    </View>
  );
}

/** `.story-bottom` entry — a 9px colour dot plus a 10px label. */
function StoryDot({
  dotClassName,
  label,
}: {
  dotClassName: string;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`h-[9px] w-[9px] rounded-full ${dotClassName}`} />
      <Text className="text-[10px] text-auth-body">{label}</Text>
    </View>
  );
}

/** `.auth-footer` — the two small sign-offs under the panel. */
function AuthFooter() {
  return (
    <View className="mt-8 flex-row items-center justify-between pb-6">
      <Text className="text-[10px] text-auth-foot">
        Made for the places we share.
      </Text>
      <Text className="text-[10px] text-auth-foot">
        Schools · Hostels · Hotels{' '}
        <Text className="text-[16px] text-auth-sage-deep">✳</Text>
      </Text>
    </View>
  );
}
