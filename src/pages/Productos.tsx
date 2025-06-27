// src/pages/Productos.tsx

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Producto } from '@/types/productos';
import { Categoria } from '@/types/categorias';
import { Almacen } from '@/types/almacenes';
import { Sucursal } from '@/types/sucursales';
import { Empresa } from '@/types/empresas';
import { PaginatedResponse, FilterParams } from '@/types/auth'; 

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Search, Package, Tag, Warehouse, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Umbral para stock bajo
const LOW_STOCK_THRESHOLD = 10;

// Estado inicial para el formulario de producto
const initialFormData = {
  nombre: '',
  descripcion: '',
  precio: '0.00', 
  stock: 0,
  imagen: null,
  imagen_file: null,
  descuento: '0.00', 
  categoria: undefined,
  almacen: undefined,
  empresa: undefined,
};

// Función de debounce
const debounce = (func: Function, delay: number) => {
  let timeout: NodeJS.Timeout;
  return function(...args: any[]) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
};

const Productos = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [formData, setFormData] = useState<Partial<Producto & { imagen_file?: File | null }>>(initialFormData);
  const [formErrors, setFormErrors] = useState<any>({});
  
  const [productSearchInputValue, setProductSearchInputValue] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedSucursalInForm, setSelectedSucursalInForm] = useState<number | undefined>(undefined);

  const canManageProducts = currentUser?.is_superuser || currentUser?.role?.name === 'Administrador';

  const debouncedSetProductSearchTerm = useCallback(
    debounce((value: string) => {
      console.log("DEBUG: Debounced search term applied:", value);
      setProductSearchTerm(value);
    }, 500),
    []
  );

  const { data: productosData, isLoading: isLoadingProductos, isFetching: isFetchingProductos, error: productosError } = useQuery<PaginatedResponse<Producto>, Error>({
    queryKey: ['productosList', productSearchTerm, selectedCategoryFilter, currentUser?.empresa, currentUser?.is_superuser],
    queryFn: async ({ queryKey }) => {
      const [_key, currentProductSearchTerm, currentCategoryFilter, empresaId, isSuperuser] = queryKey;
      const filters: FilterParams & { empresa?: number; categoria?: number } = { search: currentProductSearchTerm as string || '' };

      if (!isSuperuser && empresaId) {
        filters.empresa = empresaId as number;
      }
      if (currentCategoryFilter && currentCategoryFilter !== 'ALL') {
        filters.categoria = parseInt(currentCategoryFilter as string, 10);
      }
      console.log("DEBUG: Fetching productos with filters (from queryFn):", filters);
      try {
        const result = await api.fetchProductos(filters);
        console.log("DEBUG: Productos fetched successfully (inside queryFn):", result);
        return result;
      } catch (err) {
        console.error("DEBUG: Error fetching productos (inside queryFn):", err);
        throw err;
      }
    },
    enabled: !!currentUser?.id && canManageProducts,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  const productos = productosData?.results || [];

  useEffect(() => {
    console.log("DEBUG: Productos Component Render. isLoadingProductos:", isLoadingProductos, "isFetchingProductos:", isFetchingProductos);
    console.log("DEBUG: Current productSearchTerm:", productSearchTerm);
    console.log("DEBUG: Current selectedCategoryFilter:", selectedCategoryFilter);
  },
    [isLoadingProductos, isFetchingProductos, productSearchTerm, selectedCategoryFilter]);

  const { data: categoriasData, isLoading: isLoadingCategorias } = useQuery<PaginatedResponse<Categoria>, Error>({
    queryKey: ['categoriasForProductForm', currentUser?.empresa, currentUser?.is_superuser],
    queryFn: ({ queryKey }) => {
      const [_key, empresaId, isSuperuser] = queryKey;
      const filters: FilterParams & { empresa?: number } = {};
      if (!isSuperuser && empresaId) {
        filters.empresa = empresaId as number;
      }
      return api.fetchCategorias(filters);
    },
    enabled: canManageProducts,
  });
  const categorias = categoriasData?.results || [];

  const { data: sucursalesData, isLoading: isLoadingSucursales } = useQuery<PaginatedResponse<Sucursal>, Error>({
    queryKey: ['sucursalesForProductForm', currentUser?.empresa, currentUser?.is_superuser, formData.empresa],
    queryFn: ({ queryKey }) => {
      const [_key, userEmpresaId, isSuperuser, formSelectedEmpresaId] = queryKey;
      const filters: FilterParams & { empresa?: number } = {};

      if (isSuperuser && formSelectedEmpresaId) {
        filters.empresa = formSelectedEmpresaId as number;
      } else if (!isSuperuser && userEmpresaId) {
        filters.empresa = userEmpresaId as number;
      } else if (isSuperuser && !formSelectedEmpresaId) {
        return Promise.resolve({ results: [], count: 0, next: null, previous: null });
      }

      console.log("DEBUG: Fetching sucursales with filters:", filters);
      return api.fetchSucursales(filters);
    },
    enabled: isFormOpen && canManageProducts,
  });
  const sucursales = sucursalesData?.results || [];

  const { data: almacenesData, isLoading: isLoadingAlmacenes } = useQuery<PaginatedResponse<Almacen>, Error>({
    queryKey: ['almacenesForProductForm', currentUser?.empresa, currentUser?.is_superuser, formData.empresa],
    queryFn: ({ queryKey }) => {
      const [_key, userEmpresaId, isSuperuser, formSelectedEmpresaId] = queryKey;
      const filters: FilterParams & { empresa?: number } = {};

      if (isSuperuser && formSelectedEmpresaId) {
        filters.empresa = formSelectedEmpresaId as number;
      } else if (!isSuperuser && userEmpresaId) {
        filters.empresa = userEmpresaId as number;
      } else if (isSuperuser && !formSelectedEmpresaId) {
        return Promise.resolve({ results: [], count: 0, next: null, previous: null });
      }

      console.log("DEBUG: Fetching almacenes with filters:", filters);
      return api.fetchAlmacenes(filters);
    },
    enabled: isFormOpen && canManageProducts,
  });

  const almacenes = useMemo(() => almacenesData?.results || [], [almacenesData]);

  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery<PaginatedResponse<Empresa>, Error>({
    queryKey: ['empresasForProductForm'],
    queryFn: () => api.fetchEmpresas(),
    enabled: isFormOpen && currentUser?.is_superuser && canManageProducts,
  });
  const empresas = empresasData?.results || [];

  useEffect(() => {
    console.log("DEBUG: useEffect auto-assign almacén triggered.");
    console.log("DEBUG: selectedSucursalInForm:", selectedSucursalInForm, "(Type:", typeof selectedSucursalInForm, ")");
    console.log("DEBUG: isLoadingAlmacenes:", isLoadingAlmacenes);
    console.log("DEBUG: All almacenes loaded by query (almacenes array):", almacenes);

    setFormErrors(prev => {
      if (prev.almacen) {
        const newErrors = { ...prev };
        delete newErrors.almacen;
        return newErrors;
      }
      return prev;
    });

    if (selectedSucursalInForm === undefined || selectedSucursalInForm === null || selectedSucursalInForm.toString() === 'empty-selection-option') {
      console.log("DEBUG: Sucursal not selected or empty. Setting formData.almacen to undefined.");
      setFormData(prev => ({ ...prev, almacen: undefined }));
      return;
    }

    if (isLoadingAlmacenes || (currentUser?.is_superuser && (formData.empresa === undefined || formData.empresa === null))) {
      console.log("DEBUG: Conditions not met for auto-assigning almacén. (Loading or missing empresa for superuser or still loading almacenes)");
      setFormData(prev => ({ ...prev, almacen: undefined }));
      return;
    }

    const targetEmpresaId = currentUser?.is_superuser
      ? formData.empresa
      : currentUser?.empresa;

    console.log("DEBUG: currentUser?.is_superuser:", currentUser?.is_superuser);
    console.log("DEBUG: currentUser?.empresa (if not superuser):", currentUser?.empresa, "(Type:", typeof currentUser?.empresa, ")");
    console.log("DEBUG: formData.empresa (if superuser selected):", formData.empresa, "(Type:", typeof formData.empresa, ")");
    console.log("DEBUG: Target Empresa ID for filtering almacenes:", targetEmpresaId, "(Type:", typeof targetEmpresaId, ")");


    const warehousesForSelectedBranch = almacenes.filter(almacen => {
      const almacenSucursalId = almacen.sucursal_detail?.id;
      const almacenEmpresaId = almacen.empresa_detail?.id;

      const isCorrectSucursal = almacenSucursalId === selectedSucursalInForm;
      const isCorrectEmpresa = almacenEmpresaId === targetEmpresaId;

      console.log(`   - Checking almacen ID: ${almacen.id} (${almacen.nombre})`);
      console.log(`     - Almacen Sucursal ID: ${almacenSucursalId} (Type: ${typeof almacenSucursalId}) === Selected Sucursal ID: ${selectedSucursalInForm} (Type: ${typeof selectedSucursalInForm}) -> Match: ${isCorrectSucursal}`);
      console.log(`     - Almacen Empresa ID: ${almacenEmpresaId} (Type: ${typeof almacenEmpresaId}) === Target Empresa ID: ${targetEmpresaId} (Type: ${typeof targetEmpresaId}) -> Match: ${isCorrectEmpresa}`);


      return isCorrectSucursal && isCorrectEmpresa;
    });

    console.log("DEBUG: filteredAlmacenesBySucursal (after filter):", warehousesForSelectedBranch);

    if (warehousesForSelectedBranch.length > 0) {
      console.log(`DEBUG: Found ${warehousesForSelectedBranch.length} almacenes. Assigning first one: ${warehousesForSelectedBranch[0].id}`);
      setFormData(prev => ({ ...prev, almacen: warehousesForSelectedBranch[0].id }));
    } else {
      console.log("DEBUG: No almacenes found for selected sucursal and empresa. Setting formData.almacen to undefined.");
      setFormData(prev => ({ ...prev, almacen: undefined }));
    }
  }, [selectedSucursalInForm, almacenes, isLoadingAlmacenes, currentUser?.is_superuser, currentUser?.empresa, formData.empresa]);


  const createProductoMutation = useMutation<Producto, Error, Partial<Producto & { imagen_file?: File | null }>>({
    mutationFn: (newProductData) => api.createProducto(newProductData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productosList'] });
      toast({ title: "Producto creado", description: "El nuevo producto ha sido registrado exitosamente." });
      closeForm();
    },
    onError: (err: any) => {
      console.error("Error al crear producto:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
      toast({ variant: "destructive", title: "Error al crear producto", description: err.response?.data?.detail || "No se pudo crear el producto. Verifica los datos." });
    },
  });

  const updateProductoMutation = useMutation<Producto, Error, { id: number; data: Partial<Producto & { imagen_file?: File | null }> }>({
    mutationFn: ({ id, data }) => api.updateProducto(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productosList'] });
      toast({ title: "Producto actualizado", description: "La información del producto ha sido guardada exitosamente." });
      closeForm();
      setEditingProducto(null);
    },
    onError: (err: any) => {
      console.error("Error al actualizar producto:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
      toast({ variant: "destructive", title: "Error al actualizar producto", description: err.response?.data?.detail || "No se pudo actualizar el producto. Verifica los datos." });
    },
  });

  const deleteProductoMutation = useMutation({
    mutationFn: (id: number) => api.deleteProducto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productosList'] });
      toast({ title: "Producto eliminado", description: "El producto ha sido eliminado exitosamente." });
    },
    onError: (err: any) => {
      console.error("Error al eliminar producto:", err.response?.data || err.message);
      toast({ variant: "destructive", title: "Error al eliminar producto", description: err.response?.data?.datail || "No se pudo eliminar el producto." });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'productSearchInput') {
      setProductSearchInputValue(value);
      debouncedSetProductSearchTerm(value);
    } else {
      let parsedValue: string | number | null = value;

      if (name === 'stock' || name === 'stock_minimo') {
          parsedValue = parseFloat(value) || 0;
      } else {
          parsedValue = value;
      }
      
      setFormData(prev => ({ ...prev, [name]: parsedValue }));
      setFormErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[name]) delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, imagen_file: e.target.files![0], imagen: null }));
    } else {
      setFormData(prev => ({ ...prev, imagen_file: null }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    let parsedValue: number | null | undefined;

    if (value === "empty-selection-option" || value === "ALL") {
      parsedValue = undefined;
    } else {
      parsedValue = parseInt(value, 10);
    }

    if (name === 'sucursal') {
      setSelectedSucursalInForm(parsedValue as (number | undefined));
      setFormData(prev => ({ ...prev, almacen: undefined }));
    } else if (name === 'empresa') {
      setFormData(prev => ({ ...prev, empresa: parsedValue, sucursal: undefined, almacen: undefined }));
      setSelectedSucursalInForm(undefined);
    } else {
      setFormData(prev => ({ ...prev, [name]: parsedValue }));
    }

    setFormErrors(prev => {
      const newErrors = { ...prev };
      if (newErrors[name]) delete newErrors[name];
      if (name === 'sucursal' && newErrors.almacen) delete newErrors.almacen;
      if (name === 'empresa') {
        delete newErrors.empresa;
        delete newErrors.sucursal;
        delete newErrors.almacen;
      }
      return newErrors;
    });
  };

  const openForm = (producto?: Producto) => {
    setFormErrors({});
    if (producto) {
      setEditingProducto(producto);
      setFormData({
        id: producto.id,
        nombre: producto.nombre || '',
        descripcion: producto.descripcion || '',
        precio: producto.precio || '0.00',
        stock: producto.stock,
        imagen: producto.imagen || null,
        imagen_file: null,
        descuento: producto.descuento || '0.00',
        categoria: producto.categoria || undefined,
        almacen: producto.almacen || undefined,
        empresa: currentUser?.is_superuser ? producto.empresa : currentUser?.empresa,
      });
      if (producto.almacen_detail?.sucursal_detail?.id) {
        setSelectedSucursalInForm(producto.almacen_detail.sucursal_detail.id);
      } else {
        setSelectedSucursalInForm(undefined);
      }
    } else {
      setEditingProducto(null);
      setFormData({
        ...initialFormData,
        empresa: currentUser?.is_superuser ? undefined : currentUser?.empresa,
      });
      setSelectedSucursalInForm(undefined);
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingProducto(null);
    setFormData(initialFormData);
    setFormErrors({});
    setSelectedSucursalInForm(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors: Record<string, string> = {};
    if (!formData.nombre) errors.nombre = "El nombre es requerido.";
    
    const precioNum = parseFloat(formData.precio || '0');
    if (isNaN(precioNum) || precioNum <= 0) errors.precio = "El precio debe ser un número positivo.";
    
    // El descuento se maneja en porcentaje (0-100) en el frontend y se convierte a decimal (0-1) para el backend
    const descuentoNum = parseFloat(formData.descuento || '0');
    if (isNaN(descuentoNum) || descuentoNum < 0 || descuentoNum > 100) errors.descuento = "El descuento debe ser un número entre 0 y 100.";
    
    if (formData.stock === undefined || formData.stock < 0) errors.stock = "El stock es requerido y debe ser no negativo.";
    
    if (formData.categoria === undefined || formData.categoria === null) errors.categoria = "La categoría es requerida.";

    if (currentUser?.is_superuser && (formData.empresa === undefined || formData.empresa === null || isNaN(formData.empresa))) {
      errors.empresa = "La empresa es requerida para superusuarios.";
    }

    if (selectedSucursalInForm === undefined || selectedSucursalInForm === null || isNaN(selectedSucursalInForm)) {
      errors.sucursal = "La sucursal es requerida.";
    }
    
    if (formData.almacen === undefined || formData.almacen === null || isNaN(formData.almacen)) {
      const targetEmpresaId = currentUser?.is_superuser ? formData.empresa : currentUser?.empresa;
      const hasWarehousesForSelectedBranchAndCompany = almacenes.filter(a =>
        a.sucursal_detail?.id === selectedSucursalInForm && a.empresa === targetEmpresaId
      ).length > 0;

      if (selectedSucursalInForm !== undefined && selectedSucursalInForm.toString() !== 'empty-selection-option' && !hasWarehousesForSelectedBranchAndCompany) {
        errors.almacen = "La sucursal seleccionada no tiene almacenes asignados para la empresa elegida.";
      } else {
        errors.almacen = "El almacén es requerido o no se pudo asignar automáticamente. Asegúrate que la sucursal seleccionada tenga al menos un almacén.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast({ variant: "destructive", title: "Error de validación", description: "Por favor, corrige los errores en el formulario." });
      return;
    }

    const dataToSubmit: Partial<Producto & { imagen_file?: File | null }> = {
      nombre: formData.nombre,
      descripcion: formData.descripcion || null,
      precio: formData.precio, // Se mantiene como string para Django DecimalField
      stock: formData.stock,
      // Convertir el porcentaje de descuento (ej. 10.50%) a un decimal (0.105) para el backend
      descuento: (descuentoNum / 100).toFixed(4), // Usar 4 decimales para mayor precisión
      categoria: formData.categoria,
      almacen: formData.almacen,
      empresa: currentUser?.is_superuser && formData.empresa !== undefined
        ? formData.empresa
        : currentUser?.empresa as number,
    };

    if (formData.imagen_file) {
      dataToSubmit.imagen_file = formData.imagen_file;
      delete dataToSubmit.imagen;
    } else if (editingProducto) {
      if (formData.imagen === null) {
        dataToSubmit.imagen = null;
      }
    } else {
      dataToSubmit.imagen = null;
    }

    if (editingProducto) {
      if (editingProducto.id) {
        updateProductoMutation.mutate({ id: editingProducto.id, data: dataToSubmit });
      } else {
        toast({ variant: "destructive", title: "Error", description: "ID de producto para actualizar no encontrado." });
      }
    } else {
      createProductoMutation.mutate(dataToSubmit);
    }
  };

  const filteredProductos = useMemo(() => {
    console.log("DEBUG: Rendering products list. Number of products:", productos.length);
    return productos;
  }, [productos]);

  const handleDelete = (productoId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción es irreversible.')) {
      deleteProductoMutation.mutate(productoId);
    }
  };

  const handleCategoryFilterChange = (value: string) => {
    console.log("DEBUG: Category filter changed to:", value);
    setSelectedCategoryFilter(value);
  };

  if (!canManageProducts) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Acceso Denegado</AlertTitle>
        <AlertDescription>
          No tienes permisos para gestionar productos. Solo los Super Usuarios o Administradores de Empresa pueden acceder a esta sección.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoadingProductos && !productos.length) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando productos...</p>
      </div>
    );
  }

  if (productosError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudieron cargar los productos: {productosError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-2xl rounded-xl border border-indigo-100">
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Gestión de Productos</CardTitle>
            <CardDescription className="text-gray-600 mt-1">Administra los productos disponibles en tu {currentUser?.is_superuser ? 'sistema' : 'empresa'}.</CardDescription>
          </div>
          <Button onClick={() => openForm()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-md px-4 py-2">
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Producto
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="relative flex-grow w-full sm:w-auto">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                id="productSearchInput"
                name="productSearchInput"
                placeholder="Buscar productos por nombre..."
                value={productSearchInputValue}
                onChange={handleInputChange}
                className="w-full pl-10"
              />
            </div>
            <Select
              value={selectedCategoryFilter}
              onValueChange={handleCategoryFilterChange}
              disabled={isLoadingCategorias}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
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

          <div className="overflow-x-auto rounded-md border border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagen</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descuento</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Almacén</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</TableHead>
                  {currentUser?.is_superuser && (
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</TableHead>
                  )}
                  <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-100">
                {isFetchingProductos && productos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentUser?.is_superuser ? 11 : 10} className="h-24 text-center text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Cargando resultados...
                    </TableCell>
                  </TableRow>
                ) : filteredProductos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentUser?.is_superuser ? 11 : 10} className="h-24 text-center text-gray-500">
                      No se encontraron productos con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProductos.map((producto) => {
                    const originalPrice = Number(producto.precio);
                    const discountRate = Number(producto.descuento); // Esto ya viene en formato decimal (ej. 0.10)
                    const hasDiscount = discountRate > 0;
                    const finalPrice = originalPrice * (1 - discountRate);

                    return (
                      <TableRow key={producto.id} className="hover:bg-gray-50">
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {producto.imagen ? (
                            <img
                              src={typeof producto.imagen === 'string' ? producto.imagen : `https://placehold.co/48x48/e2e8f0/64748b?text=Invalid+Img`}
                              alt={producto.nombre}
                              className="h-12 w-12 object-cover rounded-md"
                              onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/48x48/e2e8f0/64748b?text=No+Img`; }}
                            />
                          ) : (
                            <div className="h-12 w-12 bg-gray-200 flex items-center justify-center rounded-md text-gray-500">
                              <ImageIcon className="h-6 w-6" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{producto.nombre}</TableCell>
                        <TableCell className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">{producto.descripcion || 'N/A'}</TableCell>
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                          {hasDiscount ? (
                            <div className="flex flex-col items-start">
                              <span className="line-through text-red-500 text-xs">${originalPrice.toFixed(2)}</span>
                              <span className="font-semibold text-green-600">${finalPrice.toFixed(2)}</span>
                            </div>
                          ) : (
                            `$${originalPrice.toFixed(2)}`
                          )}
                        </TableCell>
                        {/* Mostrar descuento como porcentaje */}
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{`${(discountRate * 100).toFixed(2)}%`}</TableCell>
                        <TableCell className={`px-4 py-4 whitespace-nowrap text-sm ${producto.stock <= LOW_STOCK_THRESHOLD ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                          {producto.stock}
                        </TableCell>
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{producto.categoria_detail?.nombre || 'N/A'}</TableCell>
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{producto.almacen_detail?.nombre || 'N/A'}</TableCell>
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{producto.almacen_detail?.sucursal_detail?.nombre || 'N/A'}</TableCell>
                        {currentUser?.is_superuser && (
                          <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{producto.empresa_detail?.nombre || 'N/A'}</TableCell>
                        )}
                        <TableCell className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openForm(producto)}
                            className="text-blue-600 hover:bg-blue-50 rounded-md p-2 mr-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(producto.id)}
                            className="text-red-600 hover:bg-red-50 rounded-md p-2"
                            disabled={deleteProductoMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de Creación/Edición de Producto */}
      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="sm:max-w-lg p-6 rounded-lg shadow-2xl border border-indigo-200">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-800">
              {editingProducto ? 'Editar Producto' : 'Crear Nuevo Producto'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-1">
              {editingProducto ? 'Modifica los datos del producto.' : 'Introduce los datos para registrar un nuevo producto.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nombre" className="text-right text-gray-700">Nombre</Label>
              <Input
                id="nombre"
                name="nombre"
                value={formData.nombre || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              {formErrors.nombre && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.nombre}</p>}
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="descripcion" className="text-right text-gray-700 pt-2">Descripción</Label>
              <Textarea
                id="descripcion"
                name="descripcion"
                value={formData.descripcion || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                rows={3}
              />
              {formErrors.descripcion && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.descripcion}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="precio" className="text-right text-gray-700">Precio</Label>
              <Input
                id="precio"
                name="precio"
                type="number"
                step="0.01"
                value={formData.precio || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
                placeholder="Ej: 12.99"
              />
              {formErrors.precio && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.precio}</p>}
            </div>

            {/* Campo de Descuento en el formulario */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="descuento" className="text-right text-gray-700">Descuento (%)</Label>
              <Input
                id="descuento"
                name="descuento"
                type="number"
                step="0.01"
                value={formData.descuento ?? ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
                min="0"
                max="100"
                placeholder="Ej: 10.50"
              />
              {formErrors.descuento && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.descuento}</p>}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="stock" className="text-right text-gray-700">Stock</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                value={formData.stock ?? ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              {formErrors.stock && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.stock}</p>}
            </div>

            {/* Selector de Categoría */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="categoria" className="text-right text-gray-700">Categoría</Label>
              <Select
                value={formData.categoria?.toString() || 'empty-selection-option'}
                onValueChange={(value) => handleSelectChange('categoria', value)}
                disabled={isLoadingCategorias}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingCategorias ? (
                    <SelectItem value="loading-categories" disabled>Cargando categorías...</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="empty-selection-option">-- Selecciona --</SelectItem>
                      {categorias.map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.nombre}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {formErrors.categoria && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.categoria}</p>}
            </div>

            {/* Selector de Empresa (visible solo para Super Usuarios) */}
            {currentUser?.is_superuser && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="empresa" className="text-right text-gray-700">Empresa</Label>
                <Select
                  value={formData.empresa?.toString() || 'empty-selection-option'}
                  onValueChange={(value) => handleSelectChange('empresa', value)}
                  disabled={isLoadingEmpresas}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Selecciona una empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingEmpresas ? (
                      <SelectItem value="loading-empresas" disabled>Cargando empresas...</SelectItem>
                    ) : (
                      <>
                        <SelectItem value="empty-selection-option">-- Selecciona --</SelectItem>
                        {empresas.map(e => (
                          <SelectItem key={e.id} value={e.id.toString()}>{e.nombre}</SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {formErrors.empresa && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.empresa}</p>}
              </div>
            )}

            {/* Selector de Sucursal para el formulario */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sucursal" className="text-right text-gray-700">Sucursal</Label>
              <Select
                value={selectedSucursalInForm?.toString() || 'empty-selection-option'}
                onValueChange={(value) => handleSelectChange('sucursal', value)}
                disabled={isLoadingSucursales || (currentUser?.is_superuser && (formData.empresa === undefined || formData.empresa === null))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingSucursales ? (
                    <SelectItem value="loading-sucursales" disabled>Cargando sucursales...</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="empty-selection-option">-- Selecciona --</SelectItem>
                      {sucursales.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {formErrors.sucursal && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.sucursal}</p>}
              {formErrors.almacen && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.almacen}</p>}
            </div>

            {/* Campo de Imagen */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="imagen_file" className="text-right text-gray-700">Imagen</Label>
              <Input
                id="imagen_file"
                name="imagen_file"
                type="file"
                onChange={handleFileChange}
                className="col-span-3"
                accept="image/*"
              />
              {formErrors.imagen && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.imagen}</p>}
              {formData.imagen && !formData.imagen_file && (
                <div className="col-span-4 flex justify-end">
                  <img
                    src={formData.imagen as string}
                    alt="Imagen actual"
                    className="mt-2 h-20 w-20 object-contain rounded-md border border-gray-200"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/48x48/e2e8f0/64748b?text=No+Img`; }}
                  />
                </div>
              )}
              {editingProducto && formData.imagen_file === null && (
                <div className="col-span-4 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, imagen: null }))}
                    className="text-red-500 hover:text-red-700"
                  >
                    Eliminar Imagen Actual
                  </Button>
                </div>
              )}
            </div>

            {formErrors.general && <p className="col-span-4 text-red-500 text-sm text-center">{formErrors.general}</p>}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createProductoMutation.isPending || updateProductoMutation.isPending} className="rounded-md px-4 py-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={createProductoMutation.isPending || updateProductoMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md">
                {createProductoMutation.isPending || updateProductoMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  editingProducto ? 'Guardar Cambios' : 'Crear Producto'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Productos;