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
      addToBasket: (product, quantity = 1) => {
        set((state) => {
          const existing = state.basket.find(
            (item) => item.product.id === product.id,
          );
          if (existing) {
            return {
              basket: state.basket.map((item) =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item,
              ),
            };
          }
          return { basket: [...state.basket, { product, quantity }] };
        });
      },
      updateBasketQuantity: (productId, quantity) => {
        set((state) => ({
          basket: state.basket.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item,
          ),
        }));
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
