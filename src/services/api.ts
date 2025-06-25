import axios from 'axios';
// Importa las interfaces para los modelos de tu ERP desde el archivo de tipos correcto
import { LoginCredentials, AuthResponse, User, UserRegistrationData } from '@/types/auth'; // Asegúrate de que User y UserRegistrationData estén aquí
import { Empresa } from '../types/empresas'; // Asumo que Empresa tiene su propio archivo de tipos
import { Suscripcion } from '@/types/suscripciones';
import { Sucursal } from '@/types/sucursales';
import { Almacen } from '@/types/almacenes';
import { Categoria } from '@/types/categorias';
import { Producto } from '@/types/productos';

import { Venta, DetalleVenta } from '@/types/ventas';

// ** INTERFACES DE DATOS DEL DASHBOARD **

// Interfaz para el tipo de actividad reciente
export interface RecentActivity {
  id: string; // O number
  description: string;
  timestamp: string; // Fecha y hora del evento (formato ISO 8601)
  type: 'login' | 'product_update' | 'order_created' | 'user_created' | 'alert' | string; // Tipo de evento
  user_name?: string; // Usuario asociado al evento
  entity_name?: string; // Nombre de la entidad afectada (ej. nombre del producto)
}

// Interfaz para la distribución por categoría
export interface CategoryDistribution {
  name: string; // Nombre de la categoría
  products_count: number; // Cantidad de productos en esa categoría
}

// Interfaz para el detalle de inventario por almacén
export interface WarehouseInventory {
  name: string; // Nombre del almacén
  total_value: number; // Valor total del inventario en ese almacén
  product_count: number; // Cantidad de productos únicos en ese almacén
}


export interface DashboardERPMetrics {
  total_empresas: number;
  total_usuarios: number;
  total_sucursales: number;
  total_almacenes: number;
  total_categorias: number;
  total_productos: number;
  valor_total_inventario: string; // O number, si tu backend lo devuelve como número
  productos_bajo_stock: string[]; // Un array de nombres de productos
  distribucion_suscripciones: Array<{ plan_nombre: string; cantidad_empresas: number; }>;
  
  monthly_sales?: Array<{ name: string; Ventas: number; }>; // Ventas mensuales
  top_products?: Array<{ name: string; sales: number; units: number; }>; // Productos más vendidos

  // NUEVAS PROPIEDADES
  category_distribution?: CategoryDistribution[]; // Distribución de productos por categoría
  inventory_by_warehouse?: WarehouseInventory[]; // Detalle de inventario por almacén
  recent_activities?: RecentActivity[];           // Feed de actividad reciente
}


export type FilterParams = {
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
  categoria?: number; // Filtro para productos por categoría
  almacen?: number;   // Filtro para productos por almacén
  empresa?: number;   // Filtro genérico por empresa (útil para SuperUser)
  [key: string]: string | number | boolean | undefined;
};

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Configuración base de Axios
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // Usamos la variable de entorno para la URL base
  timeout: 30000, // 30 segundos
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token de acceso a las solicitudes
axiosInstance.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      if (config.headers) { // Asegurarse de que config.headers no es undefined
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar la expiración del token y refrescarlo
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Manejar timeout específicamente
    if (error.code === 'ECONNABORTED') {
      console.error('Tiempo de espera agotado para la solicitud:', originalRequest.url);
      return Promise.reject({
        ...error,
        message: 'El servidor está tardando demasiado en responder. Por favor, inténtelo de nuevo más tarde.'
      });
    }

    // Si el error es 401 (Unauthorized) y no es una solicitud de refresh token, y no es un reintento
    if (error.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/usuarios/login/refresh/')) { // CAMBIO: Ruta de refresh
      
      originalRequest._retry = true; // Marca la solicitud como reintentada

      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          // Intenta refrescar el token
          const response = await axiosInstance.post(
            `${import.meta.env.VITE_API_URL}usuarios/login/refresh/`, // CAMBIO: Ruta de refresh
            { refresh: refreshToken },
            { timeout: 15000 } // Timeout específico para refresh token
          );

          if (response.data.access) {
            const newAccessToken = response.data.access;
            const newRefreshToken = response.data.refresh; // Si el refresh token también cambia

            localStorage.setItem('accessToken', newAccessToken);
            localStorage.setItem('refreshToken', newRefreshToken);

            // Reintenta la solicitud original con el nuevo token
            if (originalRequest.headers) { // Asegurarse de que originalRequest.headers no es undefined
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            }
            return axiosInstance(originalRequest);
          }
        } catch (refreshError) {
          console.error("Error al refrescar el token:", refreshError);
          // Si falla el refresh, cierra la sesión del usuario
          localStorage.clear();
          localStorage.removeItem('user'); // Asegúrate de limpiar también los datos del usuario
          window.dispatchEvent(new CustomEvent('auth:logout')); // Dispatch un evento para el contexto de Auth
          window.location.href = '/login'; // Redirecciona al login
          return Promise.reject({
            ...error,
            message: 'Su sesión ha expirado. Por favor, inicie sesión de nuevo.'
          });
        }
      } else {
        // No hay refresh token, cierra sesión
        localStorage.clear();
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        window.location.href = '/login';
        return Promise.reject({
            ...error,
            message: 'No hay sesión activa. Por favor, inicie sesión.'
          });
      }
    }

    // Manejo específico de errores de red
    if (!error.response) {
        console.error('Error de red o servidor no disponible');
        return Promise.reject({
            ...error,
            message: 'No se puede conectar con el servidor. Verifique su conexión a internet.'
        });
    }

    // Propagar el error si no se puede manejar
    return Promise.reject(error);
  }
);

// Función auxiliar para normalizar respuestas no paginadas
const normalizePaginatedResponse = <T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> => {
  if (data && typeof data === 'object' && 'results' in data) { // Añadido typeof data === 'object'
    return data;
  }
  return {
    count: Array.isArray(data) ? data.length : 0,
    next: null,
    previous: null,
    results: Array.isArray(data) ? data : [],
  };
};

// Métodos de la API
const api = {
  
  // --- Autenticación y Perfil de Usuario ---
  login: (credentials: LoginCredentials): Promise<AuthResponse> =>
    axiosInstance.post('/usuarios/login/', credentials).then(res => res.data), // CAMBIO: /usuarios/login/
  refreshToken: (refresh: string): Promise<AuthResponse> =>
    axiosInstance.post('/usuarios/login/refresh/', { refresh }).then(res => res.data), // CAMBIO: /usuarios/login/refresh/
  register: (userData: UserRegistrationData): Promise<User> =>
    axiosInstance.post('/usuarios/registro/', userData).then(res => res.data), // CAMBIO: /usuarios/registro/
  fetchUserProfile: (): Promise<User> =>
    axiosInstance.get('/usuarios/perfil/').then(res => res.data), // CAMBIO: /usuarios/perfil/
  updateUserProfile: (userData: Partial<User>): Promise<User> =>
    axiosInstance.put('/usuarios/perfil/', userData).then(res => res.data), // CAMBIO: /usuarios/perfil/

  // --- Gestión de Usuarios (Admin) ---
  fetchUsuarios: (params?: FilterParams): Promise<PaginatedResponse<User>> =>
    axiosInstance.get('/usuarios/admin/lista/', { params }).then(res => normalizePaginatedResponse(res.data)), // CAMBIO: /usuarios/admin/lista/
  createUsuario: (userData: UserRegistrationData): Promise<User> =>
    axiosInstance.post('/usuarios/registro/', userData).then(res => res.data), // Reutiliza el endpoint de registro para admin
  adminUpdateUsuario: (userId: number, userData: Partial<User>): Promise<User> => // Aseguramos el tipo de retorno a User
    axiosInstance.put(`/usuarios/admin/${userId}/`, userData).then(res => res.data), // CAMBIO: /usuarios/admin/${userId}/
  deleteUsuario: (userId: number): Promise<void> =>
    axiosInstance.delete(`/usuarios/admin/${userId}/`).then(() => {}),

  // --- Funciones para Empresas ---
  fetchEmpresas: (params?: FilterParams): Promise<PaginatedResponse<Empresa>> =>
    axiosInstance.get('/empresas/', { params }).then(res => normalizePaginatedResponse(res.data)),
  getEmpresaById: (id: number): Promise<Empresa> =>
    axiosInstance.get(`/empresas/${id}/`).then(res => res.data),
  
  createEmpresa: (empresaData: FormData): Promise<Empresa> =>
    axiosInstance.post<Empresa>('/empresas/', empresaData).then(res => res.data),

  updateEmpresa: (empresaId: number, empresaData: FormData): Promise<Empresa> =>
    axiosInstance.put<Empresa>(`/empresas/${empresaId}/`, empresaData).then(res => res.data),
  
  deleteEmpresa: (empresaId: number): Promise<void> =>
    axiosInstance.delete(`/empresas/${empresaId}/`).then(() => {}),

  // --- Funciones para Suscripciones ---
  fetchSuscripciones: (params?: FilterParams): Promise<PaginatedResponse<Suscripcion>> =>
    axiosInstance.get('/suscripciones/', { params }).then(res => normalizePaginatedResponse(res.data)),
  getSuscripcionById: (id: number): Promise<Suscripcion> =>
    axiosInstance.get(`/suscripciones/${id}/`).then(res => res.data),
  createSuscripcion: (suscripcionData: Omit<Suscripcion, 'id'>): Promise<Suscripcion> =>
    axiosInstance.post('/suscripciones/', suscripcionData).then(res => res.data),
  updateSuscripcion: (suscripcionId: number, suscripcionData: Partial<Suscripcion>): Promise<Suscripcion> =>
    axiosInstance.put(`/suscripciones/${suscripcionId}/`, suscripcionData).then(res => res.data),
  deleteSuscripcion: (suscripcionId: number): Promise<void> =>
    axiosInstance.delete(`/suscripciones/${suscripcionId}/`).then(() => {}),

  // --- Funciones para Sucursales ---
  fetchSucursales: (params?: FilterParams): Promise<PaginatedResponse<Sucursal>> =>
    axiosInstance.get('/sucursales/', { params }).then(res => normalizePaginatedResponse(res.data)),
  getSucursalById: (id: number): Promise<Sucursal> =>
    axiosInstance.get(`/sucursales/${id}/`).then(res => res.data),
  createSucursal: (sucursalData: Omit<Sucursal, 'id' | 'empresa_detail'>): Promise<Sucursal> =>
    axiosInstance.post('/sucursales/', sucursalData).then(res => res.data),
  updateSucursal: (sucursalId: number, sucursalData: Partial<Omit<Sucursal, 'empresa_detail'>>): Promise<Sucursal> =>
    axiosInstance.put(`/sucursales/${sucursalId}/`, sucursalData).then(res => res.data),
  deleteSucursal: (sucursalId: number): Promise<void> =>
    axiosInstance.delete(`/sucursales/${sucursalId}/`).then(() => {}),

  // --- Funciones para Almacenes ---
  fetchAlmacenes: (params?: FilterParams): Promise<PaginatedResponse<Almacen>> =>
    axiosInstance.get('/almacenes/', { params }).then(res => normalizePaginatedResponse(res.data)),
  getAlmacenById: (id: number): Promise<Almacen> =>
    axiosInstance.get(`/almacenes/${id}/`).then(res => res.data),
  createAlmacen: (almacenData: Omit<Almacen, 'id' | 'sucursal_detail' | 'empresa_detail'>): Promise<Almacen> =>
    axiosInstance.post('/almacenes/', almacenData).then(res => res.data),
  updateAlmacen: (almacenId: number, almacenData: Partial<Omit<Almacen, 'sucursal_detail' | 'empresa_detail'>>): Promise<Almacen> =>
    axiosInstance.put(`/almacenes/${almacenId}/`, almacenData).then(res => res.data),
  deleteAlmacen: (almacenId: number): Promise<void> =>
    axiosInstance.delete(`/almacenes/${almacenId}/`).then(() => {}),

  // --- Funciones para Categorías ---
  fetchCategorias: (params?: FilterParams): Promise<PaginatedResponse<Categoria>> =>
    axiosInstance.get('/categorias/', { params }).then(res => normalizePaginatedResponse(res.data)),
  getCategoriaById: (id: number): Promise<Categoria> =>
    axiosInstance.get(`/categorias/${id}/`).then(res => res.data),
  createCategoria: (categoriaData: Omit<Categoria, 'id' | 'empresa_detail'>): Promise<Categoria> =>
    axiosInstance.post('/categorias/', categoriaData).then(res => res.data),
  updateCategoria: (categoriaId: number, categoriaData: Partial<Omit<Categoria, 'empresa_detail'>>): Promise<Categoria> =>
    axiosInstance.put(`/categorias/${categoriaId}/`, categoriaData).then(res => res.data),
  deleteCategoria: (categoriaId: number): Promise<void> =>
    axiosInstance.delete(`/categorias/${categoriaId}/`).then(() => {}),

  // --- Funciones para Productos ---
  fetchProductos: (params?: FilterParams): Promise<PaginatedResponse<Producto>> =>
    axiosInstance.get('/productos/', { params }).then(res => normalizePaginatedResponse(res.data)),
  getProductoById: (id: number): Promise<Producto> =>
    axiosInstance.get(`/productos/${id}/`).then(res => res.data),
  createProducto: async (productoData: Partial<Producto>): Promise<Producto> => {
    const formData = new FormData();
    for (const key in productoData) {
      if (productoData[key as keyof Partial<Producto>] !== undefined && productoData[key as keyof Partial<Producto>] !== null) {
        if (key === 'imagen' && productoData.imagen instanceof File) {
          formData.append(key, productoData.imagen);
        } else if (key !== 'imagen') { // Solo añadir si no es la imagen y no es null/undefined
          formData.append(key, String(productoData[key as keyof Partial<Producto>]));
        }
      }
    }
    const response = await axiosInstance.post<Producto>('/productos/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  updateProducto: async (productoId: number, productoData: Partial<Producto>): Promise<Producto> => {
    const formData = new FormData();
    for (const key in productoData) {
      if (productoData[key as keyof Partial<Producto>] !== undefined) { // Permite explícitamente enviar null si se borra la imagen
        if (key === 'imagen' && productoData.imagen instanceof File) {
          formData.append(key, productoData.imagen);
        } else if (key === 'imagen' && productoData.imagen === null) {
          formData.append(key, ''); // Envía cadena vacía para indicar eliminación o null si el backend lo soporta
        } else if (key !== 'imagen') {
          formData.append(key, String(productoData[key as keyof Partial<Producto>]));
        }
      }
    }
    const response = await axiosInstance.put<Producto>(`/productos/${productoId}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  deleteProducto: (productoId: number): Promise<void> =>
    axiosInstance.delete(`/productos/${productoId}/`).then(() => {}),

  // --- Funciones de Dashboard ---
  fetchDashboardData: (params?: FilterParams): Promise<DashboardERPMetrics> =>
    axiosInstance.get('/dashboard/', { params }).then(res => res.data),

  // === NUEVAS FUNCIONES PARA VENTAS ===
  fetchVentas: (params?: FilterParams): Promise<PaginatedResponse<Venta>> =>
    axiosInstance.get('/ventas/ventas/', { params }).then(res => normalizePaginatedResponse(res.data)),
  getVentaById: (id: number): Promise<Venta> =>
    axiosInstance.get(`/ventas/ventas/${id}/`).then(res => res.data),
  createVenta: (ventaData: Venta): Promise<Venta> => // ventaData debe tener el tipo Venta
    axiosInstance.post('/ventas/ventas/', ventaData).then(res => res.data),
  updateVenta: (id: number, ventaData: Partial<Venta>): Promise<Venta> => // ventaData puede ser parcial al actualizar
    axiosInstance.put(`/ventas/ventas/${id}/`, ventaData).then(res => res.data),
  deleteVenta: (id: number): Promise<void> =>
    axiosInstance.delete(`/ventas/ventas/${id}/`).then(() => {}),
};

export default api;