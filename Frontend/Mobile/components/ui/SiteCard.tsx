import { Pencil } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { themeColors } from '@/constants/theme';
import type { Site } from '@/types';

const contractStyles: Record<Site['contractStatus'], string> = {
  contracted: 'bg-tone-success/15',
  uncontracted: 'bg-tone-neutral/15',
};

const contractText: Record<Site['contractStatus'], string> = {
  contracted: 'text-tone-success',
  uncontracted: 'text-tone-neutral',
};

type SiteCardProps = {
  site: Site;
  /** Present only when the caller may edit this site. */
  onEdit?: () => void;
  onPress?: () => void;
  /** Highlights the site currently in context. */
  active?: boolean;
};

export function SiteCard({ site, onEdit, onPress, active }: SiteCardProps) {
  const palette = themeColors();

  return (
    <View
      className={`mb-3 rounded-xl border bg-card p-4 ${
        active ? 'border-primary' : 'border-border'
      }`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-base font-semibold text-ink">{site.name}</Text>
          <Text className="mt-0.5 text-xs text-muted">
            {site.type}
            {site.address ? ` · ${site.address}` : ''}
          </Text>
        </View>

        <View
          className={`rounded-md px-2.5 py-1 ${contractStyles[site.contractStatus]}`}
        >
          <Text
            className={`text-xs font-semibold ${contractText[site.contractStatus]}`}
          >
            {site.contractStatus}
          </Text>
        </View>
      </View>

      {site.description ? (
        <Text className="mt-3 text-sm text-muted" numberOfLines={3}>
          {site.description}
        </Text>
      ) : null}

      {onPress || onEdit ? (
        <View className="mt-4 flex-row items-center gap-3">
          {onPress ? (
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              className="rounded-lg border border-border px-3 py-2 active:opacity-70"
            >
              <Text className="text-sm font-medium text-ink">View reports</Text>
            </Pressable>
          ) : null}

          {onEdit ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${site.name}`}
              className="flex-row items-center gap-1.5 rounded-lg border border-border px-3 py-2 active:opacity-70"
            >
              <Pencil color={palette.muted} size={14} />
              <Text className="text-sm font-medium text-ink">Edit</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
