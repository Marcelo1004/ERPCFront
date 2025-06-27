import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext'; // Ajusta la ruta si es necesario
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api'; // Ajusta la ruta si es necesario
// Importa User, y asegura que UserUpdateData exista y refleje los campos editables
import { User, UserUpdateData } from '@/types/auth'; 
import { UserRoleName, Role } from '@/types/rbac'; // Importa UserRoleName y Role para tipado preciso
import { Empresa } from '@/types/empresas'; // Importa Empresa si profileData.empresa_detail es de este tipo

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import {
  UserCircle, Mail, Phone, MapPin, Briefcase, Loader2, Edit, Building, KeyRound,
  Fingerprint, // Icono para CI
  Calendar, // Icono para Fecha de Registro
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Función de utilidad para obtener iniciales
const getInitials = (firstName?: string | null, lastName?: string | null): string => {
  const first = firstName ? firstName.charAt(0).toUpperCase() : '';
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return `${first}${last}`;
};

// Helper para formatear fechas
const formatDate = (dateString: string | null | undefined) => {
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

// Función auxiliar para obtener el nombre del rol en español
// Asume que profileData.role.name devolverá las cadenas en mayúsculas como CLIENTE, SUPERUSER, etc.
const getRoleInSpanish = (roleName: string | undefined | null) => {
  switch (roleName) {
    case 'CLIENTE': return 'Cliente';
    case 'SUPER_USUARIO': return 'Super Usuario'; // Ajustado según tu backend si usa guion bajo
    case 'ADMINISTRADOR': return 'Administrador'; // Ajustado según tu backend si usa guion bajo
    case 'EMPLEADO': return 'Empleado';
    default: return roleName || 'Desconocido';
  }
};


const Perfil: React.FC = () => {
  const { user: authUser, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  // formData ahora tipado como Partial<UserUpdateData> para más coherencia
  const [formData, setFormData] = useState<Partial<UserUpdateData>>({
    first_name: '',
    last_name: '',
    telefono: '', // Mantenemos 'telefono'
    ci: '',       // Mantenemos 'ci'
    direccion: '',// Mantenemos 'direccion'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string | string[]>>({}); // Tipado mejorado para errores

  // Efecto para inicializar formData cuando authUser o profileData cambian
  useEffect(() => {
    if (authUser && !isEditDialogOpen) { // Solo si no estamos editando activamente
      setFormData({
        first_name: authUser.first_name || '',
        last_name: authUser.last_name || '',
        telefono: authUser.telefono || '',
        ci: authUser.ci || '',
        direccion: authUser.direccion || '',
      });
    }
  }, [authUser, isEditDialogOpen]); // Dependencia del diálogo para no resetear mientras edita

  // Query para obtener los datos del perfil del usuario (desde la API si es necesario)
  const { data: profileData, isLoading, error } = useQuery<User, Error>({
    queryKey: ['userProfile', authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) {
        throw new Error("User not authenticated.");
      }
      return api.fetchUserProfile();
    },
    enabled: !!authUser?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Mutación para actualizar el perfil del usuario
  const updateProfileMutation = useMutation<User, Error, Omit<Partial<UserUpdateData>, 'role'>>({
    mutationFn: (data) => api.updateUserProfile(data), // api.updateUserProfile debería ser un PATCH
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', authUser?.id] });
      setUser(updatedUser); // Actualiza el contexto de autenticación
      toast({ title: "Perfil actualizado", description: "Tu información ha sido guardada exitosamente." });
      setIsEditDialogOpen(false);
      setFormErrors({});
    },
    onError: (err: any) => {
      console.error("Error al actualizar perfil:", err.response?.data || err.message);
      // Asume que los errores del backend vienen en un objeto { campo: ["error"], general: "error" }
      setFormErrors(err.response?.data || { general: err.message || "No se pudo actualizar el perfil. Verifica los datos." });
      toast({ variant: "destructive", title: "Error", description: err.response?.data?.detail || "No se pudo actualizar el perfil. Verifica los datos." });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: undefined })); // Limpia el error específico al cambiar
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({}); // Limpiar todos los errores antes de la validación
    let currentErrors: Record<string, string | string[]> = {};

    // Validaciones básicas de frontend
    if (!formData.first_name?.trim()) currentErrors.first_name = "El nombre es requerido.";
    if (!formData.last_name?.trim()) currentErrors.last_name = "El apellido es requerido.";
    // if (!formData.email?.trim()) currentErrors.email = "El email es requerido.";
    // else if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) currentErrors.email = "Formato de email inválido.";

    if (Object.keys(currentErrors).length > 0) {
      setFormErrors(currentErrors);
      toast({ variant: "destructive", title: "Error de validación", description: "Por favor, corrige los errores en el formulario." });
      return;
    }

    updateProfileMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96 bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando perfil...</p>
      </div>
    );
  }

  // Manejo de errores de carga o datos no disponibles
  if (error || !profileData) {
    return (
      <div className="flex justify-center items-center h-96 bg-gray-50 text-red-600">
        <p>Error al cargar la información del perfil o usuario no encontrado.</p>
      </div>
    );
  }

  // Ruta para imagen de perfil predeterminada si no hay una cargada
  const defaultProfileImage = '../media/profile.png'; 

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-3xl mx-auto shadow-2xl rounded-xl border border-indigo-100 overflow-hidden">
        <CardHeader className="flex flex-col items-center p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <Avatar className="h-32 w-32 mb-6 shadow-md border-2 border-indigo-200">
            <AvatarImage
              src={ `https://api.dicebear.com/7.x/initials/svg?seed=${profileData.first_name} ${profileData.last_name}`}
              alt={profileData?.first_name || "Imagen de perfil"}
              onError={(e) => { e.currentTarget.src = defaultProfileImage; }} // Fallback si la imagen no carga
            />
            <AvatarFallback className="text-4xl font-semibold bg-indigo-500 text-white">
              {getInitials(profileData.first_name, profileData.last_name)}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-3xl font-bold text-gray-900 mb-1">
            {profileData.first_name} {profileData.last_name}
          </CardTitle>
          <CardDescription className="text-lg text-gray-600">@{profileData.username}</CardDescription>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Información de Contacto */}
          <section className="space-y-4 pt-4 border-t border-indigo-100">
            <h4 className="text-xl font-semibold text-gray-800 flex items-center mb-4">
              <Mail className="mr-2 h-5 w-5 text-indigo-600" /> Información de Contacto
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Mail className="h-5 w-5 text-indigo-600" />
                <span className="font-medium">Email:</span> {profileData.email}
              </div>
              {profileData.telefono && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">Teléfono:</span> {profileData.telefono}
                </div>
              )}
              {profileData.direccion && (
                <div className="flex items-center gap-2 text-gray-700 col-span-1 md:col-span-2">
                  <MapPin className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">Dirección:</span> {profileData.direccion}
                </div>
              )}
            </div>
          </section>

          {/* Detalles Personales */}
          <section className="space-y-4 pt-4 border-t border-indigo-100">
            <h4 className="text-xl font-semibold text-gray-800 flex items-center mb-4">
              <UserCircle className="mr-2 h-5 w-5 text-indigo-600" /> Detalles Personales
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profileData.role && ( // Asegura que profileData.role exista
                <div className="flex items-center gap-2 text-gray-700">
                  <Briefcase className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">Rol:</span> {getRoleInSpanish(profileData.role.name)} {/* <--- CORRECCIÓN APLICADA AQUÍ */}
                </div>
              )}
              {profileData.ci && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Fingerprint className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">C.I.:</span> {profileData.ci}
                </div>
              )}
              {profileData.date_joined && (
                <div className="flex items-center gap-2 text-gray-700 col-span-1 md:col-span-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">Fecha de Registro:</span> {formatDate(profileData.date_joined)}
                </div>
              )}
              {profileData.last_login && (
                <div className="flex items-center gap-2 text-gray-700 col-span-1 md:col-span-2">
                  <KeyRound className="h-5 w-5 text-indigo-600" />
                  <span className="font-medium">Último Login:</span> {formatDate(profileData.last_login)}
                </div>
              )}
            </div>
          </section>

          {/* Información de la Empresa (solo si aplica) */}
          {profileData.empresa_detail && (
            <section className="space-y-4 pt-4 border-t border-indigo-100">
              <h4 className="text-xl font-semibold text-gray-800 flex items-center mb-4">
                <Building className="mr-2 h-5 w-5 text-indigo-600" /> Información de la Empresa
              </h4>
              <div className="flex items-center gap-2 text-gray-700">
                <Building className="h-5 w-5 text-indigo-600" />
                <span className="font-medium">Empresa:</span> {profileData.empresa_detail.nombre}
              </div>
              {profileData.empresa_detail.nit && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Fingerprint className="h-5 w-5 text-indigo-600" /> {/* Reutilizando Fingerprint para NIT */}
                  <span className="font-medium">NIT/RUC:</span> {profileData.empresa_detail.nit}
                </div>
              )}
            </section>
          )}
        </CardContent>

        <CardFooter className="flex justify-center p-6 border-t border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <Button
            onClick={() => setIsEditDialogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-md transition-all duration-200 px-6 py-2"
          >
            <Edit className="mr-2 h-4 w-4" /> Editar Perfil
          </Button>
        </CardFooter>
      </Card>

      {/* Diálogo para editar perfil */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md p-6 rounded-lg shadow-2xl border border-indigo-200 bg-white">
          <DialogHeader className="border-b pb-4 mb-4">
            <DialogTitle className="text-2xl font-semibold text-gray-800">Editar tu Perfil</DialogTitle>
            <DialogDescription className="text-gray-600">
              Actualiza la información de tu cuenta aquí.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre</Label>
              <Input
                id="first_name"
                name="first_name"
                value={formData.first_name || ""}
                onChange={handleInputChange}
                required
                className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
              {formErrors.first_name && <p className="text-red-500 text-sm">{formErrors.first_name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido</Label>
              <Input
                id="last_name"
                name="last_name"
                value={formData.last_name || ""}
                onChange={handleInputChange}
                required
                className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
              {formErrors.last_name && <p className="text-red-500 text-sm">{formErrors.last_name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={profileData.email || ""} // Muestra el email del profileData, no editable
                onChange={handleInputChange} // Aunque está disabled, es buena práctica tenerlo
                required
                disabled // DESHABILITADO: El email no se edita desde aquí
                className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {formErrors.email && <p className="text-red-500 text-sm">{formErrors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Nombre de Usuario (no editable)</Label>
              <Input
                id="username"
                name="username"
                value={profileData.username || ""} // Muestra el username del profileData
                disabled // DESHABILITADO: El username no se edita desde aquí
                className="rounded-md border-gray-300 bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                name="telefono"
                value={formData.telefono || ""}
                onChange={handleInputChange}
                className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
              {formErrors.telefono && <p className="text-red-500 text-sm">{formErrors.telefono}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ci">C.I. / Identificación</Label>
              <Input
                id="ci"
                name="ci"
                value={formData.ci || ""}
                onChange={handleInputChange}
                className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
              {formErrors.ci && <p className="text-red-500 text-sm">{formErrors.ci}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                name="direccion"
                value={formData.direccion || ""}
                onChange={handleInputChange}
                className="rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
              />
              {formErrors.direccion && <p className="text-red-500 text-sm">{formErrors.direccion}</p>}
            </div>

            {formErrors.general && <p className="col-span-full text-red-500 text-sm text-center">{formErrors.general}</p>}

            <DialogFooter className="pt-6 flex-col sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-md px-5 py-2 w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-5 py-2 shadow-md w-full sm:w-auto"
              >
                {updateProfileMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Perfil;
