import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { BasketLine, ShopProduct, toCartPayload } from '@/utils/shop';

// Define the type for the cart state
interface CartState {
  basket: BasketLine[];
  addToBasket: (product: ShopProduct, quantity: number) => void;
  updateBasketQuantity: (productId: string, quantity: number) => void;
  removeFromBasket: (productId: string) => void;
  clearBasket: () => void;
  getBasketLines: () => BasketLine[];
  getCartPayload: () => BasketLine[];
}

// Create the cart store with Zustand
export const useCartStore = create(
  persist<
    CartState,
    Partial<CartState> & { basket: BasketLine[] },
    [
      'basket',
    ]
  >(
    {
      basket: [],
      addToBasket: (product, quantity) => {
        const existing = useCartStore.getState().basket.find(
          (item) => item.product.id === product.id
        );
        if (existing) {
          useCartStore.setState((state) => {
            return {
              basket: state.basket.map((item) =>
                item.product.id === product.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              ),
            };
          });
        } else {
          useCartStore.setState((state) => ({
            basket: [...state.basket, { product, quantity }],
          }));
        }
      },
      updateBasketQuantity: (productId, quantity) => {
        useCartStore.setState((state) => ({
          basket: state.basket.map((item) =>
            item.product.id === productId ? { ...item, quantity } : item
          ),
        }));
      },
      removeFromBasket: (productId) => {
        useCartStore.setState((state) => ({
          basket: state.basket.filter((item) => item.product.id !== productId),
        }));
      },
      clearBasket: () => {
        useCartStore.setState({ basket: [] });
      },
      getBasketLines: () => {
        return useCartStore.getState().basket;
      },
      getCartPayload: () => {
        return toCartPayload(useCartStore.getState().basket);
      },
    },
    {
      name: 'cart-storage', // Unique name for storage
      storage: createJSONStorage(() => AsyncStorage), // Persist using AsyncStorage
    }
  )
);