import type { ImageSourcePropType } from 'react-native';

import { safeImageUrl } from './shop';

/**
 * Product photography shipped with the app bundle.
 *
 * The catalogue used to hotlink every photo, which left tiles blank whenever
 * the CDN was unreachable. The demo products now carry their photo locally
 * (downloaded once into `assets/images/shop/`), so the shop renders offline and
 * without depending on a third-party host.
 */
export const PRODUCT_IMAGES: Record<string, ImageSourcePropType> = {
  'cordless-drill-18v': require('../assets/images/shop/cordless-drill-18v.jpg'),
  'multi-bit-set': require('../assets/images/shop/multi-bit-set.jpg'),
  'adjustable-wrench': require('../assets/images/shop/adjustable-wrench.jpg'),
  'led-work-light': require('../assets/images/shop/led-work-light.jpg'),
  'cable-ties-pack': require('../assets/images/shop/cable-ties-pack.jpg'),
  'silicone-sealant': require('../assets/images/shop/silicone-sealant.jpg'),
  'safety-gloves': require('../assets/images/shop/safety-gloves.jpg'),
  'toolbox-small': require('../assets/images/shop/toolbox-small.jpg'),
  'tape-measure-5m': require('../assets/images/shop/tape-measure-5m.jpg'),
  'safety-goggles': require('../assets/images/shop/safety-goggles.jpg'),
  'utility-knife': require('../assets/images/shop/utility-knife.jpg'),
  'extension-lead-10m': require('../assets/images/shop/extension-lead-10m.jpg'),
  'claw-hammer-450g': require('../assets/images/shop/claw-hammer-450g.jpg'),
  'insulated-pliers': require('../assets/images/shop/insulated-pliers.jpg'),
};

type ProductImageInput = {
  id: string;
  imageUrl?: string | null;
};

/**
 * Bundled photo first; a server-supplied URL second (covers products an admin
 * adds later); `null` when neither is usable so callers can show the neutral
 * placeholder instead of a broken frame.
 */
export function productImageSource(
  product: ProductImageInput,
): ImageSourcePropType | null {
  const bundled = PRODUCT_IMAGES[product.id];
  if (bundled) return bundled;

  const remote = safeImageUrl(product.imageUrl);
  return remote ? { uri: remote } : null;
}
