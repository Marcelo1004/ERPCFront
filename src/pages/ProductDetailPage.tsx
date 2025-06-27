// src/pages/ProductDetailPage.tsx (código completo y actualizado)

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { Producto } from '@/types/productos';
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Loader2, ArrowLeft, ShoppingCart, Tag, Warehouse, MapPin, Briefcase, ImageIcon, Store as StoreIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';

const LOW_STOCK_THRESHOLD = 10;

const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user: currentUser } = useAuth();

  const { data: producto, isLoading, error } = useQuery<Producto, Error>({
    queryKey: ['productDetail', productId],
    queryFn: async () => {
      if (!productId) throw new Error("ID de producto no proporcionado.");
      return api.getProductoById(parseInt(productId, 10));
    },
    enabled: !!productId,
  });

  const handleAddToCart = () => {
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Necesitas iniciar sesión",
        description: "Por favor, inicia sesión para agregar productos al carrito.",
      });
      navigate('/login');
      return;
    }

    if (producto) {
      if (producto.stock <= 0) {
        toast({
          variant: "destructive",
          title: "Producto Agotado",
          description: `Lo sentimos, "${producto.nombre}" está fuera de stock.`,
        });
        return;
      }
      addToCart(producto);
      toast({
        title: "Producto añadido al carrito",
        description: `"${producto.nombre}" se añadió al carrito.`,
      });
      navigate('/cart'); // <-- Redirigir a la página del carrito
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="ml-3 text-lg text-gray-700">Cargando detalles del producto...</p>
      </div>
    );
  }

  if (error || !producto) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Error al cargar producto</AlertTitle>
        <AlertDescription>
          No se pudo cargar la información del producto o el producto no existe: {error?.message || 'Error desconocido'}.
          <Button onClick={() => navigate(-1)} className="mt-4">Volver</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const originalPrice = parseFloat(producto.precio);
  const discountRate = parseFloat(producto.descuento || '0');
  const hasDiscount = discountRate > 0;
  const finalPrice = originalPrice * (1 - discountRate);

  return (
    <div className="container mx-auto p-8 bg-gray-50 min-h-screen font-sans">
      <Button 
        onClick={() => navigate(-1)} 
        variant="outline" 
        className="mb-6 flex items-center text-indigo-600 hover:text-indigo-800 border-indigo-500 hover:bg-indigo-50 transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a la Tienda
      </Button>

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Sección de Imagen */}
        <div className="relative flex justify-center items-center h-80 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
          {producto.imagen ? (
            <img 
              src={producto.imagen as string} 
              alt={producto.nombre} 
              className="max-h-full max-w-full object-contain p-4 animate-fade-in"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/300x300/e2e8f0/64748b?text=No+Image`; }}
            />
          ) : (
            <ImageIcon className="h-28 w-28 text-gray-400" />
          )}
           {hasDiscount && (
            <div className="absolute top-4 right-4 bg-red-600 text-white text-md font-bold px-4 py-2 rounded-full shadow-lg transform rotate-3">
              -{Math.round(discountRate * 100)}% OFF!
            </div>
          )}
        </div>

        {/* Sección de Detalles del Producto */}
        <div className="flex flex-col space-y-4">
          <h1 className="text-4xl font-extrabold text-gray-900 leading-tight">{producto.nombre}</h1>
          <p className="text-gray-700 text-lg leading-relaxed">{producto.descripcion || 'Este producto no tiene una descripción detallada.'}</p>

          <div className="flex items-baseline space-x-3 my-4">
            {hasDiscount && (
              <span className="text-gray-500 line-through text-xl font-semibold opacity-80">{"$"}{originalPrice.toFixed(2)}</span>
            )}
            <span className="text-4xl font-extrabold text-indigo-700">{"$"}{finalPrice.toFixed(2)}</span>
          </div>

          <div className="space-y-2 text-gray-700">
            <p className="flex items-center text-lg"><Tag className="mr-2 h-5 w-5 text-indigo-500" />Categoría: <span className="font-semibold ml-2">{producto.categoria_detail?.nombre || 'N/A'}</span></p>
            <p className="flex items-center text-lg"><Warehouse className="mr-2 h-5 w-5 text-indigo-500" />Stock Disponible: 
              <span className={`font-semibold ml-2 ${producto.stock <= LOW_STOCK_THRESHOLD && producto.stock > 0 ? 'text-orange-500' : producto.stock === 0 ? 'text-red-500' : 'text-gray-800'}`}>
                {producto.stock} unidades
              </span>
            </p>
            {producto.stock <= LOW_STOCK_THRESHOLD && producto.stock > 0 && (
                <p className="text-orange-500 text-sm font-semibold animate-pulse">¡Date prisa, quedan pocas unidades!</p>
            )}
            {producto.stock === 0 && (
                <p className="text-red-500 text-sm font-semibold">Producto Agotado, no disponible para compra.</p>
            )}
            <p className="flex items-center text-lg"><MapPin className="mr-2 h-5 w-5 text-indigo-500" />Almacén: <span className="font-semibold ml-2">{producto.almacen_detail?.nombre || 'N/A'}</span></p>
            <p className="flex items-center text-lg"><StoreIcon className="mr-2 h-5 w-5 text-indigo-500" />Sucursal: <span className="font-semibold ml-2">{producto.almacen_detail?.sucursal_detail?.nombre || 'N/A'}</span></p>
            {producto.empresa_detail && (
                <p className="flex items-center text-lg"><Briefcase className="mr-2 h-5 w-5 text-indigo-500" />Vendido por: <span className="font-semibold ml-2">{producto.empresa_detail.nombre}</span></p>
            )}
          </div>

          <Button 
            onClick={handleAddToCart}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg 
                       text-lg transition-all duration-300 shadow-lg hover:shadow-xl mt-6
                       transform hover:scale-105"
            disabled={producto.stock === 0}
          >
            <ShoppingCart className="mr-3 h-5 w-5" /> Agregar al Carrito
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;