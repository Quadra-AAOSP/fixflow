import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ShopCartItemPayload, ShopProduct } from '@/types';
import { BasketLine, toCartPayload } from '@/utils/shop';

interface CartState {
  basket: BasketLine[];
  addToBasket: (product: ShopProduct, quantity?: number) => void;
  updateBasketQuantity: (productId: string, quantity: number) => void;
  removeFromBasket: (productId: string) => void;
  clearBasket: () => void;
  getBasketLines: () => BasketLine[];
  getCartPayload: () => ShopCartItemPayload[];
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      basket: [],
      // Adds are clamped to the product's stock snapshot, mirroring the web
      // shop's `setQuantity` behaviour (the + button disables at the cap).
      addToBasket: (product, quantity = 1) => {
        set((state) => {
          const cap = Math.max(0, product.stock);
          if (cap === 0) return state;
          const existing = state.basket.find(
            (item) => item.product.id === product.id,
          );
          if (existing) {
            return {
              basket: state.basket.map((item) =>
                item.product.id === product.id
                  ? {
                      ...item,
                      quantity: Math.min(cap, item.quantity + quantity),
                    }
                  : item,
              ),
            };
          }
          return {
            basket: [
              ...state.basket,
              { product, quantity: Math.min(cap, quantity) },
            ],
          };
        });
      },
      // Stepping a line down to 0 removes it, matching the web basket's
      // per-line Remove affordance.
      updateBasketQuantity: (productId, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return {
              basket: state.basket.filter(
                (item) => item.product.id !== productId,
              ),
            };
          }
          return {
            basket: state.basket.map((item) =>
              item.product.id === productId
                ? {
                    ...item,
                    quantity: Math.min(quantity, Math.max(1, item.product.stock)),
                  }
                : item,
            ),
          };
        });
      },
      removeFromBasket: (productId) => {
        set((state) => ({
          basket: state.basket.filter((item) => item.product.id !== productId),
        }));
      },
      clearBasket: () => set({ basket: [] }),
      getBasketLines: () => get().basket,
      getCartPayload: () => toCartPayload(get().basket),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
