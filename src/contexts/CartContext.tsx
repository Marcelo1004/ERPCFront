// src/contexts/CartContext.tsx (NUEVO ARCHIVO)
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Producto } from '@/types/productos'; // Asumiendo que tu interfaz Producto está definida aquí

interface CartItem extends Producto {
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Producto, quantity?: number) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, newQuantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const addToCart = (product: Producto, quantityToAdd: number = 1) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.findIndex(item => item.id === product.id);

      if (existingItemIndex > -1) {
        // Actualizar cantidad si el artículo ya existe
        const updatedCart = [...prevCart];
        updatedCart[existingItemIndex].quantity += quantityToAdd;
        // Asegurarse de que la cantidad no exceda el stock del producto
        if (updatedCart[existingItemIndex].quantity > updatedCart[existingItemIndex].stock) {
            updatedCart[existingItemIndex].quantity = updatedCart[existingItemIndex].stock;
        }
        return updatedCart;
      } else {
        // Añadir nuevo artículo al carrito
        // Asegurarse de que la cantidad no exceda el stock al añadir
        return [...prevCart, { ...product, quantity: quantityToAdd > product.stock ? product.stock : quantityToAdd }];
      }
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, newQuantity: number) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === productId) {
        // Asegurarse de que la nueva cantidad no sea menor que 1 y no mayor que el stock
        const quantity = Math.max(1, Math.min(newQuantity, item.stock));
        return { ...item, quantity };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => {
      const price = parseFloat(item.precio);
      const discount = parseFloat(item.descuento || '0');
      const finalPrice = price * (1 - discount);
      return total + (finalPrice * item.quantity);
    }, 0);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, getTotalItems, getTotalPrice }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};