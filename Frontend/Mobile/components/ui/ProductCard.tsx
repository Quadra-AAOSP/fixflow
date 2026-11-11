import { Image, Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/components/ui/useToastContext';

import { shopColors } from '@/constants/theme';
import type { ShopProduct } from '@/types';
import {
  PRODUCT_FALLBACK_IMAGE,
  basketCount,
  formatMoney,
  safeImageUrl,
} from '@/utils/shop';

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
const CARD_CLASS = 'flex-1 overflow-hidden rounded-[15px] border border-shop-card-line bg-card';
const IMAGE_ASPECT_RATIO = 1.25;

export function ProductCard({
  product,
  currency,
  minorUnitDigits,
  onPress = () => {},
}: ProductCardProps) {
  const { t } = useTranslation('common');
  const { showToast } = useToast();
  const addToBasket = useCartStore((state) => state.addToBasket);
  const basketLines = useCartStore((state) => state.basket);

  const imageUri = safeImageUrl(product.imageUrl) ?? PRODUCT_FALLBACK_IMAGE;
  const outOfStock = product.stock <= 0;
  // The web disables the card's + button once the basket already holds the
  // product's full stock (no silent clamping); we mirror that here.
  const inBasket =
    basketLines.find((line) => line.product.id === product.id)?.quantity ?? 0;
  const atCap = inBasket >= product.stock;
  const addDisabled = outOfStock || atCap;

  return (
    <View className={CARD_CLASS}>
      {/* Detail-tap overlay — this is a sibling of the plus button, not a
          parent. No nested Pressables means no <button>-in-<button> on web. */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="active:opacity-90"
      >
        <View
          className="w-full items-center justify-center bg-shop-image-bg"
          style={{ aspectRatio: IMAGE_ASPECT_RATIO }}
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
              : t('more.shop.inStockCount', { count: product.stock })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('more.shop.addToBasket')}
          disabled={addDisabled}
          onPress={() => {
            addToBasket(product, 1);
            // Same feedback the web shop toasts after an add, including the
            // updated basket size so the user knows the tap registered.
            showToast(
              t('more.shop.addedToBasket', {
                name: product.name,
                count: basketCount(basketLines) + 1,
                plural: basketCount(basketLines) + 1 === 1 ? '' : 's',
              }),
              'success',
            );
          }}
          hitSlop={10}
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{
            backgroundColor: shopColors.mint,
            opacity: addDisabled ? 0.48 : 1,
          }}
        >
          <Plus color={shopColors.ink} size={16} />
        </Pressable>
      </View>
    </View>
  );
}
