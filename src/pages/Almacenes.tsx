import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Almacen } from '@/types/almacenes';
import { Sucursal } from '@/types/sucursales';
import { Empresa } from '@/types/empresas'; // Asegúrate de tener este tipo definido
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
import { toast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Search, WarehouseIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Estado inicial para el formulario de almacén
const initialFormData = {
  nombre: '',
  ubicacion: '',
  capacidad: null,
  sucursal: undefined,
  empresa: undefined, // Agregamos el campo empresa aquí
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

const Almacenes = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAlmacen, setEditingAlmacen] = useState<Almacen | null>(null);
  const [formData, setFormData] = useState<Partial<Almacen>>(initialFormData);
  const [formErrors, setFormErrors] = useState<any>({});
  
  // Estados para el filtro de la tabla de almacenes
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSucursalFilter, setSelectedSucursalFilter] = useState('ALL');

const canManageAlmacenes = currentUser?.is_superuser || currentUser?.role?.name === 'Administrador';

  // Función debounced para actualizar el término de búsqueda de almacenes
  const debouncedSetSearchTerm = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 500),
    []
  );

  // Obtener la lista de almacenes
  const { data: almacenesData, isLoading: isLoadingAlmacenes, isFetching: isFetchingAlmacenes, error: almacenesError } = useQuery<PaginatedResponse<Almacen>, Error>({
    queryKey: ['almacenesList', searchTerm, selectedSucursalFilter, currentUser?.empresa, currentUser?.is_superuser],
    queryFn: async ({ queryKey }) => {
      const [_key, currentSearchTerm, currentSucursalFilter, empresaId, isSuperuser] = queryKey;
      const filters: FilterParams & { empresa?: number; sucursal?: number } = { search: currentSearchTerm as string || '' };

      // Si no es superusuario, siempre filtra por la empresa del usuario actual
      if (!isSuperuser && empresaId) {
        filters.empresa = empresaId as number;
      }
      if (currentSucursalFilter && currentSucursalFilter !== 'ALL') {
        filters.sucursal = parseInt(currentSucursalFilter as string, 10);
      }
      console.log("DEBUG: Fetching almacenes with filters:", filters);
      try {
        const result = await api.fetchAlmacenes(filters);
        console.log("DEBUG: Almacenes fetched successfully:", result);
        return result;
      } catch (err) {
        console.error("DEBUG: Error fetching almacenes:", err);
        throw err;
      }
    },
    enabled: !!currentUser?.id && canManageAlmacenes,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  const almacenes = almacenesData?.results || [];

  // Obtener la lista de sucursales para el filtro y el formulario
  const { data: sucursalesData, isLoading: isLoadingSucursalesFilter } = useQuery<PaginatedResponse<Sucursal>, Error>({
    queryKey: ['sucursalesForAlmacenForm', formData.empresa, currentUser?.is_superuser, currentUser?.empresa], // Depende de la empresa seleccionada o del usuario
    queryFn: ({ queryKey }) => {
      const [_key, selectedEmpresaId, isSuperuser, userEmpresaId] = queryKey;
      const filters: FilterParams & { empresa?: number } = {};
      
      // Si es superusuario y ha seleccionado una empresa en el formulario, usa esa empresa
      if (isSuperuser && selectedEmpresaId) {
        filters.empresa = selectedEmpresaId as number;
      } 
      // Si no es superusuario, o si es superusuario pero no ha seleccionado una empresa (ej. al inicio),
      // usa la empresa del usuario actual (si existe).
      else if (!isSuperuser && userEmpresaId) {
        filters.empresa = userEmpresaId as number;
      } else if (isSuperuser && !selectedEmpresaId && userEmpresaId) {
        // Fallback para superusuario si aún no selecciona empresa, pero tiene una default
        filters.empresa = userEmpresaId as number;
      }
      
      // Si no hay empresa definida (ej. superusuario que aún no selecciona), no se cargarán sucursales.
      if (!filters.empresa && !isSuperuser) {
        // Esto previene cargar todas las sucursales si un no-superuser no tiene empresa asignada
        return Promise.resolve({ results: [], count: 0, next: null, previous: null });
      }

      console.log("DEBUG: Fetching sucursales with filters for form:", filters);
      return api.fetchSucursales(filters);
    },
    enabled: canManageAlmacenes,
  });
  const sucursales = sucursalesData?.results || [];

  // NUEVO: Obtener la lista de empresas (solo para Superuser en el formulario)
  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery<PaginatedResponse<Empresa>, Error>({
    queryKey: ['empresasForAlmacenForm'],
    queryFn: () => api.fetchEmpresas(),
    enabled: !!currentUser?.is_superuser, // Solo si es superusuario
  });
  const empresas = empresasData?.results || [];

  const createAlmacenMutation = useMutation<Almacen, Error, Omit<Almacen, 'id' | 'sucursal_detail' | 'empresa_detail'>>({
    mutationFn: (newAlmacenData) => api.createAlmacen(newAlmacenData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['almacenesList'] });
      toast({ title: "Almacén creado", description: "El nuevo almacén ha sido registrado exitosamente." });
      closeForm();
    },
    onError: (err: any) => {
      console.error("Error al crear almacén:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
      toast({ variant: "destructive", title: "Error al crear almacén", description: err.response?.data?.detail || "No se pudo crear el almacén. Verifica los datos." });
    },
  });

  const updateAlmacenMutation = useMutation<Almacen, Error, { id: number; data: Partial<Almacen> }>({
    mutationFn: ({ id, data }) => api.updateAlmacen(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['almacenesList'] });
      toast({ title: "Almacén actualizado", description: "La información del almacén ha sido guardada exitosamente." });
      closeForm();
      setEditingAlmacen(null);
    },
    onError: (err: any) => {
      console.error("Error al actualizar almacén:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
      toast({ variant: "destructive", title: "Error al actualizar almacén", description: err.response?.data?.detail || "No se pudo actualizar el almacén. Verifica los datos." });
    },
  });

  const deleteAlmacenMutation = useMutation({
    mutationFn: (id: number) => api.deleteAlmacen(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['almacenesList'] });
      toast({ title: "Almacén eliminado", description: "El almacén ha sido eliminado exitosamente." });
    },
    onError: (err: any) => {
      console.error("Error al eliminar almacén:", err.response?.data || err.message);
      toast({ variant: "destructive", title: "Error al eliminar almacén", description: err.response?.data?.detail || "No se pudo eliminar el almacén." });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (name === 'searchInput') {
      setSearchInputValue(value);
      debouncedSetSearchTerm(value);
    } else {
      let processedValue: string | number | null = value;
      if (type === 'number') {
        processedValue = value === '' ? null : parseFloat(value);
        if (typeof processedValue === 'number' && isNaN(processedValue)) {
            processedValue = null;
        }
      }
      setFormData(prev => ({ ...prev, [name]: processedValue }));
      setFormErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[name]) delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    let parsedValue: number | undefined;
    if (value === "empty-selection-option" || value === "ALL" || value === "") { // Añadir "" para manejar selecciones vacías
        parsedValue = undefined;
    } else {
      parsedValue = parseInt(value, 10);
    }

    if (name === 'sucursalFilter') {
        setSelectedSucursalFilter(value);
    } else if (name === 'empresa') { // Handle empresa select change
        setFormData(prev => ({ ...prev, [name]: parsedValue, sucursal: undefined })); // Reset sucursal when company changes
        setFormErrors(prev => ({ ...prev, sucursal: undefined })); // Clear sucursal error
    } else { // For sucursal in the form
        setFormData(prev => ({ ...prev, [name]: parsedValue }));
    }

    setFormErrors(prev => {
        const newErrors = { ...prev };
        if (newErrors[name]) delete newErrors[name];
        return newErrors;
    });
  };

  const openForm = (almacen?: Almacen) => {
    setFormErrors({});
    if (almacen) {
      setEditingAlmacen(almacen);
      setFormData({
        id: almacen.id,
        nombre: almacen.nombre || '',
        ubicacion: almacen.ubicacion || '',
        capacidad: almacen.capacidad ?? null,
        sucursal: almacen.sucursal || undefined,
        empresa: almacen.empresa || undefined, // Asignar la empresa al editar
      });
    } else {
      setEditingAlmacen(null);
      // Para un nuevo almacén:
      // Si es superusuario, no pre-seleccionar empresa.
      // Si no es superusuario, pre-seleccionar la empresa del usuario.
      setFormData({
        ...initialFormData,
        empresa: currentUser?.is_superuser ? undefined : (currentUser?.empresa || undefined),
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingAlmacen(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const errors: Record<string, string> = {};
    if (!formData.nombre) errors.nombre = "El nombre es requerido.";
    if (!formData.sucursal) errors.sucursal = "La sucursal es requerida.";
    // NUEVO: Validar empresa para superusuario
    if (currentUser?.is_superuser && !formData.empresa) {
      errors.empresa = "La empresa es requerida para superusuarios.";
    }

    if (formData.capacidad !== null && formData.capacidad !== undefined) {
        const numCapacidad = Number(formData.capacidad);
        if (isNaN(numCapacidad)) {
            errors.capacidad = "La capacidad debe ser un número válido.";
        } else if (numCapacidad < 0) {
            errors.capacidad = "La capacidad no puede ser negativa.";
        }
    }

    if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        toast({ variant: "destructive", title: "Error de validación", description: "Por favor, corrige los errores en el formulario." });
        return;
    }

    // Preparar dataToSubmit
    let dataToSubmit: Omit<Almacen, 'id' | 'sucursal_detail' | 'empresa_detail'>;

    if (currentUser?.is_superuser) {
      // Si es superusuario, los datos deben incluir la empresa seleccionada en el formulario
      dataToSubmit = {
        nombre: formData.nombre!,
        ubicacion: formData.ubicacion || null,
        capacidad: (formData.capacidad === null || formData.capacidad === undefined || isNaN(Number(formData.capacidad)))
                    ? null
                    : Number(formData.capacidad),
        sucursal: formData.sucursal!,
        empresa: formData.empresa!, // Superusuario debe enviar la empresa
      };
    } else {
      // Si NO es superusuario, la empresa se obtiene del currentUser y no se envía si el backend la asigna
      // Asumiendo que `currentUser?.empresa` siempre existe para estos roles y el backend lo usa.
      // Si tu backend lo *requiere* incluso para no-superusuarios, pero luego lo *sobreescribe*,
      // entonces aún podrías enviarlo aquí. Pero si el backend lo inyecta automáticamente sin requerirlo
      // de la entrada, podrías omitirlo aquí.
      // Para mayor seguridad y evitar errores de validación, vamos a enviarlo siempre,
      // el backend ya tiene la lógica de sobreescribirlo/validarlo.
      if (!currentUser?.empresa) {
        toast({ variant: "destructive", title: "Error de usuario", description: "Tu cuenta no tiene una empresa asociada." });
        return;
      }
      dataToSubmit = {
        nombre: formData.nombre!,
        ubicacion: formData.ubicacion || null,
        capacidad: (formData.capacidad === null || formData.capacidad === undefined || isNaN(Number(formData.capacidad)))
                    ? null
                    : Number(formData.capacidad),
        sucursal: formData.sucursal!,
        empresa: currentUser.empresa as number, // La empresa del usuario actual
      };
    }

    console.log("DEBUG: Data to submit:", dataToSubmit);

    if (editingAlmacen) {
      if (editingAlmacen.id) {
        updateAlmacenMutation.mutate({ id: editingAlmacen.id, data: dataToSubmit });
      } else {
        toast({ variant: "destructive", title: "Error", description: "ID de almacén para actualizar no encontrado." });
      }
    } else {
      createAlmacenMutation.mutate(dataToSubmit);
    }
  };

  if (!canManageAlmacenes) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Acceso Denegado</AlertTitle>
        <AlertDescription>
          No tienes permisos para gestionar almacenes. Solo los Super Usuarios o Administradores de Empresa pueden acceder a esta sección.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoadingAlmacenes && !almacenes.length) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando almacenes...</p>
      </div>
    );
  }

  if (almacenesError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudieron cargar los almacenes: {almacenesError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-2xl rounded-xl border border-indigo-100">
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Gestión de Almacenes</CardTitle>
            <CardDescription className="text-gray-600 mt-1">Administra los almacenes de tu {currentUser?.is_superuser ? 'sistema' : 'empresa'}.</CardDescription>
          </div>
          <Button onClick={() => openForm()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-md px-4 py-2">
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Almacén
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="relative flex-grow w-full sm:w-auto">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                id="searchInput"
                name="searchInput"
                placeholder="Buscar almacenes por nombre, ubicación o sucursal..."
                value={searchInputValue}
                onChange={handleInputChange}
                className="w-full pl-10"
              />
            </div>
            <Select
              value={selectedSucursalFilter}
              onValueChange={(value) => handleSelectChange('sucursalFilter', value)}
              disabled={isLoadingSucursalesFilter}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por sucursal" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingSucursalesFilter ? (
                  <SelectItem value="loading-sucursales" disabled>Cargando sucursales...</SelectItem>
                ) : (
                  <>
                    <SelectItem value="ALL">Todas las sucursales</SelectItem>
                    {sucursales.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
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
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacidad</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sucursal</TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-100">
                {isFetchingAlmacenes && almacenes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" /> Cargando resultados...
                    </TableCell>
                  </TableRow>
                ) : almacenes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                      No se encontraron almacenes con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  almacenes.map((almacen) => (
                    <TableRow key={almacen.id} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{almacen.nombre}</TableCell>
                      <TableCell className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">{almacen.ubicacion || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{almacen.capacidad || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{almacen.sucursal_detail?.nombre || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openForm(almacen)}
                          className="text-blue-600 hover:bg-blue-50 rounded-md p-2 mr-1"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { if (window.confirm('¿Estás seguro de que quieres eliminar este almacén? Esta acción es irreversible.')) deleteAlmacenMutation.mutate(almacen.id); }}
                          className="text-red-600 hover:bg-red-50 rounded-md p-2"
                          disabled={deleteAlmacenMutation.isPending}
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

      {/* Formulario de Creación/Edición de Almacén */}
      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="sm:max-w-lg p-6 rounded-lg shadow-2xl border border-indigo-200">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-800">
              {editingAlmacen ? 'Editar Almacén' : 'Crear Nuevo Almacén'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-1">
              {editingAlmacen ? 'Modifica los datos del almacén.' : 'Introduce los datos para registrar un nuevo almacén.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            {/* Campo de selección de Empresa (solo para Superusuario) */}
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
              <Label htmlFor="ubicacion" className="text-right text-gray-700 pt-2">Ubicación</Label>
              <Input
                id="ubicacion"
                name="ubicacion"
                value={formData.ubicacion || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.ubicacion && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.ubicacion}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="capacidad" className="text-right text-gray-700">Capacidad</Label>
              <Input
                id="capacidad"
                name="capacidad"
                type="number"
                value={formData.capacidad ?? ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.capacidad && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.capacidad}</p>}
            </div>
            
            {/* Selector de Sucursal para el formulario de Almacén */}
            {/* Deshabilita el selector de sucursal si es superusuario y no ha seleccionado una empresa */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sucursal" className="text-right text-gray-700">Sucursal</Label>
              <Select
                value={formData.sucursal?.toString() || 'empty-selection-option'}
                onValueChange={(value) => handleSelectChange('sucursal', value)}
                // Deshabilita si está cargando sucursales O si es superusuario y no ha elegido empresa
                disabled={isLoadingSucursalesFilter || (currentUser?.is_superuser && !formData.empresa)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona una sucursal" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingSucursalesFilter ? (
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
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createAlmacenMutation.isPending || updateAlmacenMutation.isPending} className="rounded-md px-4 py-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={createAlmacenMutation.isPending || updateAlmacenMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md">
                {createAlmacenMutation.isPending || updateAlmacenMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  editingAlmacen ? 'Guardar Cambios' : 'Crear Almacén'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Almacenes;