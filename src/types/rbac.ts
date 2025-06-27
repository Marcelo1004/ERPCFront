export interface Permission {
  id: number;
  code_name: string;
  name: string; 
  description: string;
  is_active: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}
export type CreateRolePayload = Omit<Role, "id" | "fecha_creacion" | "fecha_actualizacion" | "permissions"> & { permission_ids: number[]; };
export type UpdateRolePayload = Partial<Omit<Role, "id" | "fecha_creacion" | "fecha_actualizacion" | "permissions">> & { permission_ids?: number[]; };
export type UserRoleName = 'Cliente' | 'Empleado' | 'Administrador' | 'Super Usuario' | '';


export interface Role {
  id: number;
  name: UserRoleName; 
  description: string;
  is_active: boolean;
  permissions: Permission[]; 
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface CreatePermissionPayload {
  name: string;
  code_name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdatePermissionPayload {
  name?: string;
  code_name?: string;
  description?: string;
  is_active?: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export interface FilterParams {
  page?: number;
  page_size?: number;
  search?: string;
  [key: string]: any; // Para permitir otros filtros dinámicos
}