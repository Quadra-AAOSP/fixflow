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
import { useTranslation } from 'react-i18next';

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
 *  - The story panel is stacked *below* the form. On the web it is a side
 *    column; keeping it above the fields (the original port) pushed the submit
 *    button roughly 760px down the page, i.e. off-screen on a 360×640 phone.
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
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top,
            // Clears the iOS home indicator. The footer no longer pads itself,
            // so this is the single source of the bottom gap (24 on web/Android
            // without a gesture bar).
            paddingBottom: Math.max(insets.bottom, 24),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandHeader />
          {/*
           * Order matters on a phone. The editorial panel is ~290px tall; with
           * it above the fields the submit button started around 760px down the
           * page, i.e. off-screen on every common phone viewport (360×640,
           * iPhone SE, and worse once the keyboard is up). The form now comes
           * first so the primary action is reachable without scrolling, and the
           * story panel follows underneath — the brand voice is preserved but
           * can never block sign-in.
           */}
          <View className="px-5">
            <View className="mt-5 w-full max-w-[370px] self-center">
              {children}
            </View>
            <View className="mt-8 w-full max-w-[370px] self-center">
              <StoryPanel />
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
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <View className="h-14 flex-row items-center justify-between px-5">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('components.authShell.homeA11y')}
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
        accessibilityLabel={t('components.authShell.joinCommunity')}
        onPress={() => router.push('/(auth)/register')}
        className="flex-row items-center gap-1.5 active:opacity-70"
      >
        <Text
          className="text-[13px] text-auth-ink"
          style={{ fontFamily: fontFamilies.bodySemiBold }}
        >
          {t('components.authShell.joinCommunity')}
        </Text>
        <ArrowUpRight color={authColors.ink} size={16} />
      </Pressable>
    </View>
  );
}

/** `.story-panel` — the cream editorial card. */
function StoryPanel() {
  const { t } = useTranslation('common');
  return (
    <View className="rounded-[22px] bg-auth-panel px-5 pb-5 pt-6">
      <View className="flex-row items-center gap-2">
        <View className="h-[7px] w-[7px] rounded-full bg-auth-sage" />
        <Text
          className="text-[10px] text-auth-ink"
          style={{ fontFamily: fontFamilies.headBold, letterSpacing: 1.4 }}
        >
          {t('components.authShell.storyKicker')}
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
        {t('components.authShell.storyPlaces')}{'\n'}
        {t('components.authShell.storyPeople')}{'\n'}
        <Text className="text-auth-olive">
          {t('components.authShell.storyAccent')}
        </Text>
      </Text>

      <Text className="mt-3.5 text-[13px] leading-[22px] text-auth-body">
        {t('components.authShell.storyBody')}
      </Text>

      <View className="mt-5 flex-row items-center justify-between">
        <StoryDot dotClassName="bg-coral" label={t('components.authShell.storyReport')} />
        <StoryDot dotClassName="bg-accent" label={t('components.authShell.storyTrack')} />
        <StoryDot dotClassName="bg-lime" label={t('components.authShell.storyHome')} />
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
  const { t } = useTranslation('common');
  return (
    <View className="mt-6 flex-row items-center justify-between">
      <Text className="text-[10px] text-auth-foot">
        {t('components.authShell.footerMadeFor')}
      </Text>
      <Text className="text-[10px] text-auth-foot">
        {t('components.authShell.footerSectors')}{' '}
        <Text className="text-[16px] text-auth-sage-deep">✳</Text>
      </Text>
    </View>
  );
}
