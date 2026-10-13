import { Image, Pressable, Text, View } from 'react-native';

import type { ShopProduct } from '@/types';
import { formatMoney, safeImageUrl } from '@/utils/shop';

type ProductCardProps = {
  product: ShopProduct;
  currency: string;
  minorUnitDigits: number;
  onPress: () => void;
};

/** Catalogue tile. Image falls back to a labelled placeholder when the
 * server sends nothing usable, rather than rendering a broken frame. */
export function ProductCard({
  product,
  currency,
  minorUnitDigits,
  onPress,
}: ProductCardProps) {
  const imageUri = safeImageUrl(product.imageUrl);
  const outOfStock = product.stock <= 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mb-3 flex-row gap-3 rounded-xl border border-border bg-card p-3 active:opacity-80"
    >
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          className="h-20 w-20 rounded-lg bg-border/40"
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View className="h-20 w-20 items-center justify-center rounded-lg bg-border/40">
          <Text className="text-[10px] text-muted">No image</Text>
        </View>
      )}

      <View className="flex-1 justify-between py-0.5">
        <View>
          <Text className="text-sm font-semibold text-ink" numberOfLines={2}>
            {product.name}
          </Text>
          {product.brand ? (
            <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-primary">
            {formatMoney(product.priceMinor, minorUnitDigits, currency)}
          </Text>
          <Text
            className={`text-xs ${outOfStock ? 'text-tone-danger' : 'text-muted'}`}
          >
            {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
