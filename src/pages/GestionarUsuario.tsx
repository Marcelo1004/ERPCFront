import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { User, UserRegistrationData, PaginatedResponse, FilterParams, Empresa } from '@/types/auth';
import { Suscripcion } from '@/types/suscripciones';
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
import { Loader2, PlusCircle, Edit, Trash2, Search, Building } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AxiosError } from 'axios';

// Define los roles para usuarios de empresa
const EMPRESA_USER_ROLES = [
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'EMPLEADO', label: 'Empleado' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
];

// Define los roles que un SuperUsuario puede crear
const SUPERUSER_CREATE_ROLES = [
  ...EMPRESA_USER_ROLES,
  { value: 'SUPERUSER', label: 'Super Usuario' },
];

const GestionarUsuario: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<UserRegistrationData & { id?: number }>>({
    username: '', email: '', first_name: '', last_name: '', password: '', password2: '',
    role: 'CLIENTE', telefono: '', ci: '', direccion: '', empresa: undefined,
    empresa_nombre: '', empresa_nit: '', suscripcion_id: undefined,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string | string[]>>({});
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  // Nuevo estado para el filtro de rol
  const [selectedRoleFilter, setSelectedRoleFilter] = useState(''); // "" para "Todos los roles"

  const isSuperUser = currentUser?.is_superuser;
  const isAdministrativo = currentUser?.role === 'ADMINISTRATIVO';

  useEffect(() => {
    if (isFormOpen && !editingUser) {
      if (isAdministrativo && currentUser?.empresa !== undefined && currentUser.empresa !== null) {
        setFormData(prev => ({
          ...prev,
          empresa: currentUser.empresa,
          role: 'EMPLEADO'
        }));
      } else if (isSuperUser) {
        setFormData(prev => ({ ...prev, role: 'CLIENTE' }));
      }
    }
  }, [isFormOpen, editingUser, isAdministrativo, isSuperUser, currentUser?.empresa]);

  // Obtener la lista de usuarios
  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useQuery<PaginatedResponse<User>, Error>({
    // Añadimos selectedRoleFilter al queryKey para refetch si cambia
    queryKey: ['usersList', searchTerm, currentUser?.empresa, currentUser?.is_superuser, selectedRoleFilter],
    queryFn: ({ queryKey }) => {
      const [_key, currentSearchTerm, empresaId, isSuperuser, roleFilter] = queryKey;
      const filters: FilterParams = { search: currentSearchTerm as string || '' };

      if (!isSuperuser && empresaId) {
        filters.empresa = empresaId as number;
      }
      // Añadir el filtro de rol si está seleccionado
      if (roleFilter && roleFilter !== 'ALL') {
        filters.role = roleFilter as string;
      }
      return api.fetchUsuarios(filters);
    },
    enabled: !!currentUser?.id,
  });
  const users = usersData?.results || [];

  const { data: suscripcionesData, isLoading: isLoadingSuscripciones } = useQuery<PaginatedResponse<Suscripcion>, Error>({
    queryKey: ['suscripciones'],
    queryFn: () => api.fetchSuscripciones(),
    enabled: isSuperUser && (isFormOpen && !editingUser),
  });
  const suscripciones = suscripcionesData?.results || [];

  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery<PaginatedResponse<Empresa>, Error>({
    queryKey: ['empresasListForUserForm'],
    queryFn: () => api.fetchEmpresas(),
    enabled: isSuperUser && isFormOpen,
  });
  const empresas = empresasData?.results || [];

  const createUserMutation = useMutation<User, AxiosError, UserRegistrationData>({
    mutationFn: (newUserData) => api.createUsuario(newUserData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      toast({ title: "Usuario creado", description: "El nuevo usuario ha sido registrado exitosamente." });
      closeForm();
    },
    onError: (err: AxiosError) => {
      console.error("Error al crear usuario:", err.response?.data || err.message);
      setFormErrors((err.response?.data as Record<string, string | string[]>) || {});
      const errorMessage = (err.response?.data as any)?.detail || (err.response?.data as any)?.role?.[0] || "No se pudo crear el usuario. Verifica los datos.";
      toast({ variant: "destructive", title: "Error al crear usuario", description: errorMessage });
    },
  });

  const updateUserMutation = useMutation<User, AxiosError, { id: number; userData: Partial<User> }>({
    mutationFn: ({ id, userData }) => api.adminUpdateUsuario(id, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      toast({ title: "Usuario actualizado", description: "La información del usuario ha sido guardada exitosamente." });
      closeForm();
      setEditingUser(null);
    },
    onError: (err: AxiosError) => {
      console.error("Error al actualizar usuario:", err.response?.data || err.message);
      setFormErrors((err.response?.data as Record<string, string | string[]>) || {});
      const errorMessage = (err.response?.data as any)?.detail || (err.response?.data as any)?.role?.[0] || "No se pudo actualizar el usuario. Verifica los datos.";
      toast({ variant: "destructive", title: "Error al actualizar usuario", description: errorMessage });
    },
  });

  const deleteUserMutation = useMutation<void, AxiosError, number>({
    mutationFn: (id) => api.deleteUsuario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usersList'] });
      toast({ title: "Usuario eliminado", description: "El usuario ha sido eliminado exitosamente." });
    },
    onError: (err: AxiosError) => {
      console.error("Error al eliminar usuario:", err.response?.data || err.message);
      const errorMessage = (err.response?.data as any)?.detail || "No se pudo eliminar el usuario.";
      toast({ variant: "destructive", title: "Error al eliminar usuario", description: errorMessage });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    if (name === 'empresa' || name === 'suscripcion_id') {
      setFormData(prev => ({ ...prev, [name]: value === '' ? null : parseInt(value, 10) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const openForm = (user?: User) => {
    setFormErrors({});
    if (user) {
      setEditingUser(user);
      setFormData({
        id: user.id, username: user.username, email: user.email, first_name: user.first_name,
        last_name: user.last_name, role: user.role, telefono: user.telefono || '',
        ci: user.ci || '', direccion: user.direccion || '', empresa: user.empresa || undefined,
        password: '', password2: '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '', email: '', first_name: '', last_name: '',
        password: '', password2: '',
        role: (isAdministrativo || isSuperUser) ? 'EMPLEADO' : 'CLIENTE',
        telefono: '', ci: '', direccion: '',
        empresa: (isAdministrativo && currentUser?.empresa !== undefined && currentUser.empresa !== null) ? currentUser.empresa : undefined,
        empresa_nombre: '', empresa_nit: '', suscripcion_id: undefined,
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
    setFormData({});
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setFormErrors({});

    if (!formData.username || !formData.email || !formData.first_name || !formData.last_name || !formData.ci || !formData.role) {
      toast({ variant: "destructive", title: "Error de Validación", description: "Por favor, completa todos los campos requeridos." });
      return;
    }

    if (!editingUser) {
      if (!formData.password || !formData.password2 || formData.password !== formData.password2) {
        setFormErrors(prev => ({ ...prev, password: "Las contraseñas no coinciden o están vacías." }));
        toast({ variant: "destructive", title: "Error de Validación", description: "Las contraseñas no coinciden o están vacías." });
        return;
      }

      const dataToCreate: UserRegistrationData = {
        username: formData.username, email: formData.email, first_name: formData.first_name,
        last_name: formData.last_name, password: formData.password, password2: formData.password2,
        role: formData.role, telefono: formData.telefono || null, ci: formData.ci || null,
        direccion: formData.direccion || null,
      };

      if (isSuperUser) {
        if (formData.role === 'ADMINISTRATIVO' && formData.empresa_nombre && formData.empresa_nit && formData.suscripcion_id) {
          dataToCreate.empresa_nombre = formData.empresa_nombre;
          dataToCreate.empresa_nit = formData.empresa_nit;
          dataToCreate.suscripcion_id = formData.suscripcion_id;
        } else if (formData.role !== 'SUPERUSER') {
            if (formData.empresa === undefined || formData.empresa === null) {
                setFormErrors(prev => ({ ...prev, empresa: "Debe seleccionar una empresa para este usuario." }));
                toast({ variant: "destructive", title: "Error de Validación", description: "Por favor, selecciona una empresa para este usuario que no es Super Usuario." });
                return;
            }
            dataToCreate.empresa = formData.empresa;
        }
      } else if (isAdministrativo) {
        if (currentUser?.empresa !== undefined && currentUser.empresa !== null) {
          dataToCreate.empresa = currentUser.empresa;
        } else {
          toast({ variant: "destructive", title: "Error", description: "La cuenta de administrador no está vinculada a una empresa. No se pueden crear usuarios de empresa." });
          return;
        }
      }

      createUserMutation.mutate(dataToCreate);

    } else {
      const dataToUpdate: Partial<User> = {
        first_name: formData.first_name, last_name: formData.last_name,
        telefono: formData.telefono, ci: formData.ci, direccion: formData.direccion,
        role: formData.role,
      };

      if (formData.password || formData.password2) {
        if (!formData.password || !formData.password2 || formData.password !== formData.password2) {
          setFormErrors(prev => ({ ...prev, password: "Las nuevas contraseñas deben coincidir y no estar vacías." }));
          toast({ variant: "destructive", title: "Error de Validación", description: "Las nuevas contraseñas deben coincidir y no estar vacías." });
          return;
        }
        (dataToUpdate as any).password = formData.password;
      }

      if (isSuperUser) {
        dataToUpdate.empresa = formData.empresa;
      }

      if (editingUser.id) {
        updateUserMutation.mutate({ id: editingUser.id, userData: dataToUpdate });
      } else {
        toast({ variant: "destructive", title: "Error", description: "ID de usuario para actualizar no encontrado." });
      }
    }
  };

  // Usuarios filtrados. APLICAMOS FILTRO CLIENT-SIDE ADICIONAL POR NOMBRE DE USUARIO
  const filteredUsers = useMemo(() => {
    // Si no hay usuarios o el término de búsqueda y el filtro de rol están vacíos, devuelve la lista original.
    if (!users || users.length === 0) {
      return [];
    }

    let currentFilteredUsers = users;

    // Filtro por término de búsqueda (nombre de usuario)
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentFilteredUsers = currentFilteredUsers.filter(user =>
        user.username.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Filtro por rol seleccionado
    if (selectedRoleFilter && selectedRoleFilter !== 'ALL') {
      currentFilteredUsers = currentFilteredUsers.filter(user =>
        user.role === selectedRoleFilter
      );
    }

    return currentFilteredUsers;
  }, [users, searchTerm, selectedRoleFilter]); // Dependencias para el useMemo

  const handleDelete = (userId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleSearchClick = () => {
    setSearchTerm(searchInputValue);
  };

  const getRoleInSpanish = (role: string) => {
    switch (role) {
      case 'CLIENTE': return 'Cliente';
      case 'SUPERUSER': return 'Super Usuario';
      case 'ADMINISTRATIVO': return 'Administrativo';
      case 'EMPLEADO': return 'Empleado';
      default: return role;
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      // Opciones para asegurar que se muestre el año, mes, día y hora.
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

  if (isLoadingUsers) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando usuarios...</p>
      </div>
    );
  }

  if (usersError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudieron cargar los usuarios: {usersError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-2xl border border-indigo-100">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Gestión de Usuarios</CardTitle>
            <CardDescription>Administra los usuarios del sistema.</CardDescription>
          </div>
          <Button onClick={() => openForm()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
            <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Usuario
          </Button>
        </CardHeader>
        <CardContent>
          {/* Contenedor flex para alinear el input de búsqueda y el filtro de rol */}
          <div className="mb-4 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="relative flex-grow w-full sm:w-auto">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar usuarios por nombre de usuario..."
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                className="w-full pl-10"
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
            {/* Selector de filtro por rol */}
            <Select
              value={selectedRoleFilter}
              onValueChange={(value) => setSelectedRoleFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los roles</SelectItem>
                {(isSuperUser ? SUPERUSER_CREATE_ROLES : EMPRESA_USER_ROLES).map(role => (
                  <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                  <TableHead>Último Login</TableHead> {/* Asegurado que el campo existe */}
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                      No se encontraron usuarios.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.first_name} {user.last_name}</TableCell>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={
                          user.role === 'SUPERUSER' ? 'default' :
                          user.role === 'ADMINISTRATIVO' ? 'secondary' :
                          user.role === 'EMPLEADO' ? 'outline' : 'outline'
                        }>
                          {getRoleInSpanish(user.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.empresa_detail?.nombre || 'N/A'}</TableCell>
                      <TableCell>{formatDate(user.date_joined)}</TableCell>
                      <TableCell>{formatDate(user.last_login)}</TableCell> {/* Usa user.last_login */}
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
                          onClick={() => handleDelete(user.id)}
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
        <DialogContent className="sm:max-w-[425px] md:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto p-4 pb-4 shadow-2xl border border-indigo-200">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
            <DialogDescription>
              {editingUser ? 'Modifica los datos del usuario.' : 'Introduce los datos para crear un nuevo usuario.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1">
                    <Label htmlFor="first_name" className="text-right sm:text-left">Nombre</Label>
                    <Input id="first_name" name="first_name" value={formData.first_name || ''} onChange={handleInputChange} required />
                    {formErrors.first_name && <p className="text-red-500 text-sm mt-1">{formErrors.first_name}</p>}
                </div>
                <div className="col-span-1">
                    <Label htmlFor="last_name" className="text-right sm:text-left">Apellido</Label>
                    <Input id="last_name" name="last_name" value={formData.last_name || ''} onChange={handleInputChange} required />
                    {formErrors.last_name && <p className="text-red-500 text-sm mt-1">{formErrors.last_name}</p>}
                </div>
                <div className="col-span-1">
                    <Label htmlFor="username" className="text-right sm:text-left">Usuario</Label>
                    <Input id="username" name="username" value={formData.username || ''} onChange={handleInputChange} required disabled={!!editingUser} />
                    {formErrors.username && <p className="text-red-500 text-sm mt-1">{formErrors.username}</p>}
                </div>
                <div className="col-span-1">
                    <Label htmlFor="email" className="text-right sm:text-left">Email</Label>
                    <Input id="email" name="email" type="email" value={formData.email || ''} onChange={handleInputChange} required disabled={!!editingUser} />
                    {formErrors.email && <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>}
                </div>
                <div className="col-span-1">
                    <Label htmlFor="ci" className="text-right sm:text-left">C.I. / Identificación</Label>
                    <Input id="ci" name="ci" value={formData.ci || ''} onChange={handleInputChange} required />
                    {formErrors.ci && <p className="text-red-500 text-sm mt-1">{formErrors.ci}</p>}
                </div>
                <div className="col-span-1">
                    <Label htmlFor="telefono" className="text-right sm:text-left">Teléfono</Label>
                    <Input id="telefono" name="telefono" value={formData.telefono || ''} onChange={handleInputChange} />
                    {formErrors.telefono && <p className="text-red-500 text-sm mt-1">{formErrors.telefono}</p>}
                </div>
                <div className="col-span-1">
                    <Label htmlFor="direccion" className="text-right sm:text-left">Dirección</Label>
                    <Input id="direccion" name="direccion" value={formData.direccion || ''} onChange={handleInputChange} />
                    {formErrors.direccion && <p className="text-red-500 text-sm mt-1">{formErrors.direccion}</p>}
                </div>

                <div className="col-span-1">
                  <Label htmlFor="role" className="text-right sm:text-left">Rol</Label>
                  <Select value={formData.role || ''} onValueChange={(value) => handleSelectChange('role', value)} disabled={editingUser && editingUser.is_superuser && !isSuperUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {(isSuperUser ? SUPERUSER_CREATE_ROLES : EMPRESA_USER_ROLES).map(role => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.role && <p className="text-red-500 text-sm mt-1">{formErrors.role}</p>}
                </div>

                {(isSuperUser || isAdministrativo) && (
                  <div className="col-span-1">
                    <Label htmlFor="empresa" className="text-right sm:text-left">Empresa</Label>
                    <Select
                      value={formData.empresa?.toString() || ''}
                      onValueChange={(value) => handleSelectChange('empresa', value)}
                      disabled={isLoadingEmpresas || (isAdministrativo && !isSuperUser)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {isSuperUser && <SelectItem value="empty_select_option">-- Selecciona --</SelectItem>}
                        {isSuperUser && empresas.map(e => (
                          <SelectItem key={e.id} value={e.id.toString()}>{e.nombre}</SelectItem>
                        ))}
                        {isAdministrativo && currentUser?.empresa_detail && (
                          <SelectItem key={currentUser.empresa_detail.id} value={currentUser.empresa_detail.id.toString()}>
                            {currentUser.empresa_detail.nombre} (Tu Empresa)
                          </SelectItem>
                        )}
                        {isLoadingEmpresas && <SelectItem value="loading_companies_option" disabled>Cargando empresas...</SelectItem>}
                      </SelectContent>
                    </Select>
                    {formErrors.empresa && <p className="text-red-500 text-sm mt-1">{formErrors.empresa}</p>}
                  </div>
                )}
            </div>

            {!editingUser && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1">
                  <Label htmlFor="password" className="text-right sm:text-left">Contraseña</Label>
                  <Input id="password" name="password" type="password" value={formData.password || ''} onChange={handleInputChange} required={!editingUser} />
                  {formErrors.password && <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>}
                </div>
                <div className="col-span-1">
                  <Label htmlFor="password2" className="text-right sm:text-left">Confirmar Contraseña</Label>
                  <Input id="password2" name="password2" type="password" value={formData.password2 || ''} onChange={handleInputChange} required={!editingUser} />
                </div>
              </div>
            )}
            {editingUser && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-1">
                  <Label htmlFor="password_edit" className="text-right sm:text-left">Nueva Contraseña</Label>
                  <Input id="password_edit" name="password" type="password" value={formData.password || ''} onChange={handleInputChange} placeholder="Dejar vacío para no cambiar" />
                </div>
                <div className="col-span-1">
                  <Label htmlFor="password2_edit" className="text-right sm:text-left">Confirmar Nueva Contraseña</Label>
                  <Input id="password2_edit" name="password2" type="password" value={formData.password2 || ''} onChange={handleInputChange} />
                </div>
                {formErrors.password && <p className="text-red-500 text-sm mt-1">{formErrors.password}</p>}
              </div>
            )}

            {isSuperUser && !editingUser && (formData.role === 'ADMINISTRATIVO') && (
              <>
                <div className="mt-4 col-span-full">
                  <h4 className="text-lg font-semibold text-gray-800 flex items-center">
                    <Building className="mr-2 h-5 w-5" /> Detalles de Nueva Empresa
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <Label htmlFor="empresa_nombre" className="text-right sm:text-left">Nombre de Empresa</Label>
                    <Input id="empresa_nombre" name="empresa_nombre" value={formData.empresa_nombre || ''} onChange={handleInputChange} required={isSuperUser && !editingUser && formData.role === 'ADMINISTRATIVO' && (!!formData.empresa_nit || !!formData.suscripcion_id)} />
                    {formErrors.empresa_nombre && <p className="text-red-500 text-sm mt-1">{formErrors.empresa_nombre}</p>}
                  </div>
                  <div className="col-span-1">
                    <Label htmlFor="empresa_nit" className="text-right sm:text-left">NIT/RUC de Empresa</Label>
                    <Input id="empresa_nit" name="empresa_nit" value={formData.empresa_nit || ''} onChange={handleInputChange} required={isSuperUser && !editingUser && formData.role === 'ADMINISTRATIVO' && (!!formData.empresa_nombre || !!formData.suscripcion_id)} />
                    {formErrors.empresa_nit && <p className="text-red-500 text-sm mt-1">{formErrors.empresa_nit}</p>}
                  </div>
                  <div className="col-span-1">
                    <Label htmlFor="suscripcion_id" className="text-right sm:text-left">Plan de Suscripción</Label>
                    <Select value={formData.suscripcion_id?.toString() || ''} onValueChange={(value) => handleSelectChange('suscripcion_id', value)} disabled={isLoadingSuscripciones}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingSuscripciones ? (
                          <SelectItem value="loading_plans_option" disabled>Cargando planes...</SelectItem>
                        ) : (
                          suscripciones.map(s => (<SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>))
                        )}
                      </SelectContent>
                    </Select>
                    {formErrors.suscripcion_id && <p className="text-red-500 text-sm mt-1">{formErrors.suscripcion_id}</p>}
                    {formErrors.empresa_data && <p className="text-red-500 text-sm mt-1">{formErrors.empresa_data}</p>}
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending || updateUserMutation.isPending}>
                {createUserMutation.isPending || updateUserMutation.isPending ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (editingUser ? 'Guardar Cambios' : 'Crear Usuario')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GestionarUsuario;