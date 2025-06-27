// src/pages/CompanyProductsPage.tsx (código completo y actualizado)

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { Producto } from '@/types/productos';
import { Empresa } from '@/types/empresas';
import { Categoria } from '@/types/categorias';
import { PaginatedResponse, FilterParams } from '@/types/auth';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Search, ShoppingCart, Info, Store as StoreIcon, ImageIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';

const LOW_STOCK_THRESHOLD = 10;

const CompanyProductsPage: React.FC = () => {
  const { empresaId } = useParams<{ empresaId: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user: currentUser } = useAuth();

  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  const { data: empresaData, isLoading: isLoadingEmpresa, error: empresaError } = useQuery<Empresa, Error>({
    queryKey: ['empresaDetail', empresaId],
    queryFn: async () => {
      if (!empresaId) throw new Error("ID de empresa no proporcionado.");
      return api.getEmpresaById(parseInt(empresaId, 10));
    },
    enabled: !!empresaId,
  });

  const { data: productosData, isLoading: isLoadingProductos, error: productosError } = useQuery<PaginatedResponse<Producto>, Error>({
    queryKey: ['productosByEmpresa', empresaId, productSearchTerm, selectedCategoryFilter],
    queryFn: async ({ queryKey }) => {
      const [_key, currentEmpresaId, currentProductSearchTerm, currentCategoryFilter] = queryKey;
      if (!currentEmpresaId) throw new Error("ID de empresa no proporcionado para productos.");

      const filters: FilterParams & { empresa?: number; categoria?: number; is_active?: boolean } = { 
        empresa: parseInt(currentEmpresaId as string, 10),
        search: currentProductSearchTerm as string || '',
        is_active: true,
      };
      if (currentCategoryFilter && currentCategoryFilter !== 'ALL') {
        filters.categoria = parseInt(currentCategoryFilter as string, 10);
      }
      return api.fetchProductos(filters);
    },
    enabled: !!empresaId,
  });

  const { data: categoriasData, isLoading: isLoadingCategorias } = useQuery<PaginatedResponse<Categoria>, Error>({
    queryKey: ['categoriasForMarketplace', empresaId],
    queryFn: async ({ queryKey }) => {
      const [_key, currentEmpresaId] = queryKey;
      if (!currentEmpresaId) throw new Error("ID de empresa no proporcionado para categorías.");
      return api.fetchCategorias({ empresa: parseInt(currentEmpresaId as string, 10) });
    },
    enabled: !!empresaId,
  });

  const categorias = categoriasData?.results || [];
  const productos = productosData?.results || [];

  const handleProductSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProductSearchTerm(event.target.value);
  };

  const handleCategoryFilterChange = (value: string) => {
    setSelectedCategoryFilter(value);
  };

  const handleAddToCart = (product: Producto) => {
    if (!currentUser) {
      toast({
        variant: "destructive",
        title: "Necesitas iniciar sesión",
        description: "Por favor, inicia sesión para agregar productos al carrito.",
      });
      navigate('/login');
      return;
    }

    if (product.stock <= 0) {
      toast({
        variant: "destructive",
        title: "Producto Agotado",
        description: `Lo sentimos, "${product.nombre}" está fuera de stock.`,
      });
      return;
    }
    addToCart(product);
    toast({
      title: "Producto añadido al carrito",
      description: `"${product.nombre}" se añadió al carrito.`,
    });
    navigate('/cart'); // <-- Redirigir a la página del carrito
  };

  if (isLoadingEmpresa || isLoadingProductos || isLoadingCategorias) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="ml-3 text-lg text-gray-700">Cargando tienda...</p>
      </div>
    );
  }

  if (empresaError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Error al cargar la empresa</AlertTitle>
        <AlertDescription>
          No se pudo cargar la información de la empresa: {empresaError.message}
          <Button onClick={() => navigate('/marketplace')} className="mt-4">Volver al Marketplace</Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (productosError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Error al cargar productos</AlertTitle>
        <AlertDescription>
          No se pudieron cargar los productos de la empresa: {productosError.message}
          <Button onClick={() => navigate('/marketplace')} className="mt-4">Volver al Marketplace</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const empresaNombre = empresaData?.nombre || 'Tienda';

  return (
    <div className="container mx-auto p-8 bg-gray-50 min-h-screen font-sans">
      <div className="flex flex-col items-center justify-center text-center mb-10">
        {empresaData?.logo && (
          <img 
            src={empresaData.logo as string} 
            alt={`Logo de ${empresaNombre}`} 
            className="w-24 h-24 object-contain rounded-full shadow-lg mb-4 border-2 border-indigo-200"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/96x96/e2e8f0/64748b?text=Logo`; }}
          />
        )}
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">{empresaNombre}</h1>
        <p className="text-lg text-gray-700 max-w-2xl">{empresaData?.descripcion_corta || 'Descubre nuestros productos de calidad.'}</p>
        {empresaData?.email_contacto && (
            <p className="text-md text-gray-600 mt-2">Contacto: <a href={`mailto:${empresaData.email_contacto}`} className="text-indigo-600 hover:underline">{empresaData.email_contacto}</a></p>
        )}
      </div>

      {/* Filtros y búsqueda */}
      <div className="mb-8 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4 bg-white p-5 rounded-xl shadow-md border border-gray-200">
        <div className="relative flex-grow w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <Input
            type="text"
            placeholder="Buscar productos por nombre o descripción..."
            value={productSearchTerm}
            onChange={handleProductSearchChange}
            className="w-full pl-10 pr-4 py-2 border rounded-full shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <Select
          value={selectedCategoryFilter}
          onValueChange={handleCategoryFilterChange}
          disabled={isLoadingCategorias}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Filtrar por categoría" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingCategorias ? (
              <SelectItem value="loading-categories" disabled>Cargando categorías...</SelectItem>
            ) : (
              <>
                <SelectItem value="ALL">Todas las categorías</SelectItem>
                {categorias.map(cat => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>{cat.nombre}</SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {productos.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-lg border border-gray-200">
          <p className="text-2xl text-gray-600">
            No hay productos disponibles en esta tienda que coincidan con tu búsqueda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {productos.map((producto) => {
            const originalPrice = parseFloat(producto.precio);
            const discountRate = parseFloat(producto.descuento || '0');
            const hasDiscount = discountRate > 0;
            const finalPrice = originalPrice * (1 - discountRate);

            return (
              <Card 
                key={producto.id} 
                className="group relative flex flex-col justify-between overflow-hidden rounded-xl shadow-lg 
                           hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 
                           border border-gray-200 bg-white animate-fade-in"
              >
                {hasDiscount && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full z-10 shadow-md transform rotate-3 scale-105 group-hover:scale-110 transition-transform duration-300">
                    -{Math.round(discountRate * 100)}% OFF!
                  </div>
                )}
                
                <div className="relative w-full h-48 sm:h-56 overflow-hidden flex items-center justify-center bg-gray-100 rounded-t-xl">
                  {producto.imagen ? (
                    <img
                      src={producto.imagen as string}
                      alt={producto.nombre}
                      className="object-contain h-full w-full p-2 transform group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/200x200/e2e8f0/64748b?text=No+Img`; }}
                    />
                  ) : (
                    <ImageIcon className="h-20 w-20 text-gray-400" />
                  )}
                </div>

                <CardContent className="flex-grow p-4 flex flex-col">
                  <CardTitle className="text-lg font-bold text-gray-800 mb-1 line-clamp-2">
                    {producto.nombre}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 mb-2 line-clamp-3">
                    {producto.descripcion || 'Sin descripción.'}
                  </CardDescription>

                  <div className="flex items-baseline mb-3 mt-auto">
                    {hasDiscount && (
                      <span className="text-gray-500 line-through text-sm mr-2 opacity-80">{"$"}{originalPrice.toFixed(2)}</span>
                    )}
                    <span className="text-xl font-extrabold text-indigo-700">{"$"}{finalPrice.toFixed(2)}</span>
                  </div>

                  {producto.stock <= LOW_STOCK_THRESHOLD && producto.stock > 0 && (
                    <p className="text-orange-500 text-xs font-semibold mb-2 animate-pulse">
                      ¡Poco Stock! ({producto.stock} unidades)
                    </p>
                  )}
                  {producto.stock === 0 && (
                    <p className="text-red-500 text-xs font-semibold mb-2">
                      Agotado
                    </p>
                  )}

                  <div className="flex flex-col space-y-2 mt-4">
                    <Button 
                      onClick={() => handleAddToCart(producto)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg 
                                 transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                                 transform hover:scale-105"
                      disabled={producto.stock === 0}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" /> Agregar al Carrito
                    </Button>
                    <Link to={`/public-products/${producto.id}`}>
                      <Button 
                        variant="outline" 
                        className="w-full border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 
                                   font-semibold py-2 rounded-lg transition-all duration-300 shadow-sm hover:shadow-md
                                   transform hover:scale-105"
                      >
                        <Info className="mr-2 h-4 w-4" /> Ver Detalle
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CompanyProductsPage;