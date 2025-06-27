// src/components/forms/RoleForm.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import api from '@/services/api';
import { Role, Permission } from '@/types/rbac';

import { CreateRolePayload, UpdateRolePayload } from '@/types/rbac';
import { Checkbox } from '@/components/ui/checkbox';

interface RoleFormProps {
  roleData?: Role | null; // Correcto: roleData
  onSuccess: () => void;  // Correcto: onSuccess (para cuando el formulario se envía y es exitoso)
  onCancel: () => void;   // Correcto: onCancel (para el botón de cancelar)
}

const RoleForm: React.FC<RoleFormProps> = ({ roleData, onSuccess, onCancel }) => { // Destructuración correcta
  const queryClient = useQueryClient();
  const initialFormData: Partial<Role> = {
    name: '',
    description: '',
    is_active: true,
    permissions: [],
  };
  const [formData, setFormData] = useState<Partial<Role>>(initialFormData);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const isEditing = !!roleData; // <-- CORREGIDO: Usar roleData

  // Cargar todos los permisos disponibles
  const { data: allPermissions, isLoading: isLoadingPermissions } = useQuery<Permission[], Error>({
    queryKey: ['allPermissions'],
    queryFn: async () => {
      const response = await api.fetchPermissions({ page_size: 1000 });
      return response.results;
    },
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (roleData) { // <-- CORREGIDO: Usar roleData
      setFormData({
        name: roleData.name, // <-- CORREGIDO: Usar roleData
        description: roleData.description, // <-- CORREGIDO: Usar roleData
        is_active: roleData.is_active, // <-- CORREGIDO: Usar roleData
        permissions: roleData.permissions || [], // <-- CORREGIDO: Usar roleData
      });
    } else {
      setFormData({
        name: '',
        description: '',
        is_active: true,
        permissions: [],
      });
      setFormErrors({});
    }
  }, [roleData]); // <-- CORREGIDO: Usar roleData como dependencia

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSwitchChange = (checked: boolean, name: string) => {
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handlePermissionChange = (permission: Permission, isChecked: boolean) => {
    setFormData((prev) => {
      const currentPermissions = prev.permissions || [];
      if (isChecked) {
        if (!currentPermissions.some(p => p.id === permission.id)) {
          return { ...prev, permissions: [...currentPermissions, permission] };
        }
      } else {
        return { ...prev, permissions: currentPermissions.filter(p => p.id !== permission.id) };
      }
      return prev;
    });
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name?.trim()) {
      errors.name = 'El nombre del rol es requerido.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const createRoleMutation = useMutation<Role, Error, CreateRolePayload>({
    mutationFn: async (payload) => {
      return api.createRole(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({ title: 'Rol creado', description: 'El rol ha sido creado exitosamente.' });
      onSuccess(); // <-- CORREGIDO: Llamar a onSuccess al crear
    },
    onError: (err: any) => {
      console.error("Error al crear rol:", err.response?.data || err.message);
      toast({
        variant: 'destructive',
        title: 'Error al crear rol',
        description: err.response?.data?.detail || 'No se pudo crear el rol.',
      });
      setFormErrors(err.response?.data?.errors || {});
    },
  });

  const updateRoleMutation = useMutation<Role, Error, { id: number; data: UpdateRolePayload }>({
    mutationFn: async ({ id, data }) => {
      return api.updateRole(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast({ title: 'Rol actualizado', description: 'El rol ha sido actualizado exitosamente.' });
      onSuccess(); // <-- CORREGIDO: Llamar a onSuccess al actualizar
    },
    onError: (err: any) => {
      console.error("Error al actualizar rol:", err.response?.data || err.message);
      toast({
        variant: 'destructive',
        title: 'Error al actualizar rol',
        description: err.response?.data?.detail || 'No se pudo actualizar el rol.',
      });
      setFormErrors(err.response?.data?.errors || {});
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    const basePayload = {
      name: formData.name!,
      description: formData.description!,
      is_active: formData.is_active!,
      permission_ids: formData.permissions?.map(p => p.id) || [],
    };

    if (isEditing && roleData) { // <-- CORREGIDO: Usar roleData
      updateRoleMutation.mutate({
        id: roleData.id!, // <-- CORREGIDO: Usar roleData y asumir que id existe en edición
        data: basePayload
      });
    } else {
      createRoleMutation.mutate(basePayload);
    }
  };
  const isSaving = createRoleMutation.isPending || updateRoleMutation.isPending;

  return (
    <DialogContent className="sm:max-w-[600px] bg-card text-card-foreground">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Rol' : 'Crear Nuevo Rol'}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="name" className="text-right">
            Nombre del Rol
          </Label>
          <Input
            id="name"
            name="name"
            value={formData.name || ''}
            onChange={handleInputChange}
            className="col-span-3 bg-input border-input"
            required
          />
          {formErrors.name && <p className="col-span-4 text-destructive text-sm text-right">{formErrors.name}</p>}
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
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="is_active" className="text-right">
            Activo
          </Label>
          <Switch
            id="is_active"
            name="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => handleSwitchChange(checked, 'is_active')}
            disabled={isSaving}
            className="col-span-3"
          />
        </div>

        {/* Selección de Permisos */}
        <div className="grid grid-cols-4 items-start gap-4 mt-4">
          <Label htmlFor="permissions" className="text-right pt-2">
            Permisos
          </Label>
          <div className="col-span-3 grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {isLoadingPermissions ? (
              <div className="col-span-2 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Cargando permisos...
              </div>
            ) : allPermissions && allPermissions.length > 0 ? (
              allPermissions.map((permission) => (
                <div key={permission.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`perm-${permission.id}`}
                    checked={formData.permissions?.some(p => p.id === permission.id)}
                    onCheckedChange={(checked) => handlePermissionChange(permission, Boolean(checked))}
                  />
                  <Label htmlFor={`perm-${permission.id}`} className="text-sm font-normal cursor-pointer">
                    {permission.name}
                  </Label>
                </div>
              ))
            ) : (
              <p className="col-span-2 text-muted-foreground text-sm">No hay permisos disponibles.</p>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 flex-col sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving} className="w-full sm:w-auto"> {/* <-- CORREGIDO: Usar onCancel */}
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              isEditing ? 'Guardar Cambios' : 'Crear Rol'
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default RoleForm;