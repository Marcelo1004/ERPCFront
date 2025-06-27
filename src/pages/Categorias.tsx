import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Categoria } from '@/types/categorias'; // Asumo que Categoria tiene 'nombre', 'descripcion', 'empresa', 'empresa_detail'
import { PaginatedResponse, FilterParams } from '@/services/api'; // Asegúrate que PaginatedResponse y FilterParams estén aquí

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Search, Tag as TagIcon, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea'; // Importa Textarea
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Importa los componentes de AlertDialog


// Define una interfaz para el estado del formulario de categoría
interface CategoriaFormData {
  nombre: string;
  descripcion?: string;
  empresa?: number; // Opcional, solo para Superusuarios o asignación automática
}

const Categorias: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth(); // Obtén hasPermission
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState<CategoriaFormData>({
    nombre: '',
    descripcion: '',
    empresa: currentUser?.empresa || undefined, // Valor por defecto
  });
  // Tipado más preciso para los errores del formulario
  const [formErrors, setFormErrors] = useState<Record<string, string | string[]>>({}); 
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para el diálogo de confirmación de eliminación
  const [showConfirmDeleteDialog, setShowConfirmDeleteDialog] = useState(false);
  const [categoriaToDeleteId, setCategoriaToDeleteId] = useState<number | null>(null);

  // === CORRECCIÓN DE ROLES ===
  // Permisos basados en hasPermission (preferible) o en el nombre del rol directamente
  const canViewCategorias = hasPermission('view_categoria');
  const canAddCategorias = hasPermission('add_categoria');
  const canChangeCategorias = hasPermission('change_categoria');
  const canDeleteCategorias = hasPermission('delete_categoria');

  // Lógica para determinar si un usuario puede modificar (crear/editar/eliminar) categorías
  // Un usuario puede modificar si es Super Usuario O si es Administrador Y tiene una empresa asignada.
  const canModify = currentUser?.is_superuser || 
                   (currentUser?.role?.name === 'Administrador' && !!currentUser?.empresa);
  // ==========================

  // Consulta para obtener la lista de categorías
  const { data: categoriasData, isLoading: isLoadingCategorias, error: categoriasError } = useQuery<PaginatedResponse<Categoria>, Error>({
    queryKey: ['categoriasList', searchTerm, currentUser?.empresa, currentUser?.is_superuser],
    queryFn: async ({ queryKey }) => {
      const [_key, currentSearchTerm, empresaId, isSuperuser] = queryKey;
      const filters: FilterParams = { search: currentSearchTerm as string || '' };

      // Si no es superusuario y está ligado a una empresa, filtrar por esa empresa
      if (!(isSuperuser as boolean) && (empresaId as number)) {
        filters.empresa = empresaId as number;
      }
      return api.fetchCategorias(filters);
    },
    enabled: !!currentUser?.id && canViewCategorias, // Solo ejecuta si hay usuario y tiene permiso para ver
  });

  const categorias = categoriasData?.results || [];

  // Filtrado local adicional si se desea (por nombre o descripción)
  const filteredCategorias = useMemo(() => {
    if (!searchTerm) return categorias;
    const lower = searchTerm.toLowerCase();
    return categorias.filter(
      cat =>
        cat.nombre.toLowerCase().includes(lower) ||
        (cat.descripcion && cat.descripcion.toLowerCase().includes(lower))
    );
  }, [categorias, searchTerm]);

  const createCategoriaMutation = useMutation<Categoria, Error, Omit<Categoria, 'id' | 'empresa_detail'>>({
    mutationFn: (newCategoriaData) => api.createCategoria(newCategoriaData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoriasList'] });
      toast({ title: "Categoría creada", description: "La nueva categoría ha sido registrada exitosamente." });
      closeForm(); // Cerrar y resetear formulario
    },
    onError: (err: any) => {
      console.error("Error al crear categoría:", err.response?.data || err.message);
      setFormErrors(err.response?.data || { general: err.message || "No se pudo crear la categoría." });
      toast({ variant: "destructive", title: "Error al crear categoría", description: err.response?.data?.detail || "No se pudo crear la categoría." });
    },
  });

  const updateCategoriaMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CategoriaFormData> }) => api.updateCategoria(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoriasList'] });
      toast({ title: "Categoría actualizada", description: "La información de la categoría ha sido guardada exitosamente." });
      closeForm(); // Cerrar y resetear formulario
    },
    onError: (err: any) => {
      console.error("Error al actualizar categoría:", err.response?.data || err.message);
      setFormErrors(err.response?.data || { general: err.message || "No se pudo actualizar la categoría." });
      toast({ variant: "destructive", title: "Error al actualizar categoría", description: err.response?.data?.detail || "No se pudo actualizar la categoría." });
    },
  });

  const deleteCategoriaMutation = useMutation({
    mutationFn: (id: number) => api.deleteCategoria(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoriasList'] });
      toast({ title: "Categoría eliminada", description: "La categoría ha sido eliminada exitosamente." });
    },
    onError: (err: any) => {
      console.error("Error al eliminar categoría:", err.response?.data || err.message);
      toast({ variant: "destructive", title: "Error al eliminar categoría", description: err.response?.data?.detail || "No se pudo eliminar la categoría." });
    },
    onSettled: () => {
      setShowConfirmDeleteDialog(false); // Siempre cierra el diálogo al finalizar
      setCategoriaToDeleteId(null);
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormErrors(prev => ({ ...prev, [name]: undefined })); // Limpia el error al cambiar el input
  };

  const openForm = (categoria?: Categoria) => {
    setFormErrors({});
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({
        nombre: categoria.nombre || '',
        descripcion: categoria.descripcion || '',
        empresa: categoria.empresa, // Si es un superusuario, se mantiene el ID de la empresa
      });
    } else {
      setEditingCategoria(null);
      setFormData({
        nombre: '',
        descripcion: '',
        // Asigna la empresa automáticamente para usuarios no Superuser
        empresa: !currentUser?.is_superuser && currentUser?.empresa ? currentUser.empresa : undefined,
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCategoria(null);
    setFormData({ nombre: '', descripcion: '', empresa: !currentUser?.is_superuser && currentUser?.empresa ? currentUser.empresa : undefined }); // Resetear completamente
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({}); // Limpiar errores antes de una nueva validación

    let currentErrors: Record<string, string | string[]> = {};

    // Validaciones frontend
    if (!formData.nombre.trim()) {
      currentErrors.nombre = "El nombre de la categoría es requerido.";
    }

    // Lógica para asignar la empresa según el rol del usuario
    let dataToSubmit: Partial<CategoriaFormData> = { ...formData };

    if (!currentUser?.is_superuser) { // Si no es superusuario, la empresa viene del usuario logueado
      if (currentUser?.empresa) {
        dataToSubmit.empresa = currentUser.empresa;
      } else {
        currentErrors.general = "Tu cuenta no está asociada a una empresa. Contacta a un administrador.";
      }
    } else { // Si es superusuario, debe especificar la empresa (en creación)
      if (!editingCategoria && !formData.empresa) {
        currentErrors.empresa = "Los Superusuarios deben seleccionar una empresa al crear una categoría.";
      }
    }

    if (Object.keys(currentErrors).length > 0) {
      setFormErrors(currentErrors);
      toast({ variant: "destructive", title: "Error de validación", description: currentErrors.general || "Por favor, corrige los errores en el formulario." });
      return;
    }

    try {
      if (editingCategoria) {
        if (editingCategoria.id) {
          await updateCategoriaMutation.mutateAsync({ id: editingCategoria.id, data: dataToSubmit });
        } else {
          toast({ variant: "destructive", title: "Error", description: "ID de categoría para actualizar no encontrado." });
        }
      } else {
        // Asegura que empresa es requerido
        await createCategoriaMutation.mutateAsync({
          nombre: dataToSubmit.nombre!,
          descripcion: dataToSubmit.descripcion ?? '',
          empresa: dataToSubmit.empresa!,
        });
      }
    } catch (error) {
      // Los errores se manejan en onError de las mutaciones
    }
  };

  // Manejador para iniciar el proceso de eliminación
  const handleDeleteClick = (categoriaId: number) => {
    setCategoriaToDeleteId(categoriaId);
    setShowConfirmDeleteDialog(true);
  };

  // Manejador para confirmar la eliminación desde el diálogo
  const handleConfirmDelete = () => {
    if (categoriaToDeleteId) {
      deleteCategoriaMutation.mutate(categoriaToDeleteId);
    }
  };

  const handleSearchClick = () => {
    setSearchTerm(searchInputValue);
  };

  // Mensajes de carga y error iniciales
  if (isLoadingCategorias) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando categorías...</p>
      </div>
    );
  }

  // Permiso general para acceder a la página de categorías
  if (!canViewCategorias) {
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

  if (categoriasError) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto my-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error de Carga</AlertTitle>
        <AlertDescription>
          No se pudieron cargar las categorías: {categoriasError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-2xl rounded-xl border border-indigo-100 bg-white text-gray-900">
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <div>
            <CardTitle className="text-2xl font-bold">Gestión de Categorías</CardTitle>
            <CardDescription className="text-gray-600 mt-1">Administra las categorías de productos para tu empresa.</CardDescription>
          </div>
          {canModify && (
            <Button onClick={() => openForm()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-md px-4 py-2">
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Categoría
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <div className="mb-4 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2">
            <div className="relative flex-grow w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar categorías por nombre o descripción..."
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
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
          </div>
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</TableHead>
                  <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empresa</TableHead>
                  {canModify && (
                    <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="bg-white divide-y divide-gray-100">
                {filteredCategorias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canModify ? 4 : 3} className="h-24 text-center text-gray-500">
                      No se encontraron categorías.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategorias.map((categoria) => (
                    <TableRow key={categoria.id} className="hover:bg-gray-50">
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{categoria.nombre}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{categoria.descripcion || 'N/A'}</TableCell>
                      <TableCell className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{categoria.empresa_detail?.nombre || 'N/A'}</TableCell>
                      {canModify && (
                        <TableCell className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openForm(categoria)}
                            className="text-blue-600 hover:bg-blue-50 rounded-md p-2 mr-1"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(categoria.id)}
                            className="text-red-600 hover:bg-red-50 rounded-md p-2"
                            disabled={deleteCategoriaMutation.isPending}
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

      {/* Formulario de Creación/Edición de Categoría */}
      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent className="sm:max-w-[425px] p-6 rounded-lg shadow-2xl border border-indigo-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-800">
              {editingCategoria ? 'Editar Categoría' : 'Crear Nueva Categoría'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 mt-1">
              {editingCategoria ? 'Modifica los datos de la categoría.' : 'Introduce los datos para registrar una nueva categoría.'}
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
              <Textarea // Usando Textarea de Shadcn UI
                id="descripcion"
                name="descripcion"
                value={formData.descripcion || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 resize-y" // Añadido resize-y
                rows={3} // Número de filas
              />
              {formErrors.descripcion && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.descripcion}</p>}
            </div>

            {/* Solo para SuperUsuario: Selector de Empresa */}
            {currentUser?.is_superuser && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="empresa" className="text-right text-gray-700">Empresa</Label>
                {/* Aquí idealmente cargarías las empresas disponibles para un <select> */}
                {/* Por ahora, es un Input de texto/número para el ID de la empresa */}
                <Input
                  id="empresa"
                  name="empresa"
                  type="number" // El ID de la empresa es un número
                  value={formData.empresa || ''}
                  onChange={handleInputChange}
                  className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="ID de la empresa (solo SuperUsuario)"
                  required={currentUser?.is_superuser && !editingCategoria} // Requerido solo en creación por Superusuario
                />
                {formErrors.empresa && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.empresa}</p>}
              </div>
            )}

            {formErrors.general && <p className="col-span-4 text-red-500 text-sm text-center">{formErrors.general}</p>}

            <DialogFooter className="pt-4 flex-col sm:flex-row sm:justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createCategoriaMutation.isPending || updateCategoriaMutation.isPending} className="rounded-md px-4 py-2 w-full sm:w-auto">
                Cancelar
              </Button>
              <Button type="submit" disabled={createCategoriaMutation.isPending || updateCategoriaMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md w-full sm:w-auto">
                {createCategoriaMutation.isPending || updateCategoriaMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  editingCategoria ? 'Guardar Cambios' : 'Crear Categoría'
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
              ¿Estás seguro de que deseas eliminar la categoría "
              <span className="font-semibold text-gray-900">
                {categorias.find(cat => cat.id === categoriaToDeleteId)?.nombre || 'este elemento'}
              </span>"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={() => setShowConfirmDeleteDialog(false)} disabled={deleteCategoriaMutation.isPending}>
                Cancelar
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button 
                variant="destructive" 
                onClick={handleConfirmDelete} 
                disabled={deleteCategoriaMutation.isPending}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleteCategoriaMutation.isPending ? (
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

export default Categorias;
