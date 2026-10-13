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

/** Search input with a leading icon and a clear affordance. */
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
      <Search color={palette.muted} size={18} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        className="flex-1 py-3 text-base text-ink"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          className="p-1"
        >
          <X color={palette.muted} size={16} />
        </Pressable>
      ) : null}
    </View>
  );
}
