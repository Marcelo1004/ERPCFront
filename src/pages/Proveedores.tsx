import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Proveedor, ProveedorFormData, ProveedoresApiResponse, ProveedorFilters } from '@/types/proveedores';
import { Empresa } from '@/types/empresas';
import { PaginatedResponse } from '@/services/api';

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Search, Truck as TruckIcon, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Proveedores: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [formData, setFormData] = useState<ProveedorFormData>({
    nombre: '',
    contacto_nombre: '', // ¡Corregido!
    contacto_email: '',  // ¡Corregido!
    contacto_telefono: '', // ¡Corregido!
    direccion: '',
    nit: '',
    activo: true,
    empresa: currentUser?.empresa || undefined,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string | string[]>>({});
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showConfirmDeleteDialog, setShowConfirmDeleteDialog] = useState(false);
  const [proveedorToDeleteId, setProveedorToDeleteId] = useState<number | null>(null);

  const canViewProveedores = hasPermission('view_proveedor');
  const canAddProveedores = hasPermission('add_proveedor');
  const canChangeProveedores = hasPermission('change_proveedor');
  const canDeleteProveedores = hasPermission('delete_proveedor');

  const canModify = canAddProveedores || canChangeProveedores || canDeleteProveedores;

  const { data: proveedoresData, isLoading: isLoadingProveedores, error: proveedoresError } = useQuery<ProveedoresApiResponse, Error>({
    queryKey: ['proveedoresList', searchTerm, currentUser?.empresa, currentUser?.is_superuser],
    queryFn: async ({ queryKey }) => {
      const [_key, currentSearchTerm, empresaId, isSuperuser] = queryKey;
      const filters: ProveedorFilters = { search: currentSearchTerm as string || '' };

      if (!(isSuperuser as boolean) && (empresaId as number)) {
        filters.empresa = empresaId as number;
      }
      return api.fetchProveedores(filters);
    },
    enabled: !!currentUser?.id && canViewProveedores,
  });

  const proveedores = proveedoresData?.results || [];

  const { data: empresasData, isLoading: isLoadingEmpresas, error: empresasError } = useQuery<PaginatedResponse<Empresa>, Error>({
    queryKey: ['empresasForSelect'],
    queryFn: async () => {
      const response = await api.fetchEmpresas({ page_size: 1000 });
      return response;
    },
    enabled: currentUser?.is_superuser === true,
    staleTime: 5 * 60 * 1000,
  });
  const allEmpresas = empresasData?.results || [];

  const createProveedorMutation = useMutation<Proveedor, Error, ProveedorFormData>({
    mutationFn: (newProveedorData) => api.createProveedor(newProveedorData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedoresList'] });
      toast({ title: "Proveedor creado", description: "El nuevo proveedor ha sido registrado exitosamente." });
      closeForm();
    },
    onError: (err: any) => {
      console.error("Error al crear proveedor:", err.response?.data || err.message);
      setFormErrors(err.response?.data || { general: err.message || "No se pudo crear el proveedor." });
      toast({ variant: "destructive", title: "Error al crear proveedor", description: err.response?.data?.detail || "No se pudo crear el proveedor." });
    },
  });

  const updateProveedorMutation = useMutation<Proveedor, Error, { id: number; data: Partial<ProveedorFormData> }>({
    mutationFn: ({ id, data }) => api.updateProveedor(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedoresList'] });
      toast({ title: "Proveedor actualizado", description: "La información del proveedor ha sido guardada exitosamente." });
      closeForm();
    },
    onError: (err: any) => {
      console.error("Error al actualizar proveedor:", err.response?.data || err.message);
      setFormErrors(err.response?.data || { general: err.message || "No se pudo actualizar el proveedor." });
      toast({ variant: "destructive", title: "Error al actualizar proveedor", description: err.response?.data?.detail || "No se pudo actualizar el proveedor." });
    },
  });

  const deleteProveedorMutation = useMutation({
    mutationFn: (id: number) => api.deleteProveedor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedoresList'] });
      toast({ title: "Proveedor eliminado", description: "El proveedor ha sido eliminado exitosamente." });
    },
    onError: (err: any) => {
      console.error("Error al eliminar proveedor:", err.response?.data || err.message);
      toast({ variant: "destructive", title: "Error al eliminar proveedor", description: err.response?.data?.detail || "No se pudo eliminar el proveedor." });
    },
    onSettled: () => {
      setShowConfirmDeleteDialog(false);
      setProveedorToDeleteId(null);
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' && e.target instanceof HTMLInputElement
        ? e.target.checked
        : value,
    }));
    setFormErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, activo: checked }));
  };

  const openForm = (proveedor?: Proveedor) => {
    setFormErrors({});
    if (proveedor) {
      setEditingProveedor(proveedor);
      setFormData({
        nombre: proveedor.nombre || '',
        contacto_nombre: proveedor.contacto_nombre || '', // ¡Corregido!
        contacto_email: proveedor.contacto_email || '',  // ¡Corregido!
        contacto_telefono: proveedor.contacto_telefono || '', // ¡Corregido!
        direccion: proveedor.direccion || '',
        nit: proveedor.nit || '',
        activo: proveedor.activo,
        empresa: proveedor.empresa,
      });
    } else {
      setEditingProveedor(null);
      setFormData({
        nombre: '',
        contacto_nombre: '',
        contacto_email: '',
        contacto_telefono: '',
        direccion: '',
        nit: '',
        activo: true,
        empresa: !currentUser?.is_superuser && currentUser?.empresa ? currentUser.empresa : undefined,
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingProveedor(null);
    setFormData({ 
      nombre: '', 
      contacto_nombre: '', 
      contacto_email: '', 
      contacto_telefono: '', 
      direccion: '', 
      nit: '', 
      activo: true, 
      empresa: !currentUser?.is_superuser && currentUser?.empresa ? currentUser.empresa : undefined 
    });
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    let currentErrors: Record<string, string | string[]> = {};

    if (!formData.nombre.trim()) {
      currentErrors.nombre = "El nombre del proveedor es requerido.";
    }
    
    // Lógica para asignar/validar la empresa
    if (!currentUser?.is_superuser) {
      if (!currentUser?.empresa) {
        currentErrors.general = "Tu cuenta no está asociada a una empresa. Contacta a un administrador.";
      } else {
        // Asegurarse de que la empresa se envía con el ID del usuario actual
        // Aquí formData.empresa ya debería estar seteado desde el useState inicial o desde openForm
        // Solo necesitamos asegurarnos de que sea el ID correcto
        if (formData.empresa !== currentUser.empresa) {
             console.warn("La empresa en formData no coincide con la empresa del usuario. Forzando a la empresa del usuario.");
             formData.empresa = currentUser.empresa; // Forzar la empresa del usuario si hay una discrepancia
        }
      }
    } else { // Si es Superusuario
      if (!formData.empresa) {
        currentErrors.empresa = "Los Superusuarios deben seleccionar una empresa.";
      }
    }

    if (Object.keys(currentErrors).length > 0) {
      setFormErrors(currentErrors);
      toast({ variant: "destructive", title: "Error de validación", description: currentErrors.general || "Por favor, corrige los errores en el formulario." });
      return;
    }

    try {
      if (editingProveedor) {
        if (editingProveedor.id) {
          // Asegúrate de que los datos enviados a la API sean los correctos
          await updateProveedorMutation.mutateAsync({ id: editingProveedor.id, data: formData });
        } else {
          toast({ variant: "destructive", title: "Error", description: "ID de proveedor para actualizar no encontrado." });
        }
      } else {
        // Asegúrate de que los datos enviados a la API sean los correctos
        await createProveedorMutation.mutateAsync(formData);
      }
    } catch (error) {
      // Los errores se manejan en onError de las mutaciones
    }
  };

  const filteredProveedores = useMemo(() => {
    if (!proveedores) return [];
    if (!searchTerm) return proveedores;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return proveedores.filter(proveedor =>
      proveedor.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
      (proveedor.contacto_nombre && proveedor.contacto_nombre.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (proveedor.contacto_email && proveedor.contacto_email.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (proveedor.contacto_telefono && proveedor.contacto_telefono.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (proveedor.direccion && proveedor.direccion.toLowerCase().includes(lowerCaseSearchTerm)) || // ¡Añadido 'direccion' a la búsqueda!
      (proveedor.nit && proveedor.nit.toLowerCase().includes(lowerCaseSearchTerm)) ||
      (proveedor.empresa_detail?.nombre && proveedor.empresa_detail.nombre.toLowerCase().includes(lowerCaseSearchTerm))
    );
  }, [proveedores, searchTerm]);

  const handleDeleteClick = (proveedorId: number) => {
    setProveedorToDeleteId(proveedorId);
    setShowConfirmDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (proveedorToDeleteId) {
      deleteProveedorMutation.mutate(proveedorToDeleteId);
    }
  };

  const handleSearchButtonClick = () => {
    setSearchTerm(searchInputValue);
  };

  if (!canViewProveedores) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto my-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Acceso Denegado</AlertTitle>
        <AlertDescription>
          No tienes permisos para ver esta sección. Contacta a tu administrador.
        </AlertDescription>
      </Alert>
    );
  }

  const showLoader = isLoadingProveedores || (currentUser?.is_superuser && isLoadingEmpresas);
  if (showLoader) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando proveedores...</p>
      </div>
    );
  }

  const showError = proveedoresError || (currentUser?.is_superuser && empresasError);
  if (showError) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto my-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error de Carga</AlertTitle>
        <AlertDescription>
          No se pudieron cargar los datos: {proveedoresError?.message || empresasError?.message || 'Error desconocido.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-2xl rounded-xl border border-blue-100 bg-white text-gray-900">
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <div>
            <CardTitle className="text-2xl font-bold">Gestión de Proveedores</CardTitle>
            <CardDescription className="text-gray-600 mt-1">Administra los proveedores de productos y servicios para tu empresa.</CardDescription>
          </div>
          {canAddProveedores && (
            <Button onClick={() => openForm()} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md rounded-md px-4 py-2">
              <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Proveedor
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="relative flex-grow w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar proveedores por nombre, contacto, email, NIT..."
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchButtonClick();
                  }
                }}
              />
            </div>
            <Button onClick={handleSearchButtonClick} className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm rounded-md px-4 py-2 w-full sm:w-auto">
              Buscar
            </Button>
          </div>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Email</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Teléfono</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Dirección</TableHead> {/* ¡Añadido! */}
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">NIT/RUC</TableHead> {/* Muestra NIT aquí */}
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activo</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</TableHead>
                  {canModify && (<TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-100">
                {filteredProveedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canModify ? 9 : 8} className="h-24 text-center text-gray-500">No se encontraron proveedores.</TableCell> {/* ¡Colspan ajustado! */}
                  </TableRow>
                ) : (
                  filteredProveedores.map((proveedor) => (
                    <TableRow key={proveedor.id} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{proveedor.nombre}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{proveedor.contacto_nombre || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden md:table-cell">{proveedor.contacto_email || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell">{proveedor.contacto_telefono || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden lg:table-cell">{proveedor.direccion || 'N/A'}</TableCell> {/* ¡Muestra dirección! */}
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 hidden lg:table-cell">{proveedor.nit || 'N/A'}</TableCell> {/* Muestra NIT */}
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {proveedor.activo ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Activo</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Inactivo</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{proveedor.empresa_detail?.nombre || 'N/A'}</TableCell>
                      {canModify && (
                        <TableCell className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {canChangeProveedores && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openForm(proveedor)}
                              className="text-blue-600 hover:bg-blue-50 rounded-md p-2 mr-1"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteProveedores && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(proveedor.id)}
                              className="text-red-600 hover:bg-red-50 rounded-md p-2"
                              disabled={deleteProveedorMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Formulario de Creación/Edición de Proveedor */}
      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="sm:max-w-[600px] p-6 rounded-lg shadow-2xl border border-blue-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-800">
              {editingProveedor ? 'Editar Proveedor' : 'Crear Nuevo Proveedor'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-1">
              {editingProveedor ? 'Modifica los datos del proveedor.' : 'Introduce los datos para registrar un nuevo proveedor.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Nombre */}
            <div className="grid gap-2">
              <Label htmlFor="nombre" className="text-gray-700">Nombre</Label>
              <Input
                id="nombre"
                name="nombre"
                type="text"
                value={formData.nombre || ''}
                onChange={handleInputChange}
                className="rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              {formErrors.nombre && <p className="text-red-500 text-sm mt-1">{formErrors.nombre}</p>}
            </div>

            {/* Contacto Nombre */}
            <div className="grid gap-2">
              <Label htmlFor="contacto_nombre" className="text-gray-700">Nombre de Contacto</Label>
              <Input
                id="contacto_nombre"
                name="contacto_nombre"
                type="text"
                value={formData.contacto_nombre || ''}
                onChange={handleInputChange}
                className="rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
              {formErrors.contacto_nombre && <p className="text-red-500 text-sm mt-1">{formErrors.contacto_nombre}</p>}
            </div>

            {/* Contacto Email */}
            <div className="grid gap-2">
              <Label htmlFor="contacto_email" className="text-gray-700">Email de Contacto</Label>
              <Input
                id="contacto_email"
                name="contacto_email"
                type="email"
                value={formData.contacto_email || ''}
                onChange={handleInputChange}
                className="rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
              {formErrors.contacto_email && <p className="text-red-500 text-sm mt-1">{formErrors.contacto_email}</p>}
            </div>

            {/* Contacto Teléfono */}
            <div className="grid gap-2">
              <Label htmlFor="contacto_telefono" className="text-gray-700">Teléfono de Contacto</Label>
              <Input
                id="contacto_telefono"
                name="contacto_telefono"
                type="tel"
                value={formData.contacto_telefono || ''}
                onChange={handleInputChange}
                className="rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
              {formErrors.contacto_telefono && <p className="text-red-500 text-sm mt-1">{formErrors.contacto_telefono}</p>}
            </div>

            {/* Dirección */}
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="direccion" className="text-gray-700">Dirección</Label>
              <Textarea
                id="direccion"
                name="direccion"
                value={formData.direccion || ''}
                onChange={handleInputChange}
                rows={3}
                className="rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 resize-y"
              />
              {formErrors.direccion && <p className="text-red-500 text-sm mt-1">{formErrors.direccion}</p>}
            </div>

            {/* NIT */}
            <div className="grid gap-2">
              <Label htmlFor="nit" className="text-gray-700">NIT/RUC</Label>
              <Input
                id="nit"
                name="nit"
                type="text"
                value={formData.nit || ''}
                onChange={handleInputChange}
                className="rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
              {formErrors.nit && <p className="text-red-500 text-sm mt-1">{formErrors.nit}</p>}
            </div>

            {/* Campo de Empresa (solo para Superusuario) */}
            {currentUser?.is_superuser && (
              <div className="grid gap-2">
                <Label htmlFor="empresa" className="text-gray-700">Empresa</Label>
                <select
                  id="empresa"
                  name="empresa"
                  value={formData.empresa || ''}
                  onChange={handleInputChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                  disabled={createProveedorMutation.isPending || updateProveedorMutation.isPending || isLoadingEmpresas}
                >
                  <option value="">Seleccionar Empresa</option>
                  {allEmpresas.map(empresa => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
                {isLoadingEmpresas && <p className="text-muted-foreground text-sm mt-1">Cargando empresas...</p>}
                {empresasError && <p className="text-red-500 text-sm mt-1">Error al cargar empresas.</p>}
                {formErrors.empresa && <p className="text-red-500 text-sm mt-1">{formErrors.empresa}</p>}
              </div>
            )}

            {/* Activo Switch */}
            <div className="flex items-center space-x-2 md:col-span-2 mt-2">
              <Switch
                id="activo"
                name="activo" // Añadir name para handleInputChange si usas un manejador genérico
                checked={formData.activo}
                onCheckedChange={handleSwitchChange}
                disabled={createProveedorMutation.isPending || updateProveedorMutation.isPending}
              />
              <Label htmlFor="activo" className="text-gray-700">Activo</Label>
            </div>

            {formErrors.general && <p className="md:col-span-2 text-red-500 text-sm text-center">{formErrors.general}</p>}

            <DialogFooter className="md:col-span-2 pt-4 flex-col sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createProveedorMutation.isPending || updateProveedorMutation.isPending} className="rounded-md px-4 py-2 w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" disabled={createProveedorMutation.isPending || updateProveedorMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 shadow-md w-full sm:w-auto">
                {createProveedorMutation.isPending || updateProveedorMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  editingProveedor ? 'Guardar Cambios' : 'Crear Proveedor'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmación para Eliminar */}
      <AlertDialog open={showConfirmDeleteDialog} onOpenChange={setShowConfirmDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-800">Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              ¿Estás seguro de que deseas eliminar al proveedor "
              <span className="font-semibold text-gray-900">
                {proveedores.find(prov => prov.id === proveedorToDeleteId)?.nombre || 'este elemento'}
              </span>"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => setShowConfirmDeleteDialog(false)} disabled={deleteProveedorMutation.isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button 
                variant="destructive" 
                onClick={handleConfirmDelete} 
                disabled={deleteProveedorMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteProveedorMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  'Eliminar'
                )}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Proveedores;