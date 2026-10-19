import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/components/ui/Screen';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';
import { setLocale } from '@/constants/i18n';
import { dashboardColors } from '@/constants/theme';
import { useThemeMode } from '@/stores/theme';

/**
 * App-wide settings — theme + language. Mirrors `SettingsView.vue`.
 * Language picker calls `setLocale` from `constants/i18n.ts` and reads the
 * current locale from `i18n.language`.
 */
export default function SettingsScreen() {
  const { t, i18n } = useTranslation('common');
  const { mode, setMode } = useThemeMode();

  // Sync the persisted i18n locale on mount (e.g. returning after OS locale
  // change). The language segmented control reflects `i18n.language`.
  useEffect(() => {
    setLocale(i18n.language);
  }, [i18n.language]);

  const LANGUAGE_OPTIONS: SegmentedOption<string>[] = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '简体中文' },
  ];

  const THEME_OPTIONS: SegmentedOption<'light' | 'dark'>[] = [
    { value: 'light', label: t('settings.light') },
    { value: 'dark', label: t('settings.dark') },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <ScrollView contentContainerClassName="px-5 pb-8 pt-4">
        <Text
          className="mb-5 text-2xl font-bold text-ink"
          style={{ letterSpacing: -0.6 }}
        >
          {t('settings.title')}
        </Text>
        <Text className="mb-6 text-[12px] leading-[1.7] text-dashboard-subtitle">
          {t('settings.tagline')}
        </Text>

        <SectionHeader label={t('settings.appearanceSection')} />
        <View className="mb-4 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg px-4 py-3">
          <Text className="mb-2 text-[13px] font-semibold text-ink">
            {t('settings.themeLabel')}
          </Text>
          <SegmentedControl
            options={THEME_OPTIONS}
            value={mode}
            onChange={setMode}
          />
          <Text className="mt-2 text-[10px] leading-[1.6] text-dashboard-caption">
            {t('settings.themeHint', { current: t(`settings.${mode}`) })}
          </Text>
        </View>

        <SectionHeader label={t('settings.languageSection')} />
        <View className="mb-4 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg px-4 py-3">
          <Text className="mb-2 text-[13px] font-semibold text-ink">
            {t('settings.languageLabel')}
          </Text>
          <SegmentedControl
            options={LANGUAGE_OPTIONS}
            value={i18n.language}
            onChange={(locale) => setLocale(locale)}
          />
          <Text className="mt-2 text-[10px] leading-[1.6] text-dashboard-caption">
            {t('settings.languageHint')}
          </Text>
        </View>

        <SectionHeader label={t('settings.aboutSection')} />
        <View className="mb-4 rounded-xl border border-dashboard-card-line bg-dashboard-card-bg px-4 py-3">
          <Row label={t('settings.appVersion')} value={t('settings.buildValue')} />
          <Row label={t('settings.build')} value={t('settings.buildValue')} />
        </View>

        <Text className="text-center text-[10px] text-dashboard-caption">
          {t('settings.footer')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-dashboard-caption">
      {label}
    </Text>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-1.5">
      <Text className="text-[11px] text-dashboard-caption">{label}</Text>
      <Text className="text-[12px] text-ink">{value}</Text>
    </View>
  );
}
