// src/types/auth.ts

// Asegúrate de que estas importaciones sean correctas y los archivos existan
import { Role } from './rbac';
import { Empresa } from './empresas';
import { Suscripcion } from './suscripciones'; // Asumiendo que Suscripcion tiene su propio archivo de tipo

/**
 * @interface User
 * @description Define la estructura de los datos de un usuario tal como se reciben del backend.
 */
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;

  role: Role | null; // El rol se recibe como un objeto Role completo

  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;

  date_joined: string; // ISO 8601 string
  last_login: string | null; // ISO 8601 string o null

  telefono: string | null; // Se eliminó '?' para hacerlos siempre presentes, pero pueden ser null
  ci: string | null;
  direccion: string | null;

  empresa: number | null; // ID de la empresa a la que pertenece el usuario
  empresa_detail: Empresa | null; // Detalles completos de la empresa (cuando se expande)

  // Campos opcionales para la creación de una NUEVA empresa por un SuperUser al crear un Administrador
  empresa_nombre?: string;
  empresa_nit?: string;
  suscripcion_id?: number; // ID de la suscripción para la nueva empresa
}

/**
 * @interface UserCreationData
 * @description Define la estructura de los datos para crear un nuevo usuario.
 * Incluye campos relacionados con la creación opcional de una nueva empresa.
 */
export interface UserCreationData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  password2: string; // Para confirmación de contraseña en el frontend
  role: number | null; // El rol se envía como ID numérico

  telefono?: string | null;
  ci: string | null; // CI es generalmente requerido, se quita '?'
  direccion?: string | null;

  empresa?: number | null; // ID de una empresa existente a la que vincular (opcional si se crea nueva empresa)

  // Campos para la creación de una nueva empresa (solo relevantes para SuperUser creando un Admin)
  empresa_nombre?: string;
  empresa_nit?: string;
  suscripcion_id?: number;

  // Flags de permisos (opcionales, solo un SuperUser puede enviarlos)
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
}

/**
 * @interface UserUpdateData
 * @description Define la estructura de los datos para actualizar un usuario existente.
 * Todos los campos son opcionales ya que solo se envían los que se modifican.
 */
export interface UserUpdateData {
  first_name?: string;
  last_name?: string;
  telefono?: string | null;
  ci?: string | null;
  direccion?: string | null;
  role?: number | null; // El rol se envía como ID numérico
  empresa?: number | null; // La empresa se envía como ID numérico

  password?: string; // Para cambiar contraseña
  password2?: string; // Para confirmar nueva contraseña

  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
}

/**
 * @interface PaginatedResponse
 * @description Interfaz genérica para manejar respuestas paginadas de la API.
 * @template T El tipo de los elementos en la lista `results`.
 */
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * @interface LoginCredentials
 * @description Credenciales necesarias para iniciar sesión.
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * @interface AuthResponse
 * @description Respuesta de la API después de un inicio de sesión exitoso.
 */
export interface AuthResponse {
  access: string;
  refresh: string;
  user: User; // El objeto User completo del usuario logueado
}

/**
 * @interface AuthState
 * @description Define la estructura del estado de autenticación de la aplicación.
 */
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * @interface FilterParams
 * @description Define los parámetros de filtro genéricos para las peticiones a la API.
 */
export interface FilterParams {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
  categoria?: number;
  almacen?: number;
  empresa?: number;
  role?: number;
  role_name?: string;
  // Permite añadir otras propiedades de tipo string, number o boolean de forma dinámica.
  [key: string]: string | number | boolean | undefined;
}