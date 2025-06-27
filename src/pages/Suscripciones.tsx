import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Suscripcion } from '../types/suscripciones';
import { PaginatedResponse } from '../types/auth'; // Usamos la interfaz PaginatedResponse de auth.ts
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "../components/ui/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';


const Suscripciones: React.FC = () => {
  const { user: currentUser } = useAuth();  
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSuscripcion, setEditingSuscripcion] = useState<Suscripcion | null>(null);
  const [formData, setFormData] = useState<Partial<Suscripcion>>({
    nombre: '',
    descripcion: '',
    cantidad_usuarios_permitidos: 1,
    precio: 0, // ¡Añadido! Valor inicial del precio
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');

  const canManageSuscripciones = currentUser?.is_superuser;

  const { data: suscripcionesData, isLoading: isLoadingSuscripciones, error: suscripcionesError } = useQuery<PaginatedResponse<Suscripcion>, Error>({
    queryKey: ['suscripcionesList'],
    queryFn: () => api.fetchSuscripciones() as Promise<PaginatedResponse<Suscripcion>>,
  });

  const suscripciones = suscripcionesData?.results || [];

  const createSuscripcionMutation = useMutation({
    mutationFn: (newSuscripcionData: Omit<Suscripcion, 'id'>) => api.createSuscripcion(newSuscripcionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suscripcionesList'] });
      toast({ title: "Suscripción creada", description: "El nuevo plan de suscripción ha sido registrado exitosamente." });
      setIsFormOpen(false);
      setFormData({ // Resetear formulario incluyendo precio
        nombre: '',
        descripcion: '',
        cantidad_usuarios_permitidos: 1,
        precio: 0,
      });
      setFormErrors({});
    },
    onError: (err: any) => {
      console.error("Error al crear suscripción:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
      toast({ variant: "destructive", title: "Error al crear suscripción", description: err.response?.data?.detail || "No se pudo crear el plan de suscripción." });
    },
  });

  const updateSuscripcionMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Suscripcion> }) => api.updateSuscripcion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suscripcionesList'] });
      toast({ title: "Suscripción actualizada", description: "La información del plan de suscripción ha sido guardada exitosamente." });
      setIsFormOpen(false);
      setFormData({ // Resetear formulario incluyendo precio
        nombre: '',
        descripcion: '',
        cantidad_usuarios_permitidos: 1,
        precio: 0,
      });
      setFormErrors({});
      setEditingSuscripcion(null);
    },
    onError: (err: any) => {
      console.error("Error al actualizar suscripción:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
      toast({ variant: "destructive", title: "Error al actualizar suscripción", description: err.response?.data?.detail || "No se pudo actualizar el plan de suscripción." });
    },
  });

  const deleteSuscripcionMutation = useMutation({
    mutationFn: (id: number) => api.deleteSuscripcion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suscripcionesList'] });
      toast({ title: "Suscripción eliminada", description: "El plan de suscripción ha sido eliminado exitosamente." });
    },
    onError: (err: any) => {
      console.error("Error al eliminar suscripción:", err.response?.data || err.message);
      toast({ variant: "destructive", title: "Error al eliminar suscripción", description: err.response?.data?.detail || "No se pudo eliminar el plan de suscripción." });
    },
  });

  // Manejar el cambio de input del formulario
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'cantidad_usuarios_permitidos' || name === 'precio') ? parseFloat(value) : value // ¡Parsea precio como float!
    }));
  };

  // Abrir diálogo de edición/creación
  const openForm = (suscripcion?: Suscripcion) => {
    setFormErrors({});
    if (suscripcion) {
      setEditingSuscripcion(suscripcion);
      setFormData({
        id: suscripcion.id,
        nombre: suscripcion.nombre || '',
        descripcion: suscripcion.descripcion || '',
        cantidad_usuarios_permitidos: suscripcion.cantidad_usuarios_permitidos || 1,
        precio: suscripcion.precio || 0, // ¡Carga el precio al editar!
      });
    } else {
      setEditingSuscripcion(null);
      setFormData({
        nombre: '',
        descripcion: '',
        cantidad_usuarios_permitidos: 1,
        precio: 0, // ¡Inicializa precio para nuevas suscripciones!
      });
    }
    setIsFormOpen(true);
  };

  // Cerrar diálogo
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingSuscripcion(null);
    setFormData({ // Resetear formulario completamente
      nombre: '',
      descripcion: '',
      cantidad_usuarios_permitidos: 1,
      precio: 0,
    });
    setFormErrors({});
  };

  // Enviar formulario (crear o actualizar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    // Validaciones básicas del lado del cliente
    if (!formData.nombre || formData.cantidad_usuarios_permitidos === undefined || formData.precio === undefined) { // ¡Valida precio!
      setFormErrors({ general: "Nombre, cantidad de usuarios permitidos y precio son requeridos." });
      toast({ variant: "destructive", title: "Error de validación", description: "Por favor, completa todos los campos requeridos." });
      return;
    }
    if (formData.precio < 0) { // Validar que el precio no sea negativo
      setFormErrors({ precio: "El precio no puede ser negativo." });
      toast({ variant: "destructive", title: "Error de validación", description: "El precio no puede ser un valor negativo." });
      return;
    }

    if (editingSuscripcion) {
      if (editingSuscripcion.id) {
        updateSuscripcionMutation.mutate({ id: editingSuscripcion.id, data: formData as Suscripcion });
      } else {
        toast({ variant: "destructive", title: "Error", description: "ID de suscripción para actualizar no encontrado." });
      }
    } else {
      createSuscripcionMutation.mutate(formData as Omit<Suscripcion, 'id'>);
    }
  };

  // Filtrar suscripciones por término de búsqueda
  const filteredSuscripciones = useMemo(() => {
    if (!suscripciones) return [];
    return suscripciones.filter(suscripcion =>
      suscripcion.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      suscripcion.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
      // Opcional: buscar por precio (si es relevante para el usuario final)
      // || String(suscripcion.precio).includes(searchTerm)
    );
  }, [suscripciones, searchTerm]);

  // Manejar eliminación de suscripción
  const handleDelete = (suscripcionId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este plan de suscripción? Esta acción es irreversible.')) {
      deleteSuscripcionMutation.mutate(suscripcionId);
    }
  };

  if (isLoadingSuscripciones) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando planes de suscripción...</p>
      </div>
    );
  }

  if (suscripcionesError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudieron cargar los planes de suscripción: {suscripcionesError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-lg rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Gestión de Suscripciones</CardTitle>
            <CardDescription className="text-gray-600 mt-1">Administra los planes de suscripción disponibles en el sistema.</CardDescription>
          </div>
          {canManageSuscripciones && (
            <Button onClick={() => openForm()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-md px-4 py-2">
              <PlusCircle className="mr-2 h-4 w-4" /> Nuevo Plan
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4">
            <Input
              placeholder="Buscar planes por nombre o descripción..."
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
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuarios Permitidos</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</TableHead> {/* ¡Añadido! */}
                  {canManageSuscripciones && (
                    <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-100">
                {filteredSuscripciones.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManageSuscripciones ? 5 : 4} className="h-24 text-center text-gray-500"> {/* ¡Colspan ajustado! */}
                      No se encontraron planes de suscripción.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuscripciones.map((suscripcion) => (
                    <TableRow key={suscripcion.id} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{suscripcion.nombre}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{suscripcion.descripcion || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{suscripcion.cantidad_usuarios_permitidos}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">${Number(suscripcion.precio).toFixed(2)}</TableCell> {/* ¡Muestra el precio! */}
                      {canManageSuscripciones && (
                        <TableCell className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openForm(suscripcion)}
                            className="text-blue-600 hover:bg-blue-50 rounded-md p-2 mr-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(suscripcion.id)}
                            className="text-red-600 hover:bg-red-50 rounded-md p-2"
                            disabled={deleteSuscripcionMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Formulario de Creación/Edición de Suscripción */}
      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="sm:max-w-[425px] p-6 rounded-lg shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-800">
              {editingSuscripcion ? 'Editar Suscripción' : 'Crear Nuevo Plan de Suscripción'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-1">
              {editingSuscripcion ? 'Modifica los datos del plan de suscripción.' : 'Introduce los datos para crear un nuevo plan.'}
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
              <Label htmlFor="descripcion" className="text-right text-gray-700">Descripción</Label>
              <Input
                id="descripcion"
                name="descripcion"
                value={formData.descripcion || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.descripcion && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.descripcion}</p>}
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cantidad_usuarios_permitidos" className="text-right text-gray-700">Usuarios Permitidos</Label>
              <Input
                id="cantidad_usuarios_permitidos"
                name="cantidad_usuarios_permitidos"
                type="number"
                value={formData.cantidad_usuarios_permitidos || 1}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
                min="1"
              />
              {formErrors.cantidad_usuarios_permitidos && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.cantidad_usuarios_permitidos}</p>}
            </div>
            {/* ¡NUEVO CAMPO: PRECIO! */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="precio" className="text-right text-gray-700">Precio</Label>
              <Input
                id="precio"
                name="precio"
                type="number"
                step="0.01" // Permite valores decimales
                value={formData.precio !== undefined ? formData.precio : ''} // Manejar 0 y undefined
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                required
                min="0" // El precio no debe ser negativo
              />
              {formErrors.precio && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.precio}</p>}
            </div>

            {formErrors.general && <p className="col-span-4 text-red-500 text-sm text-center">{formErrors.general}</p>}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createSuscripcionMutation.isPending || updateSuscripcionMutation.isPending} className="rounded-md px-4 py-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={createSuscripcionMutation.isPending || updateSuscripcionMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md">
                {createSuscripcionMutation.isPending || updateSuscripcionMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  editingSuscripcion ? 'Guardar Cambios' : 'Crear Suscripción'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suscripciones;