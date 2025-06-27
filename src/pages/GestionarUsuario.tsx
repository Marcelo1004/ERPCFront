import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { User, UserCreationData, UserUpdateData, PaginatedResponse, FilterParams } from '@/types/auth'; 
import { Empresa } from '@/types/empresas'; 
import { Suscripcion } from '@/types/suscripciones'; 
import { Role, UserRoleName } from '@/types/rbac'; // Asegúrate de importar UserRoleName

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
import { Loader2, PlusCircle, Edit, Trash2, Search, Building, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch'; 
import { AxiosError } from 'axios';
import { Link } from 'react-router-dom';
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


interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const GestionarUsuario: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false); 
  
  const [formData, setFormData] = useState<Partial<UserCreationData & UserUpdateData & { id?: number; }>>({
    username: '', email: '', first_name: '', last_name: '', password: '', password2: '',
    role: null, 
    telefono: '', ci: '', direccion: '', empresa: null, 
    is_active: true,
    is_staff: false,
    is_superuser: false,
    empresa_nombre: '', empresa_nit: '', suscripcion_id: undefined,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string | string[]>>({});
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState(''); 
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
    onCancel: () => {},
  });

  const isSuperUser = currentUser?.is_superuser;
  const isAdministrativoLogueado = currentUser?.role?.name === 'Administrador'; 

  // --- QUERIES para obtener Roles y Empresas ---
  const { data: allRolesData, isLoading: isLoadingAllRoles, error: errorAllRoles } = useQuery<PaginatedResponse<Role>, Error>({
    queryKey: ['allRoles'],
    queryFn: () => api.fetchRoles({ all: true }), 
    enabled: !!currentUser?.id, 
    staleTime: 5 * 60 * 1000, 
  });
  const allRoles = allRolesData?.results || [];

  // Mantiene el nombre del rol seleccionado en el formulario
  const selectedRoleName = useMemo(() => {
    // Aquí el tipo de `r.name` ya debería ser `UserRoleName` si rbac.ts está correcto.
    return allRoles.find(r => r.id === formData.role)?.name;
  }, [formData.role, allRoles]);

  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery<PaginatedResponse<Empresa>, Error>({
    queryKey: ['empresasListForUserForm'],
    queryFn: () => api.fetchEmpresas({ all: true }), 
    enabled: isSuperUser && isFormOpen,
    staleTime: 5 * 60 * 1000, 
  });
  const empresas = empresasData?.results || [];

  const { data: suscripcionesData, isLoading: isLoadingSuscripciones } = useQuery<PaginatedResponse<Suscripcion>, Error>({
    queryKey: ['suscripciones'],
    queryFn: () => api.fetchSuscripciones({ all: true }),
    enabled: !!currentUser?.id && isSuperUser && isFormOpen && !editingUser && (selectedRoleName === 'Administrador'), 
    staleTime: 5 * 60 * 1000,
  });
  const suscripciones = suscripcionesData?.results || [];

  // --- QUERY para la lista de usuarios ---
  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useQuery<PaginatedResponse<User>, Error>({
    queryKey: ['usersList', searchTerm, currentUser?.empresa, currentUser?.is_superuser, selectedRoleFilter],
    queryFn: ({ queryKey }) => {
      const [_key, currentSearchTerm, empresaId, isSuperuser, roleFilter] = queryKey;
      const filters: FilterParams = { search: currentSearchTerm as string || '' };

      if (!(isSuperuser as boolean) && empresaId) {
        filters.empresa = empresaId as number;
      }
      if (roleFilter && roleFilter !== 'ALL') {
        filters.role_name = roleFilter as string; 
      }
      return api.fetchUsuarios(filters);
    },
    enabled: !!currentUser?.id, 
  });
  const users = usersData?.results || [];

  // --- MUTACIONES ---
  const createUserMutation = useMutation<User, AxiosError, UserCreationData>({
    mutationFn: (newUserData) => api.register(newUserData),
    onSuccess: () => {
      toast({ title: "Usuario creado", description: "El nuevo usuario ha sido registrado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      closeForm();
    },
    onError: (err: AxiosError) => {
      console.error("Error al crear usuario:", err.response?.data || err.message);
      setFormErrors((err.response?.data as Record<string, string | string[]>) || { general: err.message });
      const errorMessage = (err.response?.data as any)?.detail || (err.response?.data as any)?.role?.[0] || (err.response?.data as any)?.email?.[0] || (err.response?.data as any)?.username?.[0] || "No se pudo crear el usuario. Verifica los datos.";
      toast({ variant: "destructive", title: "Error al crear usuario", description: errorMessage });
    },
    onSettled: () => setIsSaving(false), 
  });

  const updateUserMutation = useMutation<User, AxiosError, { id: number; userData: UserUpdateData }>({
    mutationFn: ({ id, userData }) => api.adminUpdateUsuario(id, userData),
    onSuccess: (updatedUser) => {
      toast({ title: "Usuario actualizado", description: "La información del usuario ha sido guardada exitosamente." });
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', updatedUser.id] }); 
      closeForm();
      setEditingUser(null);
    },
    onError: (err: AxiosError) => {
      console.error("Error al actualizar usuario:", err.response?.data || err.message);
      setFormErrors((err.response?.data as Record<string, string | string[]>) || { general: err.message });
      const errorMessage = (err.response?.data as any)?.detail || (err.response?.data as any)?.role?.[0] || "No se pudo actualizar el usuario. Verifica los datos.";
      toast({ variant: "destructive", title: "Error al actualizar usuario", description: errorMessage });
    },
    onSettled: () => setIsSaving(false), 
  });

  const deleteUserMutation = useMutation<void, AxiosError, number>({
    mutationFn: (id) => api.deleteUsuario(id),
    onSuccess: () => {
      toast({ title: "Usuario eliminado", description: "El usuario ha sido eliminado exitosamente." });
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
    },
    onError: (err: AxiosError) => {
      console.error("Error al eliminar usuario:", err.response?.data || err.message);
      const errorMessage = (err.response?.data as any)?.detail || "No se pudo eliminar el usuario.";
      toast({ variant: "destructive", title: "Error al eliminar usuario", description: errorMessage });
    },
    onSettled: () => {
      setConfirmDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }
  });

  const closeForm = useCallback((): void => {
    setIsFormOpen(false);
    setEditingUser(null);
    setFormErrors({});
    setIsSaving(false);
    setFormData({
      username: '', email: '', first_name: '', last_name: '', password: '', password2: '',
      role: null, 
      telefono: '', ci: '', direccion: '', empresa: null, 
      is_active: true,
      is_staff: false,
      is_superuser: false,
      empresa_nombre: '', empresa_nit: '', suscripcion_id: undefined,
    });
  }, []);

  const openForm = useCallback((user?: User): void => {
    setFormErrors({});

    let defaultRoleId: number | null = null;
    let defaultEmpresaId: number | null = null;

    if (allRoles.length > 0) {
      const clienteRole = allRoles.find(r => r.name === 'Cliente');
      if (clienteRole) {
        defaultRoleId = clienteRole.id;
      }
      
      if (isAdministrativoLogueado && currentUser?.empresa !== undefined && currentUser.empresa !== null) {
        defaultEmpresaId = currentUser.empresa; 
        const empleadoRole = allRoles.find(r => r.name === 'Empleado');
        if (empleadoRole) {
          defaultRoleId = empleadoRole.id;
        }
      } 
    }

    if (user) {
      setEditingUser(user);
      setFormData({
        id: user.id, username: user.username, email: user.email, first_name: user.first_name,
        last_name: user.last_name, 
        role: user.role?.id || null, 
        telefono: user.telefono || '',
        ci: user.ci || '', direccion: user.direccion || '', 
        empresa: user.empresa || null, 
        is_active: user.is_active, 
        is_staff: user.is_staff,
        is_superuser: user.is_superuser,
        password: '', 
        password2: '',
        empresa_nombre: '', 
        empresa_nit: '',
        suscripcion_id: undefined,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '', email: '', first_name: '', last_name: '',
        password: '', password2: '',
        role: defaultRoleId, 
        telefono: '', ci: '', direccion: '',
        empresa: defaultEmpresaId, 
        empresa_nombre: '', empresa_nit: '', suscripcion_id: undefined,
        is_active: true, 
        is_staff: false,
        is_superuser: false,
      });
    }
    setIsFormOpen(true);
  }, [allRoles, isAdministrativoLogueado, currentUser?.empresa]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    const checked = target.checked;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    setFormErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSelectChange = (name: string, value: string) => {
    if (value === '' || value === 'empty_select_option' || value === 'loading_companies' || value === 'loading_roles' || value === 'loading_plans_option' || value === 'no_roles' || value === 'no_companies' || value === 'no_plans_option') {
      setFormData(prev => ({ ...prev, [name]: null })); 
    } else {
      setFormData(prev => ({ ...prev, [name]: parseInt(value, 10) }));
    }
    setFormErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSwitchChange = (checked: boolean, name: string) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true); 
    setFormErrors({}); 

    let currentErrors: Record<string, string | string[]> = {};

    if (!formData.first_name?.trim()) currentErrors.first_name = "El nombre es requerido.";
    if (!formData.last_name?.trim()) currentErrors.last_name = "El apellido es requerido.";
    if (!formData.ci?.trim()) currentErrors.ci = "El C.I. / Identificación es requerido.";
    if (formData.role === null) currentErrors.role = "El rol es requerido.";

    if (!editingUser) { 
      if (!formData.username?.trim()) currentErrors.username = "El usuario es requerido.";
      if (!formData.email?.trim()) currentErrors.email = "El email es requerido.";
      if (!formData.password?.trim()) currentErrors.password = "La contraseña es requerida.";
      if (!formData.password2?.trim()) currentErrors.password2 = "La confirmación de contraseña es requerida.";
      if (formData.password !== formData.password2) {
        currentErrors.password = "Las contraseñas no coinciden.";
        currentErrors.password2 = "Las contraseñas no coinciden.";
      }
    } else { 
      if ((formData.password?.trim() || formData.password2?.trim())) { 
        if (formData.password !== formData.password2) {
          currentErrors.password = "Las nuevas contraseñas deben coincidir.";
          currentErrors.password2 = "Las nuevas contraseñas deben coincidir.";
        }
      }
    }

    const selectedRoleNameForValidation = allRoles.find(r => r.id === formData.role)?.name;

    if (selectedRoleNameForValidation === 'Administrador' && isSuperUser && !editingUser) { 
      if (!formData.empresa_nombre?.trim() || !formData.empresa_nit?.trim() || !formData.suscripcion_id) {
        currentErrors.empresa_data = "Nombre de empresa, NIT y plan de suscripción son requeridos para crear una nueva empresa junto con un Administrador.";
      }
      formData.empresa = null; 
    } else if (selectedRoleNameForValidation && selectedRoleNameForValidation !== 'Super Usuario') { 
      if (formData.empresa === undefined || formData.empresa === null) {
        currentErrors.empresa = "Debe seleccionar una empresa para este usuario.";
      }
    } else if (selectedRoleNameForValidation === 'Super Usuario') { 
      formData.empresa = null; 
    }

    if (Object.keys(currentErrors).length > 0) {
      setFormErrors(currentErrors);
      toast({ variant: "destructive", title: "Error de Validación", description: currentErrors.general || "Por favor, corrige los errores en el formulario." });
      setIsSaving(false); 
      return;
    }

    try {
      if (editingUser) {
        if (editingUser.id) {
          const dataToUpdate: UserUpdateData = {
            first_name: formData.first_name || undefined,
            last_name: formData.last_name || undefined,
            telefono: formData.telefono || null,
            ci: formData.ci || undefined,
            direccion: formData.direccion || null,
            role: formData.role, 
            empresa: formData.empresa,
            is_active: formData.is_active,
            is_staff: formData.is_staff,
            is_superuser: formData.is_superuser,
          };

          if (formData.password?.trim()) { 
            dataToUpdate.password = formData.password;
            dataToUpdate.password2 = formData.password2;
          }

          await updateUserMutation.mutateAsync({ id: editingUser.id, userData: dataToUpdate });
        } else {
          toast({ variant: "destructive", title: "Error", description: "ID de usuario para actualizar no encontrado." });
          setIsSaving(false); 
        }
      } else {
        const dataToCreate: UserCreationData = {
          username: formData.username!,
          email: formData.email!,
          first_name: formData.first_name!,
          last_name: formData.last_name!,
          ci: formData.ci!,
          password: formData.password!,
          password2: formData.password2!,
          role: formData.role,
          telefono: formData.telefono || null,
          direccion: formData.direccion || null,
          empresa: formData.empresa,
          ...(selectedRoleNameForValidation === 'Administrador' && isSuperUser && {
            empresa_nombre: formData.empresa_nombre!,
            empresa_nit: formData.empresa_nit!,
            suscripcion_id: formData.suscripcion_id!,
          }),
        };
        await createUserMutation.mutateAsync(dataToCreate);
      }
    } catch (error) {
      // Errors are handled by onError callbacks of mutations
    }
  };

  const filteredUsers = useMemo(() => {
    if (!users || users.length === 0) {
      return [];
    }

    let currentFilteredUsers = users;

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentFilteredUsers = currentFilteredUsers.filter(user =>
        user.username.toLowerCase().includes(lowerCaseSearchTerm) ||
        user.first_name?.toLowerCase().includes(lowerCaseSearchTerm) ||
        user.last_name?.toLowerCase().includes(lowerCaseSearchTerm) ||
        user.email?.toLowerCase().includes(lowerCaseSearchTerm) ||
        user.ci?.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    if (selectedRoleFilter && selectedRoleFilter !== 'ALL') {
      currentFilteredUsers = currentFilteredUsers.filter(user =>
        user.role?.name === selectedRoleFilter 
      );
    }

    return currentFilteredUsers;
  }, [users, searchTerm, selectedRoleFilter]); 

  const handleDeleteClick = (userId: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirmar Eliminación',
      description: `¿Estás seguro de que quieres eliminar a este usuario? Esta acción no se puede deshacer.`,
      onConfirm: () => {
        deleteUserMutation.mutate(userId);
      },
      onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
      isLoading: deleteUserMutation.isPending,
    });
  };

  const handleSearchClick = () => {
    setSearchTerm(searchInputValue);
  };

  const getRoleDisplayName = (role: Role | null | undefined): string => {
    return role?.name || 'N/A'; 
  };

  const getBadgeVariantForRole = (roleName: string | undefined): "default" | "secondary" | "outline" | "destructive" => {
    switch (roleName as UserRoleName) { // Casteo explícito aquí, aunque si UserRoleName está bien, no debería ser necesario.
      case 'Super Usuario': return 'default'; 
      case 'Administrador': return 'secondary';
      case 'Empleado': return 'outline';
      case 'Cliente': return 'outline';
      default: return 'outline';
    }
  };

  const formatDisplayDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      };
      return date.toLocaleString('es-ES', options);
    } catch (e) {
      console.error("Error al formatear fecha:", dateString, e);
      return 'Fecha inválida';
    }
  };

  const roleFilterOptions = useMemo(() => {
    const options = allRoles.map(role => ({
      value: role.name, 
      label: role.name,
    }));
    return [{ value: 'ALL', label: 'Todos los roles' }, ...options];
  }, [allRoles]);

  const rolesForForm = useMemo(() => {
    if (isSuperUser) {
        return allRoles; 
    } else if (isAdministrativoLogueado) {
        return allRoles.filter(role => 
          role.name === 'Empleado' || 
          role.name === 'Cliente'
        );
    }
    return []; 
  }, [isSuperUser, isAdministrativoLogueado, allRoles]);


  const canManageUsers = isSuperUser || isAdministrativoLogueado;

  if (!canManageUsers) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-background text-destructive">
        <AlertTriangle className="h-12 w-12 mb-2" />
        <h3 className="text-lg font-medium text-destructive-foreground">Acceso Denegado</h3>
        <p className="text-muted-foreground">No tienes permiso para gestionar usuarios.</p>
        <Link to="/dashboard">
          <Button variant="link" className="mt-4 text-primary">Volver al Dashboard</Button>
        </Link>
      </div>
    );
  }

  const areInitialDataLoading = isLoadingUsers || isLoadingAllRoles || (isSuperUser && isLoadingEmpresas);
  const isSuscripcionesLoadingForAdminRole = isSuperUser && isFormOpen && !editingUser && (selectedRoleName === 'Administrador') && isLoadingSuscripciones;

  if (areInitialDataLoading || isSuscripcionesLoadingForAdminRole) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Cargando usuarios y datos relacionados...</p>
      </div>
    );
  }

  if (usersError || errorAllRoles) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudieron cargar los usuarios o los roles: {usersError?.message || errorAllRoles?.message || 'Error desconocido.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-background text-foreground min-h-screen-minus-header">
      <Card className="shadow-2xl border border-border bg-card text-card-foreground">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-2xl font-bold">Gestión de Usuarios</CardTitle>
            <CardDescription>Administra los usuarios del sistema.</CardDescription>
          </div>
          <Button onClick={() => openForm()} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Usuario
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="relative flex-grow w-full sm:w-auto">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuarios por nombre de usuario, nombre, apellido, email o CI..."
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                className="w-full pl-10 bg-input border-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchClick();
                  }
                }}
              />
            </div>
            <Button onClick={handleSearchClick} className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm rounded-md px-4 py-2 w-full sm:w-auto">
              Buscar
            </Button>
            <Select
              value={selectedRoleFilter}
              onValueChange={(value) => setSelectedRoleFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-[180px] bg-input border-input">
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground">
                {roleFilterOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader className="bg-muted text-muted-foreground">
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                  <TableHead>Último Login</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No se encontraron usuarios.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="border-border hover:bg-background/50">
                      <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariantForRole(user.role?.name)}> 
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.empresa_detail?.nombre || 'N/A'}</TableCell>
                      <TableCell>{formatDisplayDate(user.date_joined)}</TableCell>
                      <TableCell>{formatDisplayDate(user.last_login)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openForm(user)}
                          className="mr-2 text-blue-600 hover:bg-blue-50"
                          disabled={user.is_superuser && !isSuperUser} 
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(user.id)}
                          className="text-red-600 hover:bg-red-50"
                          disabled={user.is_superuser || user.id === currentUser?.id || deleteUserMutation.isPending}
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

      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="sm:max-w-[425px] md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto p-4 pb-4 shadow-2xl border border-border bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Modifica los datos del usuario.' : 'Introduce los datos para crear un nuevo usuario.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1">
                  <Label htmlFor="first_name" className="text-left">Nombre</Label>
                  <Input id="first_name" name="first_name" value={formData.first_name || ''} onChange={handleInputChange} required className="bg-input border-input" />
                  {formErrors.first_name && <p className="text-destructive text-sm mt-1">{formErrors.first_name}</p>}
                </div>
                <div className="col-span-1">
                  <Label htmlFor="last_name" className="text-left">Apellido</Label>
                  <Input id="last_name" name="last_name" value={formData.last_name || ''} onChange={handleInputChange} required className="bg-input border-input" />
                  {formErrors.last_name && <p className="text-destructive text-sm mt-1">{formErrors.last_name}</p>}
                </div>
                <div className="col-span-1">
                  <Label htmlFor="username" className="text-left">Usuario</Label>
                  <Input id="username" name="username" value={formData.username || ''} onChange={handleInputChange} required={!editingUser} disabled={!!editingUser} className="bg-input border-input" />
                  {formErrors.username && <p className="text-destructive text-sm mt-1">{formErrors.username}</p>}
                </div>
                <div className="col-span-1">
                  <Label htmlFor="email" className="text-left">Email</Label>
                  <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleInputChange} required={!editingUser} disabled={!!editingUser} className="bg-input border-input" />
                  {formErrors.email && <p className="text-destructive text-sm mt-1">{formErrors.email}</p>}
                </div>
                <div className="col-span-1">
                  <Label htmlFor="ci" className="text-left">C.I. / Identificación</Label>
                  <Input id="ci" name="ci" value={formData.ci || ''} onChange={handleInputChange} required className="bg-input border-input" />
                  {formErrors.ci && <p className="text-destructive text-sm mt-1">{formErrors.ci}</p>}
                </div>
                <div className="col-span-1">
                  <Label htmlFor="telefono" className="text-left">Teléfono</Label>
                  <Input id="telefono" name="telefono" value={formData.telefono || ''} onChange={handleInputChange} className="bg-input border-input" />
                  {formErrors.telefono && <p className="text-destructive text-sm mt-1">{formErrors.telefono}</p>}
                </div>
                <div className="col-span-full">
                  <Label htmlFor="direccion" className="text-left">Dirección</Label>
                  <Input id="direccion" name="direccion" value={formData.direccion || ''} onChange={handleInputChange} className="bg-input border-input" />
                  {formErrors.direccion && <p className="text-destructive text-sm mt-1">{formErrors.direccion}</p>}
                </div>

                {/* Selector de Rol (Ahora con IDs de Roles) */}
                <div className="col-span-1">
                  <Label htmlFor="role" className="text-left">Rol</Label>
                  <Select
                    value={formData.role?.toString() || ''} 
                    onValueChange={(value) => handleSelectChange('role', value)}
                    disabled={(editingUser && editingUser.is_superuser && !isSuperUser) || isLoadingAllRoles || allRoles.length === 0}
                  >
                    <SelectTrigger className="w-full bg-input border-input">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground">
                      {isLoadingAllRoles ? (
                        <SelectItem value="loading_roles" disabled>Cargando roles...</SelectItem>
                      ) : (
                        rolesForForm.length > 0 ? (
                          rolesForForm.map(role => (
                            <SelectItem key={role.id} value={role.id.toString()}>
                              {role.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no_roles" disabled>No hay roles disponibles</SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  {formErrors.role && <p className="text-destructive text-sm mt-1">{formErrors.role}</p>}
                </div>

                {/* Selector de Empresa para SuperUsuarios o si el rol seleccionado NO es Super Usuario */}
                {(isSuperUser || (isAdministrativoLogueado && editingUser?.empresa === currentUser?.empresa)) &&
                 // Aquí selectedRoleName debería ser de tipo UserRoleName (o string en general)
                 // Si el error persiste AÚN después de verificar rbac.ts y reiniciar, puedes forzar el tipo así:
                 // (selectedRoleName as UserRoleName) !== 'Super Usuario'
                 selectedRoleName !== 'Super Usuario' && ( 
                  <div className="col-span-1">
                    <Label htmlFor="empresa" className="text-left">Empresa</Label>
                    <Select
                      value={formData.empresa?.toString() || ''}
                      onValueChange={(value) => handleSelectChange('empresa', value)}
                      disabled={isLoadingEmpresas || empresas.length === 0 || (isAdministrativoLogueado && editingUser && editingUser.empresa !== currentUser?.empresa)}
                      required={(selectedRoleName as string) !== 'Super Usuario' && (selectedRoleName as string) !== 'Administrador'} // Aquí también
                    >
                      <SelectTrigger className="w-full bg-input border-input">
                        <SelectValue placeholder="Selecciona una empresa" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover text-popover-foreground">
                        {isLoadingEmpresas ? (
                          <SelectItem value="loading_companies" disabled>Cargando empresas...</SelectItem>
                        ) : (
                          empresas.length > 0 ? (
                            empresas.map(empresa => (
                              <SelectItem key={empresa.id} value={empresa.id.toString()}>
                                {empresa.nombre}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no_companies" disabled>No hay empresas disponibles</SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    {formErrors.empresa && <p className="text-destructive text-sm mt-1">{formErrors.empresa}</p>}
                  </div>
                )}
                 
                 {/* Campos para nueva empresa (Solo si es SuperUsuario, creando NUEVO usuario Admin) */}
                 {isSuperUser && !editingUser && selectedRoleName === 'Administrador' && (
                  <>
                    <h5 className="col-span-full text-lg font-semibold text-center mt-4 border-b pb-2 text-primary">Crear Nueva Empresa (para Admin)</h5>
                    <div className="col-span-1">
                      <Label htmlFor="empresa_nombre" className="text-left">Nombre de Nueva Empresa</Label>
                      <Input 
                        id="empresa_nombre" 
                        name="empresa_nombre" 
                        value={formData.empresa_nombre || ''} 
                        onChange={handleInputChange} 
                        required 
                        className="bg-input border-input" 
                      />
                      {formErrors.empresa_nombre && <p className="text-destructive text-sm mt-1">{formErrors.empresa_nombre}</p>}
                    </div>
                    <div className="col-span-1">
                      <Label htmlFor="empresa_nit" className="text-left">NIT/RUC de Nueva Empresa</Label>
                      <Input 
                        id="empresa_nit" 
                        name="empresa_nit" 
                        value={formData.empresa_nit || ''} 
                        onChange={handleInputChange} 
                        required 
                        className="bg-input border-input" 
                      />
                      {formErrors.empresa_nit && <p className="text-destructive text-sm mt-1">{formErrors.empresa_nit}</p>}
                    </div>
                    <div className="col-span-full">
                      <Label htmlFor="suscripcion_id" className="text-left">Plan de Suscripción (para Nueva Empresa)</Label>
                      <Select
                        value={formData.suscripcion_id?.toString() || ''}
                        onValueChange={(value) => handleSelectChange('suscripcion_id', value)}
                        disabled={isLoadingSuscripciones || suscripciones.length === 0}
                        required
                      >
                        <SelectTrigger className="w-full bg-input border-input">
                          <SelectValue placeholder="Selecciona un plan de suscripción" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover text-popover-foreground">
                          {isLoadingSuscripciones ? (
                            <SelectItem value="loading_plans_option" disabled>Cargando planes...</SelectItem>
                          ) : (
                            suscripciones.length > 0 ? (
                              suscripciones.map(plan => (
                                <SelectItem key={plan.id} value={plan.id.toString()}>
                                  {plan.nombre} (ID: {plan.id})
                              </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="no_plans_option" disabled>No hay planes disponibles</SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      {formErrors.suscripcion_id && <p className="text-destructive text-sm mt-1">{formErrors.suscripcion_id}</p>}
                      {suscripciones.length === 0 && !isLoadingSuscripciones && (
                        <p className="text-muted-foreground text-sm mt-1">No hay planes de suscripción disponibles. Asegúrate de crear al menos uno en la sección de Suscripciones.</p>
                      )}
                    </div>
                  </>
                 )}

                {/* Campos de Contraseña (solo si es nuevo usuario o se están cambiando) */}
                {!editingUser || (formData.password?.trim() || formData.password2?.trim()) ? (
                  <>
                    <div className="col-span-1">
                      <Label htmlFor="password" className="text-left">Contraseña</Label>
                      <Input id="password" name="password" type="password" value={formData.password || ''} onChange={handleInputChange} required={!editingUser} className="bg-input border-input" />
                      {formErrors.password && <p className="text-destructive text-sm mt-1">{formErrors.password}</p>}
                    </div>
                    <div className="col-span-1">
                      <Label htmlFor="password2" className="text-left">Confirmar Contraseña</Label>
                      <Input id="password2" name="password2" type="password" value={formData.password2 || ''} onChange={handleInputChange} required={!editingUser} className="bg-input border-input" />
                      {formErrors.password2 && <p className="text-destructive text-sm mt-1">{formErrors.password2}</p>}
                    </div>
                  </>
                ) : (
                  <div className="col-span-full text-center text-muted-foreground mt-4">
                    Deja las contraseñas en blanco para no cambiarlas.
                  </div>
                )}
                
                {/* Opciones de Staff y Superuser (solo para Superusuario) */}
                {isSuperUser && (
                  <>
                    <div className="col-span-1 flex items-center space-x-2">
                      <Switch 
                        id="is_active" 
                        name="is_active" 
                        checked={formData.is_active} 
                        onCheckedChange={(checked) => handleSwitchChange(checked, 'is_active')} 
                        disabled={isSaving}
                      />
                      <Label htmlFor="is_active">Activo</Label>
                    </div>
                    <div className="col-span-1 flex items-center space-x-2">
                      <Switch 
                        id="is_staff" 
                        name="is_staff" 
                        checked={formData.is_staff} 
                        onCheckedChange={(checked) => handleSwitchChange(checked, 'is_staff')} 
                        disabled={isSaving}
                      />
                      <Label htmlFor="is_staff">Es Staff</Label>
                    </div>
                    <div className="col-span-1 flex items-center space-x-2">
                      <Switch 
                        id="is_superuser" 
                        name="is_superuser" 
                        checked={formData.is_superuser} 
                        onCheckedChange={(checked) => handleSwitchChange(checked, 'is_superuser')} 
                        disabled={isSaving || (editingUser && editingUser.id === currentUser?.id)} 
                      />
                      <Label htmlFor="is_superuser">Es Superusuario</Label>
                    </div>
                  </>
                )}

                {formErrors.general && <p className="col-span-full text-destructive text-sm text-center">{formErrors.general}</p>}
            </div>

            <DialogFooter className="pt-4 flex-col sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  editingUser ? 'Guardar Cambios' : 'Crear Usuario'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDialog.isOpen} onOpenChange={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={confirmDialog.onCancel} disabled={confirmDialog.isLoading}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={confirmDialog.onConfirm} disabled={confirmDialog.isLoading}>
                {confirmDialog.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GestionarUsuario;
