export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'CLIENTE' | 'SUPERUSER' | 'ADMINISTRATIVO' | 'EMPLEADO';
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  date_joined: string;
  last_login: string | null;
  telefono?: string | null;
  ci?: string;
  direccion?: string;

  empresa?: number | null; 
  empresa_detail?: { 
    id: number;
    nombre: string;
    nit?: string | null;
    direccion?: string | null;
    telefono?: string | null;
    email_contacto?: string | null;
    logo?: string | null;
    fecha_registro: string;
    is_active: boolean;

  } | null;
  empresa_nombre?: string;
  suscripcion_id?: number;
}

// Interfaz para una respuesta paginada genérica
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export interface UserProfile {
  telefono?: string;
  ci?: string;
  direccion?: string;
 
}

// Exportamos la interfaz Empresa
export interface Empresa {
  id: number;
  nombre: string;
  nit?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email_contacto?: string | null;
  logo?: string | null;
  fecha_registro: string;
  is_active: boolean;
  suscripcion?: number | null; // ID de la suscripción
  suscripcion_detail?: any | null; // Puedes definir una interfaz Suscripcion más completa si es necesario
  admin_empresa?: number | null; // ID del admin de la empresa
  admin_empresa_detail?: { // Un subconjunto de User para evitar circularidad aquí
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}


export interface UserRegistrationData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  password2: string; 
  role: 'CLIENTE' | 'EMPLEADO' | 'ADMINISTRATIVO' | 'SUPERUSER';

  telefono?: string | null;
  ci?: string | null;
  direccion?: string | null;

  
  empresa?: number | null; 


  empresa_nombre?: string;
  empresa_nit?: string;
  suscripcion_id?: number;

  
}



export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User; // La respuesta de autenticación contendrá el objeto User actualizado
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
export type FilterParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
  categoria?: number; // Filtro para productos por categoría
  almacen?: number;   // Filtro para productos por almacén
  empresa?: number;   // Filtro genérico por empresa (útil para SuperUser)
  [key: string]: string | number | boolean | undefined; // Permite propiedades adicionales dinámicas
};

