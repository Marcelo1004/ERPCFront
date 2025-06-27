// src/pages/RbacPermissions.tsx

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Permission, CreatePermissionPayload, UpdatePermissionPayload, PaginatedResponse, FilterParams } from '@/types/rbac'; // Asegúrate que PaginatedResponse y FilterParams estén aquí
import { useAuth } from '@/contexts/AuthContext'; // Para hasPermission y user

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Search, XCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch'; // Para el campo is_active
import { Badge } from '@/components/ui/badge'; // Para mostrar el estado activo/inactivo
import { DialogTrigger } from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";



// Define una interfaz para el estado del formulario de permiso
interface PermissionFormData {
  name: string;
  code_name: string;
  description?: string;
  is_active?: boolean;
}

const RbacPermissions: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, hasPermission } = useAuth(); // Obtén hasPermission y currentUser

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);
  const [formData, setFormData] = useState<PermissionFormData>({
    name: '',
    code_name: '',
    description: '',
    is_active: true, // Por defecto, un nuevo permiso es activo
  });
  const [formErrors, setFormErrors] = useState<Record<string, string | string[]>>({});
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Puedes ajustar el tamaño de página

  // Estado para el diálogo de confirmación de eliminación
  const [showConfirmDeleteDialog, setShowConfirmDeleteDialog] = useState(false);
  const [permissionToDeleteId, setPermissionToDeleteId] = useState<number | null>(null);

  // === Permisos específicos para la gestión de Permisos RBAC ===
  const canViewPermissions = hasPermission('view_permission');
  const canAddPermissions = hasPermission('add_permission');
  const canChangePermissions = hasPermission('change_permission');
  const canDeletePermissions = hasPermission('delete_permission');

  // Lógica para determinar si un usuario puede modificar (crear/editar/eliminar) permisos
  // Aquí puedes definir tu lógica. Por ejemplo, solo superusuarios o roles específicos.
  // Asumamos que solo superusuarios o administradores con permisos explícitos pueden modificar.
  const canModify = currentUser?.is_superuser || (canAddPermissions || canChangePermissions || canDeletePermissions);
  // ============================================================

  // Consulta para obtener la lista de permisos
  const {
    data: permissionsData,
    isLoading: isLoadingPermissions,
    error: permissionsError,
    refetch,
  } = useQuery<PaginatedResponse<Permission>, Error>({
    queryKey: ['permissionsList', searchTerm, currentPage, pageSize],
    queryFn: async ({ queryKey }) => {
      const [_key, currentSearchTerm, page, size] = queryKey;
      const filters: FilterParams = {
        page: page as number,
        page_size: size as number,
        search: currentSearchTerm as string || '',
      };
      return api.fetchPermissions(filters);
    },
    enabled: !!currentUser?.id && canViewPermissions, // Solo ejecuta si hay usuario y tiene permiso para ver
    placeholderData: (previousData) => previousData, // Mantener datos anteriores al cambiar de página/filtros
    staleTime: 1000 * 60 * 1, // Datos considerados frescos por 1 minuto
  });

  const permissions = permissionsData?.results || [];
  const totalPages = permissionsData ? Math.ceil(permissionsData.count / pageSize) : 0;

  // No necesitamos filteredPermissions si la API ya maneja el search y la paginación.
  // Si tu backend no filtra, entonces descomenta y usa esta lógica:
  // const filteredPermissions = useMemo(() => {
  //   if (!searchTerm) return permissions;
  //   const lower = searchTerm.toLowerCase();
  //   return permissions.filter(
  //     perm =>
  //       perm.name.toLowerCase().includes(lower) ||
  //       perm.code_name.toLowerCase().includes(lower) ||
  //       (perm.description && perm.description.toLowerCase().includes(lower))
  //   );
  // }, [permissions, searchTerm]);


  // Mutaciones para CRUD
  const createPermissionMutation = useMutation<Permission, Error, CreatePermissionPayload>({
    mutationFn: (newPermissionData) => api.createPermission(newPermissionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissionsList'] });
      toast({ title: "Permiso creado", description: "El nuevo permiso ha sido registrado exitosamente." });
      closeForm(); // Cerrar y resetear formulario
    },
    onError: (err: any) => {
      console.error("Error al crear permiso:", err.response?.data || err.message);
      setFormErrors(err.response?.data || { general: err.message || "No se pudo crear el permiso." });
      toast({ variant: "destructive", title: "Error al crear permiso", description: err.response?.data?.detail || "No se pudo crear el permiso." });
    },
  });

  const updatePermissionMutation = useMutation<Permission, Error, { id: number; data: UpdatePermissionPayload }>({
    mutationFn: ({ id, data }) => api.updatePermission(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissionsList'] });
      toast({ title: "Permiso actualizado", description: "La información del permiso ha sido guardada exitosamente." });
      closeForm(); // Cerrar y resetear formulario
    },
    onError: (err: any) => {
      console.error("Error al actualizar permiso:", err.response?.data || err.message);
      setFormErrors(err.response?.data || { general: err.message || "No se pudo actualizar el permiso." });
      toast({ variant: "destructive", title: "Error al actualizar permiso", description: err.response?.data?.detail || "No se pudo actualizar el permiso." });
    },
  });

  const deletePermissionMutation = useMutation<void, Error, number>({
    mutationFn: (id: number) => api.deletePermission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissionsList'] });
      toast({ title: "Permiso eliminado", description: "El permiso ha sido eliminado exitosamente." });
      // Ajustar página si se elimina el último elemento de la página actual
      if (permissionsData && permissionsData.results.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    },
    onError: (err: any) => {
      console.error("Error al eliminar permiso:", err.response?.data || err.message);
      toast({ variant: "destructive", title: "Error al eliminar permiso", description: err.response?.data?.detail || "No se pudo eliminar el permiso." });
    },
    onSettled: () => {
      setShowConfirmDeleteDialog(false); // Siempre cierra el diálogo al finalizar
      setPermissionToDeleteId(null);
    }
  });

  // Manejadores de estado del formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: undefined })); // Limpia el error al cambiar el input
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, is_active: checked }));
  };

  const openForm = (permission?: Permission) => {
    setFormErrors({});
    if (permission) {
      setEditingPermission(permission);
      setFormData({
        name: permission.name || '',
        code_name: permission.code_name || '',
        description: permission.description || '',
        is_active: permission.is_active,
      });
    } else {
      setEditingPermission(null);
      setFormData({
        name: '',
        code_name: '',
        description: '',
        is_active: true, // Nuevo permiso por defecto activo
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingPermission(null);
    setFormData({ name: '', code_name: '', description: '', is_active: true }); // Resetear completamente
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({}); // Limpiar errores antes de una nueva validación

    let currentErrors: Record<string, string | string[]> = {};

    // Validaciones frontend
    if (!formData.name.trim()) {
      currentErrors.name = "El nombre del permiso es requerido.";
    }
    if (!formData.code_name.trim()) {
      currentErrors.code_name = "El código del permiso es requerido.";
    }

    if (Object.keys(currentErrors).length > 0) {
      setFormErrors(currentErrors);
      toast({ variant: "destructive", title: "Error de validación", description: currentErrors.general || "Por favor, corrige los errores en el formulario." });
      return;
    }

    try {
      if (editingPermission) {
        if (editingPermission.id) {
          // Si editas, solo envía los campos que pueden ser actualizados
          await updatePermissionMutation.mutateAsync({
            id: editingPermission.id,
            data: {
              name: formData.name,
              code_name: formData.code_name,
              description: formData.description,
              is_active: formData.is_active,
            }
          });
        } else {
          toast({ variant: "destructive", title: "Error", description: "ID de permiso para actualizar no encontrado." });
        }
      } else {
        await createPermissionMutation.mutateAsync({
          name: formData.name,
          code_name: formData.code_name,
          description: formData.description ?? '', // Asegurar que es string si no está definido
          is_active: formData.is_active ?? true, // Asegurar que es boolean si no está definido
        });
      }
    } catch (error) {
      // Los errores se manejan en onError de las mutaciones
    }
  };

  // Manejador para la paginación
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Manejador para el input de búsqueda
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInputValue(e.target.value);
  };

  // Manejador para activar la búsqueda con el botón o Enter
  const handleSearchClick = () => {
    setSearchTerm(searchInputValue);
    setCurrentPage(1); // Reiniciar a la primera página en cada nueva búsqueda
  };

  const handleClearSearch = () => {
    setSearchInputValue('');
    setSearchTerm('');
    setCurrentPage(1);
    refetch(); // Forzar una recarga para limpiar el filtro
  };

  // Manejador para iniciar el proceso de eliminación
  const handleDeleteClick = (permissionId: number) => {
    setPermissionToDeleteId(permissionId);
    setShowConfirmDeleteDialog(true);
  };

  // Manejador para confirmar la eliminación desde el diálogo
  const handleConfirmDelete = () => {
    if (permissionToDeleteId) {
      deletePermissionMutation.mutate(permissionToDeleteId);
    }
  };


  // Mensajes de carga y error iniciales
  if (isLoadingPermissions) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-background text-primary p-4">
        <Loader2 className="h-12 w-12 mb-4 animate-spin" />
        <h3 className="text-xl font-medium">Cargando permisos...</h3>
      </div>
    );
  }

  // Permiso general para acceder a la página de permisos
  if (!canViewPermissions) {
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

  if (permissionsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-background text-destructive p-4">
        <XCircle className="h-12 w-12 mb-4" />
        <h3 className="text-xl font-medium text-destructive-foreground">Error al cargar los permisos.</h3>
        <p className="text-muted-foreground mt-2 text-center">{permissionsError?.message || 'Ocurrió un error desconocido.'}</p>
        <Button onClick={() => refetch()} className="mt-4">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground min-h-screen">
      <h1 className="text-3xl font-bold text-primary font-heading">Gestión de Permisos RBAC</h1>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-semibold">Listado de Permisos</CardTitle>
          {canModify && (
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openForm()} className="gap-2">
                  <PlusCircle className="h-4 w-4" /> Nuevo Permiso
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] bg-card text-card-foreground">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-semibold text-gray-800">
                    {editingPermission ? 'Editar Permiso' : 'Crear Nuevo Permiso'}
                  </DialogTitle>
                  <DialogDescription className="text-gray-600 mt-1">
                    {editingPermission ? 'Modifica los datos del permiso.' : 'Introduce los datos para registrar un nuevo permiso.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right text-gray-700">Nombre</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name || ''}
                      onChange={handleInputChange}
                      className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                    {formErrors.name && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.name}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="code_name" className="text-right text-gray-700">Código</Label>
                    <Input
                      id="code_name"
                      name="code_name"
                      value={formData.code_name || ''}
                      onChange={handleInputChange}
                      className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                    {formErrors.code_name && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.code_name}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4"> {/* items-start para Textarea */}
                    <Label htmlFor="description" className="text-right text-gray-700 mt-2">Descripción</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={formData.description || ''}
                      onChange={handleInputChange}
                      className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                      rows={3}
                    />
                    {formErrors.description && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.description}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="is_active" className="text-right text-gray-700">Activo</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={handleSwitchChange}
                      className="col-span-3 justify-self-start" // Alinea el switch a la izquierda
                    />
                  </div>

                  {formErrors.general && <p className="col-span-4 text-red-500 text-sm text-center">{formErrors.general}</p>}

                  <DialogFooter className="pt-4 flex-col sm:flex-row sm:justify-end gap-2">
                    <Button type="button" variant="outline" onClick={closeForm} disabled={createPermissionMutation.isPending || updatePermissionMutation.isPending} className="rounded-md px-4 py-2 w-full sm:w-auto">
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createPermissionMutation.isPending || updatePermissionMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md w-full sm:w-auto">
                      {createPermissionMutation.isPending || updatePermissionMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        editingPermission ? 'Guardar Cambios' : 'Crear Permiso'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-grow">
              <Input
                placeholder="Buscar permisos por nombre o código..."
                value={searchInputValue}
                onChange={handleSearchInputChange}
                className="w-full pl-10 bg-input border-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchClick();
                  }
                }}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              {searchInputValue && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                  onClick={handleClearSearch}
                >
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearchClick} className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm rounded-md px-4 py-2">
              Buscar
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <Table className="min-w-full divide-y divide-border">
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead className="w-[50px]">ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Activo</TableHead>
                  {canModify && (
                    <TableHead className="w-[120px] text-right">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canModify ? 6 : 5} className="h-24 text-center text-muted-foreground">
                      No se encontraron permisos.
                    </TableCell>
                  </TableRow>
                ) : (
                  permissions.map((permission) => (
                    <TableRow key={permission.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{permission.id}</TableCell>
                      <TableCell>{permission.name}</TableCell>
                      <TableCell>{permission.code_name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{permission.description || 'N/A'}</TableCell>
                      <TableCell>
                        <Badge variant={permission.is_active ? 'default' : 'outline'} className={permission.is_active ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-400 hover:bg-gray-500'}>
                          {permission.is_active ? 'Sí' : 'No'}
                        </Badge>
                      </TableCell>
                      {canModify && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {canChangePermissions && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openForm(permission)}
                                disabled={updatePermissionMutation.isPending}
                              >
                                <Edit className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            {canDeletePermissions && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteClick(permission.id)}
                                    disabled={deletePermissionMutation.isPending}
                                  >
                                    {deletePermissionMutation.isPending && permissionToDeleteId === permission.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card text-card-foreground">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Esto eliminará permanentemente el permiso{' '}
                                      <span className="font-semibold text-foreground">"{permission.name}"</span>.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel asChild>
                                      <Button variant="outline">Cancelar</Button>
                                    </AlertDialogCancel>
                                    <AlertDialogAction asChild>
                                      <Button
                                        variant="destructive"
                                        onClick={handleConfirmDelete}
                                        disabled={deletePermissionMutation.isPending}
                                      >
                                        Eliminar
                                      </Button>
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoadingPermissions}
                variant="outline"
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoadingPermissions}
                variant="outline"
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* El Dialog para el formulario de Creación/Edición se maneja en el CardHeader */}

      {/* Diálogo de Confirmación para Eliminar (gestionado por AlertDialogTrigger dentro de la tabla) */}
      <AlertDialog open={showConfirmDeleteDialog} onOpenChange={setShowConfirmDeleteDialog}>
        <AlertDialogContent className="bg-card text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-gray-800">Confirmar Eliminación</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              ¿Estás seguro de que deseas eliminar el permiso "
              <span className="font-semibold text-gray-900">
                {permissions.find(perm => perm.id === permissionToDeleteId)?.name || 'este elemento'}
              </span>"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => setShowConfirmDeleteDialog(false)} disabled={deletePermissionMutation.isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={deletePermissionMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deletePermissionMutation.isPending ? (
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

export default RbacPermissions;