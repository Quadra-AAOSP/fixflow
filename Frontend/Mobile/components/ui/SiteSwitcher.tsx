import { ChevronDown } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { themeColors } from '@/constants/theme';
import { useCurrentSite } from '@/stores/site';

import { Picker } from './Picker';

/**
 * Displays the active site. When more than one site is visible to the caller
 * the label becomes tappable and opens a switcher sheet.
 *
 * `SiteService.list` returns exactly one site for every role except
 * super_admin, who gets `findAll()`. So `sites.length > 1` is on its own a
 * sufficient condition — no role check is needed, and a super_admin with only
 * one site in the database correctly sees no switcher.
 */
export function SiteSwitcher() {
  const { t } = useTranslation('common');
  const palette = themeColors();
  const { site, sites, setActiveSite, loading, error } = useCurrentSite();

  if (error) {
    return (
      <Text className="text-sm text-tone-danger">
        {t('components.siteSwitcher.couldNotLoad')}
      </Text>
    );
  }

  if (loading && !site) {
    return (
      <Text className="text-sm text-muted">
        {t('components.siteSwitcher.loading')}
      </Text>
    );
  }

  if (!site) {
    return (
      <Text className="text-sm text-muted">
        {t('components.siteSwitcher.noSite')}
      </Text>
    );
  }

  const caption = `${site.name} · ${site.type}`;

  if (sites.length <= 1) {
    return <Text className="text-sm text-muted">{caption}</Text>;
  }

  return (
    <Picker
      label={t('components.siteSwitcher.switchLabel')}
      value={String(site.id)}
      options={sites.map((candidate) => ({
        value: String(candidate.id),
        label: candidate.name,
        subtitle: `${candidate.type} · ${candidate.contractStatus}`,
      }))}
      onChange={(next) => setActiveSite(Number(next))}
      renderTrigger={({ open }) => (
        <Pressable
          onPress={open}
          className="flex-row items-center gap-1 active:opacity-70"
          accessibilityRole="button"
          accessibilityHint={t('components.siteSwitcher.switchHint')}
        >
          <Text className="text-sm text-muted">{caption}</Text>
          <ChevronDown color={palette.muted} size={14} />
        </Pressable>
      )}
    />
  );
}