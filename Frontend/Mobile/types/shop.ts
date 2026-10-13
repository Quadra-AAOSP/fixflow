/**
 * Shop domain types. Mirrors the backend shop DTOs exactly — all monetary
 * values are integers in minor units (cents) paired with `minorUnitDigits`,
 * so the client never does float maths on money.
 */

/** Mirrors backend `ShopProductResponse`. */
export type ShopProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  imageUrl: string | null;
  priceMinor: number;
  stock: number;
};

/** Mirrors backend `ShopCatalogResponse`. */
export type ShopCatalog = {
  currency: string;
  minorUnitDigits: number;
  products: ShopProduct[];
};

/** Mirrors backend `ShopCartItemRequest`. */
export type ShopCartItemPayload = {
  productId: string;
  quantity: number;
};

/** Mirrors backend `ShopQuoteLineResponse`. */
export type ShopQuoteLine = {
  productId: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  availableStock: number;
};

/** Mirrors backend `ShopQuoteResponse`. */
export type ShopQuote = {
  currency: string;
  minorUnitDigits: number;
  lines: ShopQuoteLine[];
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
};

/** Mirrors backend `ShopOrderStatus` enum. */
export type ShopOrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'cancelled'
  | 'refunded'
  | 'fulfilled';

/** Mirrors backend `ShopPaymentStatus` enum. */
export type ShopPaymentStatus =
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

/** Mirrors backend `ShopOrderItemResponse`. */
export type ShopOrderItem = {
  productId: string;
  name: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
};

/** Mirrors backend `ShopOrderResponse`. */
export type ShopOrder = {
  orderId: string;
  status: ShopOrderStatus;
  currency: string;
  minorUnitDigits: number;
  items: ShopOrderItem[];
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  checkoutUrl: string | null;
  paymentStatus: ShopPaymentStatus;
  createdAt: string;
  updatedAt: string;
};

/** Mirrors backend `ShopCreateOrderRequest`. */
export type ShopCreateOrderPayload = {
  items: ShopCartItemPayload[];
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
};

/** Mirrors backend `ShopCreateOrderResponse`. */
export type ShopCreateOrderResult = {
  orderId: string;
  totalMinor: number;
  /** Provider-hosted checkout page. `null` when the provider is dev-mode. */
  checkoutUrl: string | null;
  paymentProvider: string;
};
