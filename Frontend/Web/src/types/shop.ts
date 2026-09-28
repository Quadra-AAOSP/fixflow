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
