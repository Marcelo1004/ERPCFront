import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Producto } from '@/types/productos';
import { Categoria } from '@/types/categorias';
import { Almacen } from '@/types/almacenes';
import { Sucursal } from '@/types/sucursales';
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
  precio: '',
  stock: 0,
  imagen: null,
  imagen_file: null,
  categoria: undefined, // Usamos undefined para que el Select pueda mostrar el placeholder
  almacen: undefined,   // El almacén será asignado automáticamente por la sucursal
};

// Función de debounce (fuera del componente para evitar re-creaciones innecesarias)
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
  // Estados para el filtro de la tabla
  const [productSearchInputValue, setProductSearchInputValue] = useState(''); // Valor para el input visible
  const [productSearchTerm, setProductSearchTerm] = useState(''); // Valor real usado en la query (debounced)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL'); // "ALL" como valor inicial para todas las categorías
  // Nuevo estado para la selección de sucursal en el formulario, para auto-asignar almacenes
  const [selectedSucursalInForm, setSelectedSucursalInForm] = useState<number | undefined>(undefined);


  const canManageProducts = currentUser?.is_superuser || currentUser?.role === 'ADMINISTRATIVO';

  // Función debounced para actualizar el término de búsqueda de productos
  const debouncedSetProductSearchTerm = useCallback(
    debounce((value: string) => {
      console.log("DEBUG: Debounced search term applied:", value);
      setProductSearchTerm(value);
    }, 500), // Retraso de 500ms
    []
  );

  // Obtener la lista de productos
  const { data: productosData, isLoading: isLoadingProductos, isFetching: isFetchingProductos, error: productosError } = useQuery<PaginatedResponse<Producto>, Error>({
    queryKey: ['productosList', productSearchTerm, selectedCategoryFilter, currentUser?.empresa, currentUser?.is_superuser],
    queryFn: async ({ queryKey }) => { // MARCADO: queryFn ahora es async
      const [_key, currentProductSearchTerm, currentCategoryFilter, empresaId, isSuperuser] = queryKey;
      const filters: FilterParams & { empresa?: number; categoria?: number } = { search: currentProductSearchTerm as string || '' };

      if (!isSuperuser && empresaId) {
        filters.empresa = empresaId as number;
      }
      if (currentCategoryFilter && currentCategoryFilter !== 'ALL') {
        filters.categoria = parseInt(currentCategoryFilter as string, 10);
      }
      console.log("DEBUG: Fetching productos with filters (from queryFn):", filters); // Log de los filtros que se envían a la API
      try {
        const result = await api.fetchProductos(filters);
        console.log("DEBUG: Productos fetched successfully (inside queryFn):", result); // Log de éxito dentro de queryFn
        return result;
      } catch (err) {
        console.error("DEBUG: Error fetching productos (inside queryFn):", err); // Log de error dentro de queryFn
        throw err; // Es importante re-lanzar el error para que useQuery lo capture
      }
    },
    enabled: !!currentUser?.id && canManageProducts,
    staleTime: 0, // Hace que los datos se consideren 'stale' inmediatamente
    gcTime: 5 * 60 * 1000, // Usar gcTime en lugar de cacheTime para React Query v5+
    // Eliminado onSuccess y onError directamente de las opciones de useQuery
  });

  const productos = productosData?.results || [];

  // Logs de estado de la consulta
  useEffect(() => {
    console.log("DEBUG: Productos Component Render. isLoadingProductos:", isLoadingProductos, "isFetchingProductos:", isFetchingProductos);
    console.log("DEBUG: Current productSearchTerm:", productSearchTerm);
    console.log("DEBUG: Current selectedCategoryFilter:", selectedCategoryFilter);
  }, [isLoadingProductos, isFetchingProductos, productSearchTerm, selectedCategoryFilter]);


  // Obtener categorías para el selector del formulario y el filtro de la tabla
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

  // Obtener sucursales para el selector del formulario
  const { data: sucursalesData, isLoading: isLoadingSucursales } = useQuery<PaginatedResponse<Sucursal>, Error>({
    queryKey: ['sucursalesForProductForm', currentUser?.empresa, currentUser?.is_superuser],
    queryFn: ({ queryKey }) => {
      const [_key, empresaId, isSuperuser] = queryKey;
      const filters: FilterParams & { empresa?: number } = {};
      if (!isSuperuser && empresaId) {
        filters.empresa = empresaId as number;
      }
      return api.fetchSucursales(filters);
    },
    enabled: isFormOpen && canManageProducts,
  });
  const sucursales = sucursalesData?.results || [];

  // Obtener todos los almacenes para la empresa actual (se usa para auto-asignar)
  const { data: almacenesData, isLoading: isLoadingAlmacenes } = useQuery<PaginatedResponse<Almacen>, Error>({
    queryKey: ['almacenesForProductForm', currentUser?.empresa, currentUser?.is_superuser],
    queryFn: ({ queryKey }) => {
      const [_key, empresaId, isSuperuser] = queryKey;
      const filters: FilterParams & { empresa?: number } = {};
      if (!isSuperuser && empresaId) {
        filters.empresa = empresaId as number;
      }
      return api.fetchAlmacenes(filters);
    },
    enabled: isFormOpen && canManageProducts,
  });

  // Envuelve 'almacenes' en useMemo para asegurar la estabilidad referencial
  const almacenes = useMemo(() => almacenesData?.results || [], [almacenesData]);

  // Efecto para auto-asignar almacén cuando la sucursal cambia
  useEffect(() => {
    console.log("DEBUG: useEffect auto-assign almacén triggered.");
    console.log("DEBUG: selectedSucursalInForm:", selectedSucursalInForm);
    console.log("DEBUG: isLoadingAlmacenes:", isLoadingAlmacenes);
    console.log("DEBUG: all almacenes:", almacenes);

    // Limpiar el error de almacén si cambia la sucursal
    setFormErrors(prev => {
        if (prev.almacen) {
            const newErrors = { ...prev };
            delete newErrors.almacen;
            return newErrors;
        }
        return prev;
    });

    // Solo proceder si sucursal es seleccionada y los almacenes han cargado
    if (selectedSucursalInForm === undefined || selectedSucursalInForm.toString() === 'empty-selection-option' || isLoadingAlmacenes) {
      console.log("DEBUG: Conditions not met for auto-assigning almacén. Setting formData.almacen to undefined.");
      setFormData(prev => ({ ...prev, almacen: undefined })); // Asegurarse de que el almacén esté vacío
      return;
    }

    const warehousesForSelectedBranch = almacenes.filter(almacen => {
      // AQUÍ ES EL CAMBIO: Usamos sucursal_detail.id
      console.log(`DEBUG: Checking almacen ${almacen.id} (${almacen.nombre}). sucursal_detail.id: ${almacen.sucursal_detail?.id}`);
      return almacen.sucursal_detail?.id === selectedSucursalInForm;
    });
    console.log("DEBUG: filteredAlmacenesBySucursal (after filter):", warehousesForSelectedBranch);


    if (warehousesForSelectedBranch.length > 0) {
      // Si hay uno o más almacenes, asigna el ID del primer almacén encontrado.
      console.log(`DEBUG: Found ${warehousesForSelectedBranch.length} almacenes. Assigning first one: ${warehousesForSelectedBranch[0].id}`);
      setFormData(prev => ({ ...prev, almacen: warehousesForSelectedBranch[0].id }));
    } else {
      // Si no hay almacenes para la sucursal seleccionada
      console.log("DEBUG: No almacenes found for selected sucursal. Setting formData.almacen to undefined.");
      setFormData(prev => ({ ...prev, almacen: undefined }));
    }
  }, [selectedSucursalInForm, almacenes, isLoadingAlmacenes]); // Dependencias: sucursal, almacenes (referencia estable), estado de carga de almacenes


  const createProductoMutation = useMutation<Producto, Error, Partial<Producto & { imagen_file?: File | null }>>({
    mutationFn: (newProductData) => api.createProducto(newProductData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productosList'] }); // Invalida para refrescar la tabla
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
      queryClient.invalidateQueries({ queryKey: ['productosList'] }); // Invalida para refrescar la tabla
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
      queryClient.invalidateQueries({ queryKey: ['productosList'] }); // Invalida para refrescar la tabla
      toast({ title: "Producto eliminado", description: "El producto ha sido eliminado exitosamente." });
    },
    onError: (err: any) => {
      console.error("Error al eliminar producto:", err.response?.data || err.message);
      toast({ variant: "destructive", title: "Error al eliminar producto", description: err.response?.data?.detail || "No se pudo eliminar el producto." });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Si es el input de búsqueda de productos
    if (name === 'productSearchInput') { // Usamos un nombre único para el input de búsqueda
      setProductSearchInputValue(value); // Actualiza el valor visible en el input
      debouncedSetProductSearchTerm(value); // Llama a la función debounced para actualizar el término de búsqueda real
    } else {
      // Para los inputs del formulario principal
      setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
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
        parsedValue = undefined; // Se convierte a undefined para el estado de React
    } else {
        parsedValue = parseInt(value, 10);
    }

    if (name === 'sucursal') {
        setSelectedSucursalInForm(parsedValue as (number | undefined));
        // El almacén se auto-asignará a través del useEffect
    } else {
        setFormData(prev => ({ ...prev, [name]: parsedValue }));
    }

    setFormErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[name]) delete newErrors[name];
        if (name === 'sucursal' && newErrors.almacen) delete newErrors.almacen;
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
        precio: producto.precio || '',
        stock: producto.stock,
        imagen: producto.imagen || null,
        imagen_file: null,
        categoria: producto.categoria || undefined,
        almacen: producto.almacen || undefined, // Mantener el almacén del producto existente
      });
      // Preseleccionar la sucursal del almacén del producto existente
      // CAMBIO AQUÍ: Usamos sucursal_detail.id para la preselección
      if (producto.almacen_detail?.sucursal_detail?.id) {
        setSelectedSucursalInForm(producto.almacen_detail.sucursal_detail.id);
      } else {
        setSelectedSucursalInForm(undefined);
      }
    } else {
      setEditingProducto(null);
      setFormData(initialFormData);
      setSelectedSucursalInForm(undefined); // Resetear sucursal al crear nuevo
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingProducto(null);
    setFormData(initialFormData);
    setFormErrors({});
    setSelectedSucursalInForm(undefined); // Limpiar también la selección de sucursal del formulario
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    // Validaciones del formulario
    const errors: Record<string, string> = {};
    if (!formData.nombre) errors.nombre = "El nombre es requerido.";
    if (!formData.precio) errors.precio = "El precio es requerido.";
    else if (isNaN(parseFloat(formData.precio)) || parseFloat(formData.precio) < 0) errors.precio = "El precio debe ser un número positivo.";
    if (formData.stock === undefined || formData.stock < 0) errors.stock = "El stock es requerido y debe ser no negativo.";
    if (formData.categoria === undefined || formData.categoria === null) errors.categoria = "La categoría es requerida.";

    // Validar que se haya seleccionado una sucursal y, por ende, se haya auto-asignado un almacén.
    if (selectedSucursalInForm === undefined || selectedSucursalInForm === null || isNaN(selectedSucursalInForm)) {
        errors.sucursal = "La sucursal es requerida.";
    }
    // Después de la auto-asignación, verificamos si `formData.almacen` tiene un valor.
    if (formData.almacen === undefined || formData.almacen === null || isNaN(formData.almacen)) {
        // Añadir una comprobación adicional: si hay una sucursal seleccionada pero no se encontraron almacenes para ella.
        const hasWarehousesForSelectedBranch = almacenes.filter(a => a.sucursal_detail?.id === selectedSucursalInForm).length > 0;
        if (selectedSucursalInForm !== undefined && selectedSucursalInForm.toString() !== 'empty-selection-option' && !hasWarehousesForSelectedBranch) {
             errors.almacen = "La sucursal seleccionada no tiene almacenes asignados.";
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
      precio: formData.precio,
      stock: formData.stock,
      categoria: formData.categoria,
      almacen: formData.almacen, // Ya está auto-asignado o validado como requerido
      empresa: currentUser?.empresa as number,
    };

    // --- Manejo de la lógica de la imagen ---
    if (formData.imagen_file) {
      // Si se selecciona un nuevo archivo, se envía el archivo.
      dataToSubmit.imagen_file = formData.imagen_file;
      // No necesitamos enviar 'imagen' (URL) si se sube un nuevo archivo, el backend debería reemplazar.
      delete dataToSubmit.imagen;
    } else if (editingProducto) {
      // Si estamos editando un producto existente:
      if (formData.imagen === null) {
        // Si el usuario marcó para eliminar la imagen existente (formData.imagen se puso a null)
        dataToSubmit.imagen = null; // Envía null para que el backend borre la imagen
      }
      // Si formData.imagen sigue siendo una URL (no se seleccionó nuevo archivo y no se eliminó),
      // simplemente no incluimos 'imagen' ni 'imagen_file' en dataToSubmit.
      // El backend interpretará esto como "mantener la imagen existente".
    } else {
      // Si estamos creando un nuevo producto y no se ha seleccionado ningún archivo,
      // aseguramos que 'imagen' sea explícitamente null.
      dataToSubmit.imagen = null;
    }
    // --- Fin del manejo de la lógica de la imagen ---


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

  // filteredProductos ya no filtra en el frontend, solo usa los datos que vienen de la API
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

  // Muestra el loader inicial si está cargando y no hay productos aún
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
                id="productSearchInput" // ID para identificar el input de búsqueda
                name="productSearchInput" // Nombre para identificar el input de búsqueda en handleInputChange
                placeholder="Buscar productos por nombre..."
                value={productSearchInputValue}
                onChange={handleInputChange} // Usa el manejador unificado
                className="w-full pl-10"
              />
            </div>
            {/* El botón "Buscar" se ha eliminado para hacer la búsqueda en tiempo real (debounced) */}
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
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Almacén</TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</TableHead>
                    <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white divide-y divide-gray-100">
                  {isFetchingProductos && productos.length === 0 ? ( // Muestra loader al filtrar si no hay productos cargados aún
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Cargando resultados...
                      </TableCell>
                    </TableRow>
                  ) : filteredProductos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                        No se encontraron productos con los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProductos.map((producto) => (
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
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">${Number(producto.precio).toFixed(2)}</TableCell>
                        <TableCell className={`px-4 py-4 whitespace-nowrap text-sm ${producto.stock <= LOW_STOCK_THRESHOLD ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                          {producto.stock}
                        </TableCell>
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{producto.categoria_detail?.nombre || 'N/A'}</TableCell>
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{producto.almacen_detail?.nombre || 'N/A'}</TableCell>
                        <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{producto.almacen_detail?.sucursal_detail?.nombre || 'N/A'}</TableCell>
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
                    ))
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
                  type="text"
                  value={formData.precio || ''}
                  onChange={handleInputChange}
                  className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                  placeholder="Ej: 12.99"
                />
                {formErrors.precio && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.precio}</p>}
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

              {/* Selector de Sucursal para el formulario */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sucursal" className="text-right text-gray-700">Sucursal</Label>
                <Select
                  value={selectedSucursalInForm?.toString() || 'empty-selection-option'}
                  onValueChange={(value) => handleSelectChange('sucursal', value)}
                  disabled={isLoadingSucursales}
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
                {/* Mostrar el error de almacén aquí ya que el campo de almacén no está visible */}
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