import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Sucursal } from '@/types/sucursales';
import { Empresa } from '@/types/auth'; // Necesario para mostrar el nombre de la empresa en la tabla
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
import { Loader2, PlusCircle, Edit, Trash2, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AxiosError } from 'axios';

const Sucursales: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState<Sucursal | null>(null);
  const [formData, setFormData] = useState<Partial<Sucursal>>({
    nombre: '',
    direccion: '',
    telefono: '',
    empresa: undefined, // Se establecerá automáticamente para administradores
  });
  const [formErrors, setFormErrors] = useState<any>({});
  // Nuevo estado para el valor del input de búsqueda (lo que el usuario escribe)
  const [searchInputValue, setSearchInputValue] = useState('');
  // Estado que se usa para el filtro real de la consulta y la renderización de la tabla
  const [searchTerm, setSearchTerm] = useState('');

  const canManageSucursales = currentUser?.is_superuser || currentUser?.role === 'ADMINISTRATIVO';

  // Obtener la lista de sucursales
  const { data: sucursalesData, isLoading: isLoadingSucursales, error: sucursalesError } = useQuery<PaginatedResponse<Sucursal>, Error>({
    queryKey: ['sucursalesList', searchTerm, currentUser?.empresa, currentUser?.is_superuser], // searchTerm ahora controla la consulta
    queryFn: ({ queryKey }) => {
      const [_key, currentSearchTerm, empresaId, isSuperuser] = queryKey;
      const filters: FilterParams = { search: currentSearchTerm as string || '' };

      if (!isSuperuser && empresaId) { // Los administradores solo ven sucursales de su empresa
        filters.empresa = empresaId as number;
      }
      return api.fetchSucursales(filters);
    },
    enabled: !!currentUser?.id && canManageSucursales,
  });
  const sucursales = sucursalesData?.results || [];

  // Obtener la lista de empresas (solo para SuperUsuario al crear/editar)
  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery<PaginatedResponse<Empresa>, Error>({
    queryKey: ['empresasForSucursalForm'],
    queryFn: () => api.fetchEmpresas(),
    enabled: isFormOpen && currentUser?.is_superuser, // Solo para SuperUsuario cuando el form está abierto
  });
  const empresas = empresasData?.results || [];

  const createSucursalMutation = useMutation<Sucursal, AxiosError, Omit<Sucursal, 'id' | 'empresa_detail'>>({
    mutationFn: (newSucursalData) => api.createSucursal(newSucursalData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursalesList'] });
      toast({ title: "Sucursal creada", description: "La nueva sucursal ha sido registrada exitosamente." });
      closeForm();
    },
    onError: (err: AxiosError) => {
      console.error("Error al crear sucursal:", err.response?.data || err.message);
      setFormErrors((err.response?.data as Record<string, string | string[]>) || {});
      const errorMessage = (err.response?.data as any)?.detail || "No se pudo crear la sucursal. Verifica los datos.";
      toast({ variant: "destructive", title: "Error al crear sucursal", description: errorMessage });
    },
  });

  const updateSucursalMutation = useMutation<Sucursal, AxiosError, { id: number; data: Partial<Omit<Sucursal, 'empresa_detail'>> }>({
    mutationFn: ({ id, data }) => api.updateSucursal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursalesList'] });
      toast({ title: "Sucursal actualizada", description: "La información de la sucursal ha sido guardada exitosamente." });
      closeForm();
      setEditingSucursal(null);
    },
    onError: (err: AxiosError) => {
      console.error("Error al actualizar sucursal:", err.response?.data || err.message);
      setFormErrors((err.response?.data as Record<string, string | string[]>) || {});
      const errorMessage = (err.response?.data as any)?.detail || "No se pudo actualizar la sucursal. Verifica los datos.";
      toast({ variant: "destructive", title: "Error al actualizar sucursal", description: errorMessage });
    },
  });

  const deleteSucursalMutation = useMutation<void, AxiosError, number>({
    mutationFn: (id) => api.deleteSucursal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sucursalesList'] });
      toast({ title: "Sucursal eliminada", description: "La sucursal ha sido eliminada exitosamente." });
    },
    onError: (err: AxiosError) => {
      console.error("Error al eliminar sucursal:", err.response?.data || err.message);
      const errorMessage = (err.response?.data as any)?.detail || "No se pudo eliminar la sucursal.";
      toast({ variant: "destructive", title: "Error al eliminar sucursal", description: errorMessage });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value === '' ? null : parseInt(value, 10) }));
  };

  const openForm = (sucursal?: Sucursal) => {
    setFormErrors({});
    if (sucursal) {
      setEditingSucursal(sucursal);
      setFormData({
        id: sucursal.id,
        nombre: sucursal.nombre || '',
        direccion: sucursal.direccion || '',
        telefono: sucursal.telefono || '',
        empresa: sucursal.empresa,
      });
    } else {
      setEditingSucursal(null);
      setFormData({
        nombre: '',
        direccion: '',
        telefono: '',
        empresa: currentUser?.role === 'ADMINISTRATIVO' && currentUser.empresa ? currentUser.empresa : undefined,
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingSucursal(null);
    setFormData({});
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (!formData.nombre || !formData.direccion || !formData.empresa) {
      toast({ variant: "destructive", title: "Error de validación", description: "El nombre, la dirección y la empresa son requeridos." });
      return;
    }

    const dataToSubmit: Omit<Sucursal, 'id' | 'empresa_detail'> = {
      nombre: formData.nombre,
      direccion: formData.direccion,
      telefono: formData.telefono || null,
      empresa: formData.empresa,
    };

    if (editingSucursal) {
      if (editingSucursal.id) {
        updateSucursalMutation.mutate({ id: editingSucursal.id, data: dataToSubmit });
      } else {
        toast({ variant: "destructive", title: "Error", description: "ID de sucursal para actualizar no encontrado." });
      }
    } else {
      createSucursalMutation.mutate(dataToSubmit);
    }
  };

  // Filtrado de sucursales en el cliente, además del filtrado opcional del backend
  const filteredSucursales = useMemo(() => {
    if (!sucursales) return [];
    if (!searchTerm) return sucursales; // Si no hay término de búsqueda, devuelve todos.

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return sucursales.filter(sucursal =>
      sucursal.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
      sucursal.direccion.toLowerCase().includes(lowerCaseSearchTerm) ||
      sucursal.telefono?.toLowerCase().includes(lowerCaseSearchTerm) ||
      sucursal.empresa_detail?.nombre.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [sucursales, searchTerm]);

  // Función para eliminar una sucursal
  const handleDelete = (sucursalId: number) => { // <-- Definición de handleDelete
    if (window.confirm('¿Estás seguro de que quieres eliminar esta sucursal? Esta acción es irreversible.')) {
      deleteSucursalMutation.mutate(sucursalId);
    }
  };

  // Función para activar la búsqueda cuando se presiona el botón
  const handleSearchClick = () => {
    setSearchTerm(searchInputValue); // Actualiza searchTerm para disparar la consulta de useQuery y el filtro de useMemo
  };

  if (!canManageSucursales) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Acceso Denegado</AlertTitle>
        <AlertDescription>
          No tienes permisos para gestionar sucursales. Solo los Super Usuarios o Administradores de Empresa pueden acceder a esta sección.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoadingSucursales) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando sucursales...</p>
      </div>
    );
  }

  if (sucursalesError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudieron cargar las sucursales: {sucursalesError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-2xl rounded-xl border border-indigo-100">
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Gestión de Sucursales</CardTitle>
            <CardDescription className="text-gray-600 mt-1">Administra las sucursales de tu {currentUser?.is_superuser ? 'sistema' : 'empresa'}.</CardDescription>
          </div>
          <Button onClick={() => openForm()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-md px-4 py-2">
            <PlusCircle className="mr-2 h-4 w-4" /> Nueva Sucursal
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {/* Contenedor flex para alinear el input y el botón de búsqueda */}
          <div className="mb-4 flex items-center space-x-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar sucursales por nombre, dirección o empresa..."
                value={searchInputValue} // Vinculado a lo que el usuario escribe
                onChange={(e) => setSearchInputValue(e.target.value)} // Actualiza el input value
                className="w-full pl-10" // w-full para ocupar el espacio del flex-grow
                // Opcional: para activar búsqueda al presionar Enter en el input
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchClick();
                  }
                }}
              />
            </div>
            {/* Botón para disparar la búsqueda explícitamente */}
            <Button onClick={handleSearchClick} className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm rounded-md px-4 py-2">
              Buscar
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</TableHead><TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dirección</TableHead><TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teléfono</TableHead><TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</TableHead><TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-100">
                {filteredSucursales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                      No se encontraron sucursales.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSucursales.map((sucursal) => (
                    <TableRow key={sucursal.id} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sucursal.nombre}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{sucursal.direccion}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{sucursal.telefono || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{sucursal.empresa_detail?.nombre || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openForm(sucursal)}
                          className="text-blue-600 hover:bg-blue-50 rounded-md p-2 mr-1"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sucursal.id)}
                          className="text-red-600 hover:bg-red-50 rounded-md p-2"
                          disabled={deleteSucursalMutation.isPending}
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

      {/* Formulario de Creación/Edición de Sucursal */}
      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="sm:max-w-md p-6 rounded-lg shadow-2xl border border-indigo-200">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-800">
              {editingSucursal ? 'Editar Sucursal' : 'Crear Nueva Sucursal'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-1">
              {editingSucursal ? 'Modifica los datos de la sucursal.' : 'Introduce los datos para registrar una nueva sucursal.'}
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="direccion" className="text-right text-gray-700">Dirección</Label>
              <Input
                id="direccion"
                name="direccion"
                value={formData.direccion || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              {formErrors.direccion && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.direccion}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="telefono" className="text-right text-gray-700">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                value={formData.telefono || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.telefono && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.telefono}</p>}
            </div>

            {/* Selector de Empresa (solo si es SuperUsuario o al editar) */}
            {(currentUser?.is_superuser || (editingSucursal && currentUser?.role === 'ADMINISTRATIVO')) && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="empresa" className="text-right text-gray-700">Empresa</Label>
                    <Select
                        value={formData.empresa?.toString() || ''}
                        onValueChange={(value) => handleSelectChange('empresa', value)}
                        disabled={isLoadingEmpresas || currentUser?.role === 'ADMINISTRATIVO'} // Admin no puede cambiar su empresa
                    >
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Selecciona una empresa" />
                        </SelectTrigger>
                        <SelectContent>
                            {isLoadingEmpresas ? (
                                <SelectItem value="loading_empresas" disabled>Cargando empresas...</SelectItem>
                            ) : (
                                <>
                                    {currentUser?.is_superuser && <SelectItem value="empty_option">-- Selecciona --</SelectItem>}
                                    {empresas.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id.toString()}>
                                            {emp.nombre}
                                        </SelectItem>
                                    ))}
                                    {currentUser?.role === 'ADMINISTRATIVO' && currentUser.empresa_detail && (
                                        <SelectItem
                                            key={currentUser.empresa_detail.id}
                                            value={currentUser.empresa_detail.id.toString()}
                                            disabled // No permitir cambio si es admin y ya tiene empresa
                                        >
                                            {currentUser.empresa_detail.nombre} (Tu Empresa)
                                        </SelectItem>
                                    )}
                                </>
                            )}
                        </SelectContent>
                    </Select>
                    {formErrors.empresa && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.empresa}</p>}
                </div>
            )}


            {formErrors.general && <p className="col-span-4 text-red-500 text-sm text-center">{formErrors.general}</p>}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createSucursalMutation.isPending || updateSucursalMutation.isPending} className="rounded-md px-4 py-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={createSucursalMutation.isPending || updateSucursalMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md">
                {createSucursalMutation.isPending || updateSucursalMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  editingSucursal ? 'Guardar Cambios' : 'Crear Sucursal'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sucursales;