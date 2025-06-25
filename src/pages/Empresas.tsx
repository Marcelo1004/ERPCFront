import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext'; // Usando alias de ruta
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api'; // Usando alias de ruta
import { Empresa, User, PaginatedResponse, FilterParams } from '@/types/auth'; // Importamos Empresa, User y PaginatedResponse desde auth.ts
import { Suscripcion } from '@/types/suscripciones'; // Importamos Suscripcion desde su propio archivo
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"; // Usando alias de ruta
import { Button } from "@/components/ui/button"; // Usando alias de ruta
import { Input } from "@/components/ui/input"; // Usando alias de ruta
import { Label } from "@/components/ui/label"; // Usando alias de ruta
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Usando alias de ruta
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Usando alias de ruta
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Usando alias de ruta
import { toast } from "@/components/ui/use-toast"; // Usando alias de ruta
import { Loader2, PlusCircle, Edit, Trash2, Search, Building, User as UserIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // <<-- CORREGIDO: Usando 'from' en lugar de '=>'
import { Checkbox } from '@/components/ui/checkbox'; // Usando alias de ruta

const Empresas: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Empresa | null>(null);
  const [formData, setFormData] = useState<Partial<Empresa & { logo_file?: File | null }>>({
    nombre: '',
    nit: '',
    direccion: '',
    telefono: '',
    email_contacto: '',
    logo: null,
    logo_file: null, // Para manejar el archivo de imagen directamente
    suscripcion: undefined,
    admin_empresa: undefined,
    is_active: true,
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');

  // Solo SuperUsuario puede gestionar empresas
  const canManageEmpresas = currentUser?.is_superuser;

  // Consulta para obtener la lista de empresas
  const { data: empresasData, isLoading: isLoadingEmpresas, error: empresasError } = useQuery<PaginatedResponse<Empresa>, Error>({
    queryKey: ['empresasList'],
    queryFn: () => api.fetchEmpresas(), // api.fetchEmpresas ya retorna PaginatedResponse
    enabled: canManageEmpresas, // Solo cargar si el usuario tiene permiso
  });

  const empresas = empresasData?.results || [];

  // Consulta para obtener la lista de suscripciones (para el Select de suscripción)
  const { data: suscripcionesData, isLoading: isLoadingSuscripciones } = useQuery<PaginatedResponse<Suscripcion>, Error>({
    queryKey: ['allSuscripciones'],
    queryFn: () => api.fetchSuscripciones(), // api.fetchSuscripciones ya retorna PaginatedResponse
    enabled: canManageEmpresas && isFormOpen, // Solo cargar si el superuser y el formulario están abiertos
  });
  const suscripciones = suscripcionesData?.results || [];

  // Consulta para obtener la lista de usuarios (para el Select de admin_empresa)
  const { data: usersForAdminData, isLoading: isLoadingUsersForAdmin } = useQuery<PaginatedResponse<User>, Error>({
    queryKey: ['allUsersForAdmin'],
    queryFn: () => api.fetchUsuarios({ rol: 'ADMINISTRATIVO' }), // Solo administradores pueden ser admin_empresa
    enabled: canManageEmpresas && isFormOpen, // Solo cargar si el superuser y el formulario están abiertos
  });
  const usersForAdmin = usersForAdminData?.results || [];


  // Mutación para crear empresa
  const createEmpresaMutation = useMutation<Empresa, Error, FormData>({ // <Empresa, Error, FormData>
    mutationFn: async (newData: FormData) => api.createEmpresa(newData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresasList'] });
      toast({ title: "Empresa creada", description: "La nueva empresa ha sido registrada exitosamente." });
      setIsFormOpen(false);
      setFormData({});
      setFormErrors({});
    },
    onError: (err: any) => {
      console.error("Error al crear empresa:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
      toast({ variant: "destructive", title: "Error al crear empresa", description: err.response?.data?.detail || "No se pudo crear la empresa." });
    },
  });

  // Mutación para actualizar empresa
  const updateEmpresaMutation = useMutation<Empresa, Error, { id: number; data: FormData }>({ // <Empresa, Error, { id: number; data: FormData }>
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => api.updateEmpresa(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresasList'] });
      toast({ title: "Empresa actualizada", description: "La información de la empresa ha sido guardada exitosamente." });
      setIsFormOpen(false);
      setFormData({});
      setFormErrors({});
      setEditingEmpresa(null);
    },
    onError: (err: any) => {
      console.error("Error al actualizar empresa:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
      toast({ variant: "destructive", title: "Error al actualizar empresa", description: err.response?.data?.detail || "No se pudo actualizar la empresa." });
    },
  });

  // Mutación para eliminar empresa
  const deleteEmpresaMutation = useMutation({
    mutationFn: (id: number) => api.deleteEmpresa(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresasList'] });
      toast({ title: "Empresa eliminada", description: "La empresa ha sido eliminada exitosamente." });
    },
    onError: (err: any) => {
      console.error("Error al eliminar empresa:", err.response?.data || err.message);
      toast({ variant: "destructive", title: "Error al eliminar empresa", description: err.response?.data?.detail || "No se pudo eliminar la empresa." });
    },
  });

  // Manejar el cambio de input del formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Manejar el cambio de input de archivo para el logo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, logo_file: e.target.files![0] }));
    } else {
      setFormData(prev => ({ ...prev, logo_file: null }));
    }
  };

  // Manejar el cambio de select para suscripción y admin_empresa
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value === '' ? null : parseInt(value) }));
  };

  // Abrir diálogo de edición/creación
  const openForm = (empresa?: Empresa) => {
    setFormErrors({});
    if (empresa) {
      setEditingEmpresa(empresa);
      setFormData({
        id: empresa.id,
        nombre: empresa.nombre || '',
        nit: empresa.nit || '',
        direccion: empresa.direccion || '',
        telefono: empresa.telefono || '',
        email_contacto: empresa.email_contacto || '',
        logo: empresa.logo || null, // URL existente
        logo_file: null, // No hay archivo al editar inicialmente
        suscripcion: empresa.suscripcion || undefined,
        admin_empresa: empresa.admin_empresa || undefined,
        is_active: empresa.is_active,
      });
    } else {
      setEditingEmpresa(null);
      setFormData({
        nombre: '',
        nit: '',
        direccion: '',
        telefono: '',
        email_contacto: '',
        logo: null,
        logo_file: null,
        suscripcion: undefined,
        admin_empresa: undefined,
        is_active: true,
      });
    }
    setIsFormOpen(true);
  };

  // Cerrar diálogo
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingEmpresa(null);
    setFormData({});
    setFormErrors({});
  };

  // Enviar formulario (crear o actualizar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    // Validaciones básicas del lado del cliente
    if (!formData.nombre) {
      toast({ variant: "destructive", title: "Error de validación", description: "El nombre de la empresa es requerido." });
      return;
    }

    const dataToSend = new FormData();
    dataToSend.append('nombre', formData.nombre);
    if (formData.nit) dataToSend.append('nit', formData.nit);
    if (formData.direccion) dataToSend.append('direccion', formData.direccion);
    if (formData.telefono) dataToSend.append('telefono', formData.telefono);
    if (formData.email_contacto) dataToSend.append('email_contacto', formData.email_contacto);
    if (formData.suscripcion !== undefined && formData.suscripcion !== null) dataToSend.append('suscripcion', formData.suscripcion.toString());
    if (formData.admin_empresa !== undefined && formData.admin_empresa !== null) dataToSend.append('admin_empresa', formData.admin_empresa.toString());
    dataToSend.append('is_active', formData.is_active ? 'true' : 'false');

    // Solo añadir el archivo de logo si hay uno nuevo
    if (formData.logo_file) {
      dataToSend.append('logo', formData.logo_file);
    } else if (editingEmpresa && !formData.logo && !formData.logo_file) {
      // Si estamos editando y el logo fue eliminado (o no se seleccionó nuevo), envía un string vacío o null si tu API lo acepta para borrar
      // Django REST Framework generalmente maneja esto si no se envía el campo o se envía null.
      // Para ser explícitos, podrías enviar un string vacío si la API lo interpreta como borrar la imagen.
      // dataToSend.append('logo', ''); // Descomentar si enviar '' borra la imagen en el backend
    }

    if (editingEmpresa) { // Lógica para actualizar empresa
      if (editingEmpresa.id) {
        updateEmpresaMutation.mutate({ id: editingEmpresa.id, data: dataToSend });
      } else {
        toast({ variant: "destructive", title: "Error", description: "ID de empresa para actualizar no encontrado." });
      }
    } else { // Lógica para crear empresa
      createEmpresaMutation.mutate(dataToSend);
    }
  };

  // Filtrar empresas por término de búsqueda
  const filteredEmpresas = useMemo(() => {
    if (!empresas) return [];
    return empresas.filter(empresa =>
      empresa.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      empresa.nit?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      empresa.email_contacto?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [empresas, searchTerm]);

  // Manejar eliminación de empresa
  const handleDelete = (empresaId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta empresa? ¡Esta acción es irreversible y eliminará todos los datos asociados (usuarios, sucursales, etc.)!')) {
      deleteEmpresaMutation.mutate(empresaId);
    }
  };

  if (!canManageEmpresas) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Acceso Denegado</AlertTitle>
        <AlertDescription>
          No tienes permisos para gestionar empresas. Solo los Super Usuarios pueden acceder a esta sección.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoadingEmpresas) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando empresas...</p>
      </div>
    );
  }

  if (empresasError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudieron cargar las empresas: {empresasError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Gestión de Empresas</CardTitle>
            <CardDescription className="text-gray-600 mt-1">Administra las empresas clientes de tu plataforma ERP SaaS.</CardDescription>
          </div>
          <Button onClick={() => openForm()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-md px-4 py-2">
            <PlusCircle className="mr-2 h-4 w-4" /> Nueva Empresa
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4">
            <Input
              placeholder="Buscar empresas por nombre, NIT o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NIT/RUC</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Suscripción</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Empresa</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Activa</TableHead>
                  <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-100">
                {filteredEmpresas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                      No se encontraron empresas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmpresas.map((empresa) => (
                    <TableRow key={empresa.id} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{empresa.nombre}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{empresa.nit || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {empresa.email_contacto}<br/>{empresa.telefono}
                      </TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{empresa.suscripcion_detail?.nombre || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {empresa.admin_empresa_detail ? `${empresa.admin_empresa_detail.first_name} ${empresa.admin_empresa_detail.last_name}` : 'N/A'}
                      </TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${empresa.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {empresa.is_active ? 'Sí' : 'No'}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openForm(empresa)}
                          className="text-blue-600 hover:bg-blue-50 rounded-md p-2 mr-1"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(empresa.id)}
                          className="text-red-600 hover:bg-red-50 rounded-md p-2"
                          disabled={deleteEmpresaMutation.isPending}
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

      {/* Formulario de Creación/Edición de Empresa */}
      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="sm:max-w-xl p-6 rounded-lg shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-800">
              {editingEmpresa ? 'Editar Empresa' : 'Crear Nueva Empresa'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-1">
              {editingEmpresa ? 'Modifica los datos de la empresa.' : 'Introduce los datos para registrar una nueva empresa cliente.'}
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
              <Label htmlFor="nit" className="text-right text-gray-700">NIT/RUC</Label>
              <Input
                id="nit"
                name="nit"
                value={formData.nit || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.nit && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.nit}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="direccion" className="text-right text-gray-700">Dirección</Label>
              <Input
                id="direccion"
                name="direccion"
                value={formData.direccion || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email_contacto" className="text-right text-gray-700">Email Contacto</Label>
              <Input
                id="email_contacto"
                name="email_contacto"
                type="email"
                value={formData.email_contacto || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.email_contacto && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.email_contacto}</p>}
            </div>

            {/* Selector de Suscripción */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="suscripcion" className="text-right text-gray-700">Plan Suscripción</Label>
              <Select
                value={formData.suscripcion?.toString() || ''}
                onValueChange={(value) => handleSelectChange('suscripcion', value)}
                disabled={isLoadingSuscripciones}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingSuscripciones ? (
                    <SelectItem value="" disabled>Cargando planes...</SelectItem>
                  ) : (
                    suscripciones?.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.nombre}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {formErrors.suscripcion && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.suscripcion}</p>}
            </div>

            {/* Selector de Administrador de Empresa */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="admin_empresa" className="text-right text-gray-700">Admin Empresa</Label>
              <Select
                value={formData.admin_empresa?.toString() || ''}
                onValueChange={(value) => handleSelectChange('admin_empresa', value)}
                disabled={isLoadingUsersForAdmin}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Selecciona un usuario admin" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingUsersForAdmin ? (
                    <SelectItem value="" disabled>Cargando usuarios...</SelectItem>
                  ) : (
                    <>
                      <SelectItem value="">-- Sin asignar --</SelectItem> {/* Opción para desasignar */}
                      {usersForAdmin?.map(u => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.first_name} {u.last_name} ({u.username})</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {formErrors.admin_empresa && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.admin_empresa}</p>}
            </div>

            {/* Logo de la Empresa */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="logo_file" className="text-right text-gray-700">Logo</Label>
              <Input
                id="logo_file"
                name="logo_file"
                type="file"
                onChange={handleFileChange}
                className="col-span-3"
                accept="image/*"
              />
              {formErrors.logo && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.logo}</p>}
              {formData.logo && !formData.logo_file && (
                <div className="col-span-4 flex justify-end">
                  <img src={formData.logo} alt="Logo actual" className="mt-2 h-16 w-16 object-contain rounded-md border border-gray-200" />
                </div>
              )}
            </div>

            {/* Checkbox para Activa/Inactiva */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="is_active" className="text-right text-gray-700">Activa</Label>
              <div className="col-span-3 flex items-center">
                <Checkbox
                  id="is_active"
                  name="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: Boolean(checked) }))}
                  className="rounded-md border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{formData.is_active ? 'Sí' : 'No'}</span>
              </div>
            </div>

            {formErrors.general && <p className="col-span-4 text-red-500 text-sm text-center">{formErrors.general}</p>}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createEmpresaMutation.isPending || updateEmpresaMutation.isPending} className="rounded-md px-4 py-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={createEmpresaMutation.isPending || updateEmpresaMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md">
                {createEmpresaMutation.isPending || updateEmpresaMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  editingEmpresa ? 'Guardar Cambios' : 'Crear Empresa'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Empresas;