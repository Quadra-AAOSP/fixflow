import { Image, Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/stores/cart';

import { shopColors } from '@/constants/theme';
import type { ShopProduct } from '@/types';
import { formatMoney, safeImageUrl } from '@/utils/shop';

// Same editorial photography the web shop uses as its fallback tiles
// (`ShopView.vue` `ProductImage`). Kept at module-level so it's reused.
const FALLBACK_IMAGE =
  'https://images.pexels.com/photos/11398216/pexels-photo-11398216.jpeg?auto=compress&cs=tinysrgb&w=600';

type ProductCardProps = {
  product: ShopProduct;
  currency: string;
  minorUnitDigits: number;
  onPress?: () => void;
};

/**
 * Catalogue tile. Mirrors the web's `.shop-product-card`: a vertical card
 * with the cream image well on top and the copy block below — category
 * eyebrow, name, brand, then price + in-stock note and the round mint add
 * button. The image falls back to the web's editorial placeholder when the
 * server sends nothing usable, rather than rendering a broken frame.
 *
 * The card is a View (not a Pressable) because it contains two sibling
 * tappable regions — the detail-tap overlay on the image block and the plus
 * button. Nesting one Pressable inside another produces a DOM error on web
 * (<button> inside <button>); sibling Pressables render cleanly everywhere.
 */
export function ProductCard({
  product,
  currency,
  minorUnitDigits,
  onPress = () => {},
}: ProductCardProps) {
  const { t } = useTranslation('common');
  const addToBasket = useCartStore((state) => state.addToBasket);

  const imageUri = safeImageUrl(product.imageUrl) ?? FALLBACK_IMAGE;
  const outOfStock = product.stock <= 0;

  return (
    <View className="flex-1 overflow-hidden rounded-[15px] border border-shop-card-line bg-card">
      {/* Detail-tap overlay — this is a sibling of the plus button, not a
          parent. No nested Pressables means no <button>-in-<button> on web. */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="active:opacity-90"
      >
        <View
          className="w-full items-center justify-center bg-shop-image-bg"
          style={{ aspectRatio: 1.25 }}
        >
          <Image
            source={{ uri: imageUri }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </View>

        <View className="p-3">
          {product.category ? (
            <Text
              className="text-[8px] font-bold uppercase text-shop-foot-text"
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
              className="mt-0.5 text-[11px] text-shop-product-body"
              numberOfLines={1}
            >
              {product.brand}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* Bottom row — price + plus, siblings of the detail-tap Pressable.
          The plus button is its own Pressable, not nested inside another. */}
      <View className="flex-row items-end justify-between gap-2 px-3 pb-3">
        <View className="flex-1">
          <Text className="text-[14px] font-bold text-shop-ink">
            {formatMoney(product.priceMinor, minorUnitDigits, currency)}
          </Text>
          <Text
            className={`mt-0.5 text-[10px] ${
              outOfStock ? 'text-tone-danger' : 'text-shop-product-foot'
            }`}
          >
            {outOfStock
              ? t('more.shop.outOfStock')
              : t('more.shop.inStock')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('more.shop.addToBasket')}
          disabled={outOfStock}
          onPress={() => addToBasket(product, 1)}
          hitSlop={10}
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{
            backgroundColor: shopColors.mint,
            opacity: outOfStock ? 0.48 : 1,
          }}
        >
          <Plus color={shopColors.ink} size={16} />
        </Pressable>
      </View>
    </View>
  );
}
