import Constants from 'expo-constants';
import {
  Info,
  Moon,
  Settings as SettingsIcon,
  Smartphone,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import {
  dashboardColors,
  themeColors,
  type ThemeMode,
} from '@/constants/theme';
import { useThemeMode } from '@/stores/theme';

/**
 * Settings — reached from the gear on the Profile screen (and the More menu).
 *
 * Currently hosts the appearance switch: a Light/Dark segmented control wired
 * to `stores/theme`, which re-themes the whole app (palette getters +
 * CSS-variable override at the root). Plus a small About block.
 *
 * Chrome follows the dashboard/More treatment so it stays consistent with the
 * rest of the secondary screens — and, because every token here is semantic,
 * it flips cleanly with the theme it controls.
 */
export default function SettingsScreen() {
  const { mode, setMode } = useThemeMode();
  const palette = themeColors();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <ScrollView contentContainerClassName="px-5 pb-12 pt-4">
        {/* Header — mirrors the More menu's compressed banner. */}
        <View className="mb-5 flex-row items-center gap-3">
          <View
            className="rounded-xl p-3"
            style={{ backgroundColor: dashboardColors.statMintSoft }}
          >
            <SettingsIcon color={dashboardColors.statMintDeep} size={26} />
          </View>
          <View className="flex-1">
            <Text
              className="text-2xl font-bold text-ink"
              style={{ letterSpacing: -0.5 }}
            >
              Settings
            </Text>
            <Text className="mt-0.5 text-xs text-dashboard-subtitle">
              Make fixflow feel right for you.
            </Text>
          </View>
        </View>

        <SectionLabel>Appearance</SectionLabel>
        <Card className="mb-6">
          <Text className="text-[13px] font-semibold text-ink">Theme</Text>
          <Text className="mt-1 text-[11px] leading-[18px] text-dashboard-subtitle">
            Choose how the app looks. {mode === 'dark' ? 'Dark' : 'Light'} is on
            right now.
          </Text>
          <ThemeSegmented mode={mode} onChange={setMode} />
        </Card>

        <SectionLabel>About</SectionLabel>
        <Card className="mb-6">
          <InfoRow
            icon={Smartphone}
            label="App version"
            value={version}
            tint={palette.muted}
          />
          <View className="my-3 border-t border-dashboard-card-line" />
          <InfoRow
            icon={Info}
            label="Build"
            value="fixflow mobile"
            tint={palette.muted}
          />
        </Card>

        <Text className="mt-2 px-1 text-[10px] leading-[16px] text-dashboard-caption">
          Made for the places we share.
        </Text>
      </ScrollView>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function ThemeSegmented({
  mode,
  onChange,
}: {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}) {
  const palette = themeColors();
  const options: { value: ThemeMode; label: string; Icon: LucideIcon }[] = [
    { value: 'light', label: 'Light', Icon: Sun },
    { value: 'dark', label: 'Dark', Icon: Moon },
  ];

  return (
    <View className="mt-4 flex-row gap-2 rounded-2xl border border-dashboard-card-line bg-surface p-1.5">
      {options.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <Pressable
            key={value}
            onPress={() => onChange(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 active:opacity-80"
            style={active ? { backgroundColor: dashboardColors.statMintSoft } : undefined}
          >
            <Icon
              color={active ? dashboardColors.statMintDeep : palette.muted}
              size={16}
            />
            <Text
              className="text-[13px] font-semibold"
              style={{ color: active ? dashboardColors.statMintDeep : palette.muted }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <View className="flex-row items-center gap-2.5">
        <Icon color={tint} size={16} strokeWidth={1.8} />
        <Text className="text-[13px] text-ink">{label}</Text>
      </View>
      <Text className="text-[13px] font-medium text-dashboard-subtitle">
        {value}
      </Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <View className="mb-2 mt-1 flex-row items-center gap-2 px-1">
      <View
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: dashboardColors.statCitronDeep }}
      />
      <Text
        className="text-[10px] font-semibold uppercase text-dashboard-subtitle"
        style={{ letterSpacing: 1.2 }}
      >
        {children}
      </Text>
    </View>
  );
}
