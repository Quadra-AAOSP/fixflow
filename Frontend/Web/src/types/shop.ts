export interface ShopProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string | null;
  imageUrl: string | null;
  priceMinor: number;
  stock: number;
}
export interface ShopCatalog {
  currency: string;
  minorUnitDigits: number;
  products: ShopProduct[];
}

export interface ShopCartItem {
  productId: string;
  quantity: number;
}

export interface ShopQuote {
  currency: string;
  minorUnitDigits: number;
  lines: Array<{
    productId: string;
    name: string;
    unitPriceMinor: number;
    quantity: number;
    lineTotalMinor: number;
    availableStock: number;
  }>;
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
}

export interface ShopCreateOrderResult {
  orderId: string;
  totalMinor: number;
  checkoutUrl: string | null;
  paymentProvider: string | null;
}

export type ShopOrderStatus = 'pending_payment' | 'paid' | 'cancelled' | 'refunded' | 'fulfilled';
export type ShopPaymentStatus = 'requires_action' | 'succeeded' | 'failed' | 'cancelled';

export interface ShopOrder {
  orderId: string;
  status: ShopOrderStatus;
  currency: string;
  minorUnitDigits: number;
  items: Array<{
    productId: string;
    name: string;
    unitPriceMinor: number;
    quantity: number;
    lineTotalMinor: number;
  }>;
  subtotalMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
  shippingName: string;
  shippingPhone: string | null;
  shippingAddress: string;
  checkoutUrl: string | null;
  paymentStatus: ShopPaymentStatus | null;
  createdAt: string;
  updatedAt: string;
}
