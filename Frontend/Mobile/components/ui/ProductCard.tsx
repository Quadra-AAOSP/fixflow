import { Image, Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';

import { shopColors } from '@/constants/theme';
import type { ShopProduct } from '@/types';
import { formatMoney, safeImageUrl } from '@/utils/shop';

type ProductCardProps = {
  product: ShopProduct;
  currency: string;
  minorUnitDigits: number;
  onPress: () => void;
};

/** Catalogue tile. Mirrors the web's `.shop-product-card`: a vertical card
 * with the cream image well on top and the copy block below — category
 * eyebrow, name, brand, then price + in-stock note and the round mint add
 * button. The image falls back to a labelled placeholder when the server
 * sends nothing usable, rather than rendering a broken frame. */
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
      className="flex-1 overflow-hidden rounded-[15px] border border-shop-card-line bg-card active:opacity-90"
    >
      <View
        className="w-full items-center justify-center bg-shop-image-well"
        style={{ aspectRatio: 1.25 }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            className="h-full w-full"
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text className="text-[10px] text-shop-image-note-text">
            No image
          </Text>
        )}
      </View>

      <View className="p-3">
        {product.category ? (
          <Text
            className="text-[8px] font-bold uppercase text-shop-eyebrow"
            style={{ letterSpacing: 1.2 }}
            numberOfLines={1}
          >
            {product.category}
          </Text>
        ) : null}
        <Text
          className="mt-1 text-[13px] font-bold text-shop-ink"
          numberOfLines={2}
        >
          {product.name}
        </Text>
        {product.brand ? (
          <Text
            className="mt-0.5 text-[11px] text-shop-copy-text"
            numberOfLines={1}
          >
            {product.brand}
          </Text>
        ) : null}

        <View className="mt-3 flex-row items-end justify-between gap-2">
          <View className="flex-1">
            <Text className="text-[14px] font-bold text-shop-ink">
              {formatMoney(product.priceMinor, minorUnitDigits, currency)}
            </Text>
            <Text
              className={`mt-0.5 text-[10px] ${
                outOfStock ? 'text-tone-danger' : 'text-shop-price-note'
              }`}
            >
              {outOfStock ? 'Out of stock' : 'In stock'}
            </Text>
          </View>
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: shopColors.mint,
              opacity: outOfStock ? 0.48 : 1,
            }}
          >
            <Plus color={shopColors.ink} size={16} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}
