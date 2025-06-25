import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Categoria } from '@/types/categorias';
import { PaginatedResponse, FilterParams } from '@/types/auth'; // Asegúrate que FilterParams esté importado

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Search, Tag as TagIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Categorias: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState<Partial<Categoria>>({
    nombre: '',
    descripcion: '',
    empresa: currentUser?.empresa || undefined,
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const canManageCategorias = currentUser?.is_superuser || currentUser?.role === 'ADMINISTRATIVO';
  const canModify = currentUser?.is_superuser || (currentUser?.role === 'ADMINISTRATIVO' && currentUser?.empresa);

  // Consulta para obtener la lista de categorías
  const { data: categoriasData, isLoading: isLoadingCategorias, error: categoriasError } = useQuery<PaginatedResponse<Categoria>, Error>({
    queryKey: ['categoriasList', searchTerm, currentUser?.empresa, currentUser?.is_superuser],
    queryFn: ({ queryKey }) => {
      const [_key, currentSearchTerm, empresaId, isSuperuser] = queryKey;
      // FIX: Extend FilterParams type to allow 'empresa' property
      const filters: FilterParams & { empresa?: number } = { search: currentSearchTerm as string || '' };

      if (!isSuperuser && empresaId) {
        filters.empresa = empresaId as number;
      }
      return api.fetchCategorias(filters);
    },
    enabled: !!currentUser?.id,
  });

  const categorias = categoriasData?.results || [];

  const createCategoriaMutation = useMutation({
    mutationFn: (newCategoriaData: Omit<Categoria, 'id' | 'empresa_detail'>) => api.createCategoria(newCategoriaData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoriasList'] });
      toast({ title: "Categoría creada", description: "La nueva categoría ha sido registrada exitosamente." });
      setIsFormOpen(false);
      setFormData({});
      setFormErrors({});
    },
    onError: (err: any) => {
      console.error("Error al crear categoría:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
      toast({ variant: "destructive", title: "Error al crear categoría", description: err.response?.data?.detail || "No se pudo crear la categoría." });
    },
  });

  const updateCategoriaMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Categoria, 'empresa_detail'>> }) => api.updateCategoria(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoriasList'] });
      toast({ title: "Categoría actualizada", description: "La información de la categoría ha sido guardada exitosamente." });
      setIsFormOpen(false);
      setFormData({});
      setFormErrors({});
      setEditingCategoria(null);
    },
    onError: (err: any) => {
      console.error("Error al actualizar categoría:", err.response?.data || err.message);
      setFormErrors(err.response?.data || {});
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
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openForm = (categoria?: Categoria) => {
    setFormErrors({});
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({
        id: categoria.id,
        nombre: categoria.nombre || '',
        descripcion: categoria.descripcion || '',
        empresa: categoria.empresa,
      });
    } else {
      setEditingCategoria(null);
      setFormData({
        nombre: '',
        descripcion: '',
        empresa: currentUser?.empresa || undefined,
      });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCategoria(null);
    setFormData({});
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    if (!formData.nombre) {
      setFormErrors({ general: "El nombre de la categoría es requerido." });
      toast({ variant: "destructive", title: "Error de validación", description: "Por favor, completa el nombre de la categoría." });
      return;
    }

    let dataToSubmit = { ...formData };
    if (!currentUser?.is_superuser && currentUser?.empresa) {
      dataToSubmit.empresa = currentUser.empresa;
    } else if (currentUser?.is_superuser) {
      if (!editingCategoria && !formData.empresa) {
        setFormErrors({ general: "Superusuarios deben seleccionar una empresa al crear una categoría." });
        toast({ variant: "destructive", title: "Error de validación", description: "Superusuarios deben seleccionar una empresa." });
        return;
      }
    } else {
      toast({ variant: "destructive", title: "Error", description: "No tienes permisos para esta acción o no estás ligado a una empresa." });
      return;
    }

    if (editingCategoria) {
      if (editingCategoria.id) {
        updateCategoriaMutation.mutate({ id: editingCategoria.id, data: dataToSubmit as Partial<Omit<Categoria, 'empresa_detail'>> });
      } else {
        toast({ variant: "destructive", title: "Error", description: "ID de categoría para actualizar no encontrado." });
      }
    } else {
      createCategoriaMutation.mutate(dataToSubmit as Omit<Categoria, 'id' | 'empresa_detail'>);
    }
  };

  const filteredCategorias = useMemo(() => {
    if (!categorias) return [];
    if (!searchTerm) return categorias;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return categorias.filter(categoria =>
      categoria.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
      categoria.descripcion?.toLowerCase().includes(lowerCaseSearchTerm) ||
      categoria.empresa_detail?.nombre.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [categorias, searchTerm]);

  const handleDelete = (categoriaId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
      deleteCategoriaMutation.mutate(categoriaId);
    }
  };

  const handleSearchClick = () => {
    setSearchTerm(searchInputValue);
  };

  if (isLoadingCategorias) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando categorías...</p>
      </div>
    );
  }

  if (!canManageCategorias && (!currentUser?.empresa || currentUser.role === 'CLIENTE' || currentUser.role === 'EMPLEADO')) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Acceso Denegado</AlertTitle>
        <AlertDescription>
          No tienes permisos para gestionar categorías. Contacta a tu administrador.
        </AlertDescription>
      </Alert>
    );
  }

  if (categoriasError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          No se pudieron cargar las categorías: {categoriasError.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Aplicando shadow-2xl y borde a la Card principal */}
      <Card className="shadow-2xl rounded-xl border border-indigo-100">
        <CardHeader className="flex flex-row items-center justify-between p-6">
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Gestión de Categorías</CardTitle>
            <CardDescription className="text-gray-600 mt-1">Administra las categorías de productos para tu empresa.</CardDescription>
          </div>
          {canModify && (
            <Button onClick={() => openForm()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md rounded-md px-4 py-2">
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Categoría
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {/* Contenedor flex para el input de búsqueda y el botón */}
          <div className="mb-4 flex items-center space-x-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar categorías por nombre..."
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
            <Button onClick={handleSearchClick} className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm rounded-md px-4 py-2">
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
                            onClick={() => handleDelete(categoria.id)}
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
        {/* Aplicando shadow-2xl y borde al DialogContent */}
        <DialogContent className="sm:max-w-[425px] p-6 rounded-lg shadow-2xl border border-indigo-200">
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
              <Input
                id="descripcion"
                name="descripcion"
                value={formData.descripcion || ''}
                onChange={handleInputChange}
                className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formErrors.descripcion && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.descripcion}</p>}
            </div>

            {/* Solo para SuperUsuario: Selector de Empresa */}
            {currentUser?.is_superuser && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="empresa" className="text-right text-gray-700">Empresa</Label>
                {/* Aquí necesitarías cargar las empresas para un select si el SuperUsuario puede asignar la categoría a cualquier empresa */}
                <Input
                  id="empresa"
                  name="empresa"
                  type="number"
                  value={formData.empresa || ''}
                  onChange={handleInputChange}
                  className="col-span-3 rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="ID de la empresa (solo SuperUsuario)"
                  required={currentUser?.is_superuser && !editingCategoria}
                />
                {formErrors.empresa && <p className="col-span-4 text-red-500 text-sm text-right">{formErrors.empresa}</p>}
              </div>
            )}

            {formErrors.general && <p className="col-span-4 text-red-500 text-sm text-center">{formErrors.general}</p>}

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={closeForm} disabled={createCategoriaMutation.isPending || updateCategoriaMutation.isPending} className="rounded-md px-4 py-2">
                Cancelar
              </Button>
              <Button type="submit" disabled={createCategoriaMutation.isPending || updateCategoriaMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md px-4 py-2 shadow-md">
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
    </div>
  );
};

export default Categorias;