import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import api from '@/services/api';
import { Permission, CreatePermissionPayload, UpdatePermissionPayload } from '@/types/rbac';

interface PermissionFormProps {
  permissionToEdit?: Permission | null; // Si se proporciona, es modo edición
  onClose: () => void;
}

const PermissionForm: React.FC<PermissionFormProps> = ({ permissionToEdit, onClose }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Permission>>({
    name: '',
    code_name: '',
    description: '',
    is_active: true,
  });
  // formErrors debería mapear nombres de campo a arrays de strings para mensajes
  const [formErrors, setFormErrors] = useState<{ [key: string]: string[] }>({}); 

  const isEditing = !!permissionToEdit;

  useEffect(() => {
    if (permissionToEdit) {
      setFormData({
        name: permissionToEdit.name,
        // Asumiendo que el backend envía 'code_name' y no 'code_name'
        code_name: permissionToEdit.code_name, 
        description: permissionToEdit.description,
        is_active: permissionToEdit.is_active,
      });
    } else {
      setFormData({
        name: '',
        code_name: '',
        description: '',
        is_active: true,
      });
    }
    setFormErrors({}); // Siempre limpia errores al cambiar de modo o abrir
  }, [permissionToEdit]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Limpia el error para el campo específico cuando el usuario empieza a escribir
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSwitchChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, is_active: checked }));
  };

  // Validación básica del frontend
  const validateForm = () => {
    const errors: { [key: string]: string[] } = {}; // Ahora un array de strings
    if (!formData.name?.trim()) {
      errors.name = ['El nombre del permiso es requerido.'];
    }
    if (!formData.code_name?.trim()) {
      errors.code_name = ['El código del permiso es requerido.'];
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createPermissionMutation = useMutation<Permission, Error, CreatePermissionPayload>({
    mutationFn: async (newPermission) => api.createPermission(newPermission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      toast({ title: 'Permiso creado', description: 'El permiso ha sido creado exitosamente.' });
      onClose();
    },
    onError: (err: any) => {
      console.error("Error al crear permiso:", err.response?.data || err.message);
      const errorData = err.response?.data;
      if (errorData) {
        const backendErrors: { [key: string]: string[] } = {};
        // Itera sobre los errores del backend para mapearlos a nuestro estado de formErrors
        Object.entries(errorData).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            backendErrors[field] = messages;
            messages.forEach(msg => { // Muestra un toast por cada mensaje de error
                let fieldDisplayName = field;
                if (field === 'name') fieldDisplayName = 'Nombre';
                if (field === 'code_name') fieldDisplayName = 'Código';
                // Puedes añadir más traducciones si es necesario
                toast({
                    variant: 'destructive',
                    title: `Error en ${fieldDisplayName}`,
                    description: msg,
                });
            });
          }
        });
        setFormErrors(backendErrors); // Actualiza el estado de errores para mostrar en el formulario
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al crear permiso',
          description: err.message || 'No se pudo crear el permiso.',
        });
      }
    },
  });

  const updatePermissionMutation = useMutation<Permission, Error, { id: number; data: UpdatePermissionPayload }>({
    mutationFn: async ({ id, data }) => api.updatePermission(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      toast({ title: 'Permiso actualizado', description: 'El permiso ha sido actualizado exitosamente.' });
      onClose();
    },
    onError: (err: any) => {
      console.error("Error al actualizar permiso:", err.response?.data || err.message);
      const errorData = err.response?.data;
      if (errorData) {
        const backendErrors: { [key: string]: string[] } = {};
        Object.entries(errorData).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            backendErrors[field] = messages;
            messages.forEach(msg => {
                let fieldDisplayName = field;
                if (field === 'name') fieldDisplayName = 'Nombre';
                if (field === 'code_name') fieldDisplayName = 'Código';
                toast({
                    variant: 'destructive',
                    title: `Error en ${fieldDisplayName}`,
                    description: msg,
                });
            });
          }
        });
        setFormErrors(backendErrors);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error al actualizar permiso',
          description: err.message || 'No se pudo actualizar el permiso.',
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    const payload: CreatePermissionPayload = {
      name: formData.name || '',
      code_name: formData.code_name || '',
      description: formData.description === '' ? null : formData.description,
      is_active: formData.is_active ?? true, // Usa nullish coalescing para asegurar booleano
    };

    if (isEditing && permissionToEdit) {
      updatePermissionMutation.mutate({
        id: permissionToEdit.id,
        data: payload as UpdatePermissionPayload,
      });
    } else {
      createPermissionMutation.mutate(payload);
    }
  };

  const isSaving = createPermissionMutation.isPending || updatePermissionMutation.isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Permiso' : 'Crear Nuevo Permiso'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">
            Nombre
          </Label>
          <Input
            id="name"
            name="name"
            value={formData.name || ''}
            onChange={handleInputChange}
            className="col-span-3 bg-input border-input"
            required // Añade required para validación HTML5 básica
          />
          {/* Muestra el primer error si hay múltiples */}
          {formErrors.name && formErrors.name.length > 0 && (
            <p className="col-span-4 text-destructive text-sm text-right">{formErrors.name[0]}</p>
          )}
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="code_name" className="text-right">
            Código
          </Label>
          <Input
            id="code_name"
            name="code_name"
            value={formData.code_name || ''}
            onChange={handleInputChange}
            className="col-span-3 bg-input border-input"
            required // Añade required
          />
          {formErrors.code_name && formErrors.code_name.length > 0 && (
            <p className="col-span-4 text-destructive text-sm text-right">{formErrors.code_name[0]}</p>
          )}
        </div>
        <div className="grid grid-cols-4 items-start gap-4">
          <Label htmlFor="description" className="text-right pt-2">
            Descripción
          </Label>
          <Textarea
            id="description"
            name="description"
            value={formData.description || ''}
            onChange={handleInputChange}
            className="col-span-3 bg-input border-input min-h-[80px]"
          />
          {/* Si tienes validaciones para descripción, muéstralas aquí también */}
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="is_active" className="text-right">
            Activo
          </Label>
          <Switch
            id="is_active"
            name="is_active"
            checked={formData.is_active ?? true} // Usa nullish coalescing
            onCheckedChange={handleSwitchChange}
            disabled={isSaving}
            className="col-span-3"
          />
        </div>

        <DialogFooter className="pt-4 flex-col sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              isEditing ? 'Guardar Cambios' : 'Crear Permiso'
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

export default PermissionForm;