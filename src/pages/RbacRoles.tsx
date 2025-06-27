// src/pages/RbacRoles.tsx

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Role } from '@/types/rbac';
import { PaginatedResponse } from '@/services/api';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, PlusCircle, Edit, Trash2, Search, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input'; // Asegúrate de importar Input
import { Badge } from '@/components/ui/badge';

// Importa tu componente RoleForm (ya te aseguraste de que la ruta es correcta)
import RoleForm from './RoleForm'; // Asumiendo que ahora está en components/forms

const RbacRoles: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isRoleFormModalOpen, setIsRoleFormModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);


  const {
    data: rolesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PaginatedResponse<Role>, Error>({
    queryKey: ['roles', currentPage, pageSize, searchTerm],
    queryFn: async () => api.fetchRoles({ page: currentPage, page_size: pageSize, search: searchTerm }),
    staleTime: 1000 * 60 * 5,
    placeholderData: (previousData) => previousData,
  });

  const deleteRoleMutation = useMutation<void, Error, number>({
    mutationFn: async (id) => api.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({
        title: 'Rol eliminado',
        description: 'El rol ha sido eliminado exitosamente.',
      });
    },
    onError: (err: any) => {
      console.error("Error al eliminar rol:", err.response?.data || err.message);
      toast({
        variant: 'destructive',
        title: 'Error al eliminar rol',
        description: err.response?.data?.detail || 'No se pudo eliminar el rol.',
      });
    },
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setCurrentPage(1);
    refetch();
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const totalPages = rolesData ? Math.ceil(rolesData.count / pageSize) : 0;

  const handleOpenCreateModal = () => {
    setEditingRole(null);
    setIsRoleFormModalOpen(true);
  };

  const handleOpenEditModal = (role: Role) => {
    setEditingRole(role);
    setIsRoleFormModalOpen(true);
  };

  // Esta función se usará tanto para onSuccess (éxito) como para onCancel (cierre)
  // en los Dialogos/Alerts, y su nombre es 'handleRoleFormClose' como lo tienes definido.
  const handleRoleFormClose = () => {
    setIsRoleFormModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    toast({
        title: 'Operación exitosa',
        description: `El rol ha sido ${editingRole ? 'actualizado' : 'creado'} exitosamente.`,
    });
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-background text-primary p-4">
        <Loader2 className="h-12 w-12 mb-4 animate-spin" />
        <h3 className="text-xl font-medium">Cargando roles...</h3>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-background text-destructive p-4">
        <XCircle className="h-12 w-12 mb-4" />
        <h3 className="text-xl font-medium text-destructive-foreground">Error al cargar los roles.</h3>
        <p className="text-muted-foreground mt-2 text-center">{error?.message || 'Ocurrió un error desconocido.'}</p>
        <Button onClick={() => refetch()} className="mt-4">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground min-h-screen">
      <h1 className="text-3xl font-bold text-primary font-heading">Gestión de Roles RBAC</h1>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-semibold">Listado de Roles</CardTitle>

          {/* Botón "Nuevo Rol" para abrir el modal - CORRECCIÓN DE ESPACIOS */}
          <Dialog open={isRoleFormModalOpen} onOpenChange={setIsRoleFormModalOpen}>
            <DialogTrigger asChild><Button onClick={handleOpenCreateModal} className="gap-2"><PlusCircle className="h-4 w-4" /> Nuevo Rol</Button></DialogTrigger> {/* <-- COMPACTADO */}
            <DialogContent className="sm:max-w-[600px] bg-card text-card-foreground"> {/* Usar 600px como en RoleForm */}
              <DialogHeader>
                <DialogTitle>{editingRole ? 'Editar Rol' : 'Crear Nuevo Rol'}</DialogTitle>
              </DialogHeader>
              <RoleForm
                roleData={editingRole}
                onSuccess={handleRoleFormClose}
                onCancel={handleRoleFormClose} 
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-grow">
              <Input
                placeholder="Buscar roles por nombre..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full pl-10 bg-input border-input"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              {searchTerm && (
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
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            {/* CORRECCIÓN DE ESPACIOS EN LA TABLA */}
            <Table className="min-w-full divide-y divide-border">
              <TableHeader className="bg-muted"><TableRow>
                <TableHead className="w-[50px]">ID</TableHead>
                <TableHead>Nombre del Rol</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Permisos</TableHead>
                <TableHead>Activo</TableHead>
                <TableHead className="w-[120px] text-right">Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rolesData?.results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No se encontraron roles.
                    </TableCell>
                  </TableRow>
                ) : (
                  rolesData?.results.map((role) => (
                    <TableRow key={role.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{role.id}</TableCell>
                      <TableCell>{role.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {role.description || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions && role.permissions.length > 0 ? (
                            role.permissions.map((p) => (
                              <Badge key={p.id} variant="secondary" className="px-2 py-0.5 text-xs">
                                {p.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground text-sm">Ninguno</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.is_active ? 'default' : 'outline'} className={role.is_active ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-400 hover:bg-gray-500'}>
                          {role.is_active ? 'Sí' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(role)}
                            disabled={deleteRoleMutation.isPending}
                          >
                            <Edit className="h-4 w-4 text-primary" />
                          </Button>
                          <AlertDialog>
                            {/* CORRECCIÓN DE ESPACIOS EN AlertDialogTrigger */}
                            <AlertDialogTrigger asChild><Button
                                variant="ghost"
                                size="icon"
                              >
                                {deleteRoleMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button></AlertDialogTrigger> {/* <-- COMPACTADO */}
                            <AlertDialogContent className="bg-card text-card-foreground">
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Esto eliminará permanentemente el rol{' '}
                                  <span className="font-semibold text-foreground">"{role.name}"</span>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel asChild><Button variant="outline">Cancelar</Button></AlertDialogCancel> {/* <-- COMPACTADO */}
                                <AlertDialogAction asChild><Button
                                    variant="destructive"
                                    onClick={() => deleteRoleMutation.mutate(role.id)}
                                  >
                                    Eliminar
                                  </Button></AlertDialogAction> {/* <-- COMPACTADO */}
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
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
                disabled={currentPage === 1 || isLoading}
                variant="outline"
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
                variant="outline"
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RbacRoles;