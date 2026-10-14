import { Search, X } from 'lucide-react-native';
import { Pressable, TextInput, View } from 'react-native';

import { colors, themeColors } from '@/constants/theme';

type SearchFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

/**
 * Search input matching the web's `.dashboard-search`:
 *   - 1px `#dce2e9` border, 8px radius
 *   - leading Search icon in the slate muted
 *   - clear (X) affordance when there's a value
 *   - `fcfdfc` background, 13px text
 *
 * We use `border-border` (which now resolves to `#e9edf0`, the same
 * family as the web's `#dce2e9`) and a 13px-equivalent text size.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search…',
  className,
  autoFocus,
}: SearchFieldProps) {
  const palette = themeColors();

  return (
    <View
      className={`flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 ${
        className ?? ''
      }`}
    >
      <Search color={palette.muted} size={16} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        className="flex-1 py-2.5 text-[13px] text-ink"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          className="p-1"
        >
          <X color={palette.muted} size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}
