import { Pencil } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import type { Site } from '@/types';
import { humanize } from '@/utils/format';

type SiteCardProps = {
  site: Site;
  /** Present only when the caller may edit this site. */
  onEdit?: () => void;
  onPress?: () => void;
  /** Highlights the site currently in context. */
  active?: boolean;
};

/**
 * Site card matching the web's `.site-card` block:
 *   - title + mint `humanize(type)` status badge
 *   - description / address with the web's "No … provided." fallbacks
 *   - "Contract: … · Site ID: …" line
 *   - 11px radius, 1px `#e9edf0` border, 16px padding
 *   - active state: 1.5px teal `#008e82` border
 *   - secondary text actions: outlined buttons in `text-action` teal
 */
export function SiteCard({ site, onEdit, onPress, active }: SiteCardProps) {
  return (
    <View
      className={`mb-3 rounded-[11px] border bg-card p-4 ${
        active
          ? 'border-[1.5px] border-dashboard-teal'
          : 'border-border'
      }`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className="text-[15px] font-semibold text-ink"
            style={{ letterSpacing: -0.3 }}
          >
            {site.name}
          </Text>
          <Text className="mt-0.5 text-[11px] text-subtitle">
            {site.address || 'No address provided.'}
          </Text>
        </View>

        <View className="rounded-md bg-mint-bg px-2.5 py-1">
          <Text className="text-[10px] font-semibold text-mint-ink">
            {humanize(site.type)}
          </Text>
        </View>
      </View>

      <Text className="mt-3 text-[12px] leading-[1.7] text-subtitle" numberOfLines={3}>
        {site.description || 'No description provided.'}
      </Text>

      <Text className="mt-1.5 text-[11px] text-subtitle">
        Contract: {humanize(site.contractStatus)} · Site ID: {site.id}
      </Text>

      {onPress || onEdit ? (
        <View className="mt-4 flex-row items-center gap-3">
          {onPress ? (
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              className="rounded-md border border-border bg-card px-3 py-2 active:opacity-70"
            >
              <Text className="text-[11px] font-semibold" style={{ color: colors.mintInk }}>
                View reports →
              </Text>
            </Pressable>
          ) : null}

          {onEdit ? (
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${site.name}`}
              className="flex-row items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 active:opacity-70"
            >
              <Pencil color={colors.muted} size={13} strokeWidth={1.6} />
              <Text className="text-[11px] font-semibold" style={{ color: colors.mintInk }}>
                Edit site
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
