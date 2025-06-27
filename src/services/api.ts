import axios from 'axios';
import { LoginCredentials, AuthResponse, User, UserCreationData, UserUpdateData } from '@/types/auth'; 
import { Empresa } from '../types/empresas'; 
import { Suscripcion } from '@/types/suscripciones';
import { Sucursal } from '@/types/sucursales';
import { Almacen } from '@/types/almacenes';
import { Categoria } from '@/types/categorias';
import { Producto } from '@/types/productos';
import { CreatePermissionPayload, UpdatePermissionPayload } from '@/types/rbac'; 
import { Pago } from '@/types/pagos';

import { Venta } from '@/types/ventas';
import { Permission, Role } from '@/types/rbac'; 
import { Proveedor, ProveedorFormData, ProveedorFilters } from '@/types/proveedores'; 
import { Movimiento, MovimientoFormData, MovimientoFilters } from '@/types/movimientos';

import { 
    ReportFilters,
    SalesSummaryReportData,
    TopSellingProductReportData,
    StockLevelReportData,
    ClientPerformanceReportData
} from '@/types/reports';

// 1. Crea la instancia base de Axios
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- INTERFACES DE DATOS GENERALES ---

// Interfaz para parámetros de filtro generales
// Añadimos la firma de índice y el tipo literal para 'estado'
export interface FilterParams {
    page?: number;
    page_size?: number;
    search?: string;
    empresa?: number | string; // Allow string "all" for frontend but handled in ReportsPage
    proveedor?: number;
    almacen_destino?: number;
    estado?: 'Pendiente' | 'Aceptado' | 'Rechazado' | string; // Allow string "all" for frontend
    [key: string]: any; // Permite propiedades adicionales sin declararlas explícitamente
}



interface EmpresaMarketplace {
  id: number;
  nombre: string;
  descripcion_corta?: string;
  direccion?: string;
}

interface ProductoList {
  id: number;
  nombre: string;
  precio: string; // Use string for DecimalField to avoid precision issues
  stock: number;
}

interface ProductoDetail {
  id: number;
  empresa: number; // ID de la empresa
  empresa_nombre: string;
  categoria?: number; // ID de la categoría
  nombre: string;
  descripcion?: string;
  precio: string;
  stock: number;
  is_active: boolean;
}

interface DemandaPredictivaResponse {
  producto_id: number;
  producto_nombre: string;
  prediccion_demanda_proximos_dias: number;
  confianza_prediccion: number; // Percentage, e.g., 85.50
  fecha_prediccion: string;
  explicacion_simplificada: string;
  beneficio_erp: string;
}



// Interfaz para respuestas paginadas estándar
export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

// Interfaz para el tipo de actividad reciente del dashboard
export interface RecentActivity {
    id: string; // O number
    description: string;
    timestamp: string; // Fecha y hora del evento (formato ISO 8601)
    type: 'login' | 'product_update' | 'order_created' | 'user_created' | 'alert' | string; // Tipo de evento
    user_name?: string; // Usuario asociado al evento
    entity_name?: string; // Nombre de la entidad afectada (ej. nombre del producto)
}

// Interfaz para la distribución por categoría del dashboard
export interface CategoryDistribution {
    name: string; // Nombre de la categoría
    products_count: number; // Cantidad de productos en esa categoría
}

// Interfaz para el detalle de inventario por almacén del dashboard
export interface WarehouseInventory {
    name: string; // Nombre del almacén
    total_value: number; // Valor total del inventario en ese almacén
    product_count: number; // Cantidad de productos únicos en ese almacén
}

// Interfaz para las métricas del dashboard ERP
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
    total_proveedores: number;
    
    monthly_sales?: Array<{ name: string; Ventas: number; }>; // Ventas mensuales
    top_products?: Array<{ name: string; sales: number; units: number; }>; // Productos más vendidos

    category_distribution?: CategoryDistribution[]; // Distribución de productos por categoría
    inventory_by_warehouse?: WarehouseInventory[]; // Detalle de inventario por almacén
    recent_activities?: RecentActivity[];           // Feed de actividad reciente
}


// --- INTERCEPTORS DE AXIOS ---

// Interceptor para añadir el token de acceso a las solicitudes
axiosInstance.interceptors.request.use(
    (config) => {
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
            if (config.headers) { 
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

        if (error.code === 'ECONNABORTED') {
            console.error('Tiempo de espera agotado para la solicitud:', originalRequest.url);
            return Promise.reject({
                ...error,
                message: 'El servidor está tardando demasiado en responder. Por favor, inténtelo de nuevo más tarde.'
            });
        }

        if (error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/usuarios/login/refresh/')) {
            
            originalRequest._retry = true; 

            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
                try {
                    const response = await axiosInstance.post(
                        `${API_BASE_URL}/usuarios/login/refresh/`, // Usar API_BASE_URL aquí
                        { refresh: refreshToken },
                        { timeout: 15000 } 
                    );

                    if (response.data.access) {
                        const newAccessToken = response.data.access;
                        const newRefreshToken = response.data.refresh; 

                        localStorage.setItem('accessToken', newAccessToken);
                        localStorage.setItem('refreshToken', newRefreshToken);

                        if (originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                        }
                        return axiosInstance(originalRequest);
                    }
                } catch (refreshError) {
                    console.error("Error al refrescar el token:", refreshError);
                    localStorage.clear();
                    localStorage.removeItem('user'); 
                    window.dispatchEvent(new CustomEvent('auth:logout')); 
                    window.location.href = '/login'; 
                    return Promise.reject({
                        ...error,
                        message: 'Su sesión ha expirado. Por favor, inicie sesión de nuevo.'
                    });
                }
            } else {
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

        if (!error.response) {
            console.error('Error de red o servidor no disponible');
            return Promise.reject({
                ...error,
                message: 'No se puede conectar con el servidor. Verifique su conexión a internet.'
            });
        }

        return Promise.reject(error);
    }
);

// Función auxiliar para normalizar respuestas no paginadas a formato paginado
const normalizePaginatedResponse = <T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> => {
    if (data && typeof data === 'object' && 'results' in data) { 
        return data as PaginatedResponse<T>;
    }
    return {
        count: Array.isArray(data) ? data.length : 0,
        next: null,
        previous: null,
        results: Array.isArray(data) ? data : [],
    };
};

// --- Función auxiliar para construir la cadena de query params para descargas ---
// Esta función ahora solo construye el path, los filtros serán manejados por Axios
// cuando se haga la petición GET para el reporte.
const buildReportDownloadPath = (basePath: string, filters: ReportFilters): string => {
    const params = new URLSearchParams();
    for (const key in filters) {
        // Only append if the value is not undefined, null, or an empty string, AND not 'all'
        const value = filters[key as keyof ReportFilters];
        if (value !== undefined && value !== null && String(value).trim() !== '' && String(value).toLowerCase() !== 'all') {
            params.append(key, String(value));
        }
    }
    return `${basePath}${params.toString() ? `?${params.toString()}` : ''}`;
};


// --- OBJETO API CON TODOS LOS MÉTODOS CONSOLIDADOS ---
const api = {
    // Exponer la baseURL para que el frontend pueda construir URLs completas para descargas
    baseURL: API_BASE_URL,

    // --- Autenticación y Perfil de Usuario ---
    login: (credentials: LoginCredentials): Promise<AuthResponse> =>
        axiosInstance.post('/usuarios/login/', credentials).then(res => res.data),
    refreshToken: (refresh: string): Promise<AuthResponse> =>
        axiosInstance.post('/usuarios/login/refresh/', { refresh }).then(res => res.data),
    register: (userData: UserCreationData): Promise<User> =>
        axiosInstance.post('/usuarios/registro/', userData).then(res => res.data),
    fetchUserProfile: (): Promise<User> =>
        axiosInstance.get('/usuarios/perfil/').then(res => res.data),
    updateUserProfile: (userData: Partial<User>): Promise<User> =>
        axiosInstance.put('/usuarios/perfil/', userData).then(res => res.data),

    // --- Gestión de Usuarios (Admin) ---
    fetchUsuarios: (params?: FilterParams): Promise<PaginatedResponse<User>> =>
        axiosInstance.get('/users/', { params }).then(res => normalizePaginatedResponse(res.data)),
    createUsuario: (userData: UserCreationData): Promise<User> =>
        axiosInstance.post('/users/', userData).then(res => res.data),
    adminUpdateUsuario: (userId: number, userData: UserUpdateData): Promise<User> => {
        return axiosInstance.put<User>(`/users/${userId}/`, userData).then(res => res.data);
    },
    deleteUsuario: (userId: number): Promise<void> =>
        axiosInstance.delete(`/users/${userId}/`).then(() => {}),

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

    // --- Funciones para Proveedores ---
    fetchProveedores: (filters?: ProveedorFilters): Promise<PaginatedResponse<Proveedor>> =>
        axiosInstance.get('/proveedores/', { params: filters }).then(res => normalizePaginatedResponse(res.data)),
    getProveedorById: (id: number): Promise<Proveedor> =>
        axiosInstance.get(`/proveedores/${id}/`).then(res => res.data),
    createProveedor: (proveedorData: ProveedorFormData): Promise<Proveedor> =>
        axiosInstance.post('/proveedores/', proveedorData).then(res => res.data),
    updateProveedor: (id: number, proveedorData: Partial<ProveedorFormData>): Promise<Proveedor> =>
        axiosInstance.patch(`/proveedores/${id}/`, proveedorData).then(res => res.data),
    deleteProveedor: (id: number): Promise<void> =>
        axiosInstance.delete(`/proveedores/${id}/`).then(() => {}),

    // --- Funciones para RBAC (Permissions y Roles) ---
    fetchPermissions: async (params?: FilterParams): Promise<PaginatedResponse<Permission>> => {
        const response = await axiosInstance.get<Permission[]>('/permissions/', { params }); 
        return { count: response.data.length, next: null, previous: null, results: response.data, };
    },
    createPermission: async (data: CreatePermissionPayload): Promise<Permission> => {
        const response = await axiosInstance.post<Permission>('/permissions/', data); 
        return response.data;
    },
    updatePermission: async (id: number, data: UpdatePermissionPayload): Promise<Permission> => {
        const response = await axiosInstance.patch<Permission>(`/permissions/${id}/`, data); 
        return response.data;
    },
    deletePermission: async (id: number): Promise<void> => {
        await axiosInstance.delete(`/permissions/${id}/`); 
    },
    fetchRoles: async (params?: FilterParams): Promise<PaginatedResponse<Role>> => {
        const response = await axiosInstance.get('/roles/', { params }); 
        return normalizePaginatedResponse(response.data);
    },
    getRoleById: async (id: number): Promise<Role> => {
        const response = await axiosInstance.get(`/roles/${id}/`); 
        return response.data;
    },
    createRole: async (data: Omit<Role, 'id' | 'fecha_creacion' | 'fecha_actualizacion' | 'permissions'> & { permission_ids: number[] }): Promise<Role> => {
        const response = await axiosInstance.post('/roles/', data); 
        return response.data;
    },
    updateRole: async (id: number, data: Partial<Omit<Role, 'id' | 'fecha_creacion' | 'fecha_actualizacion' | 'permissions'>> & { permission_ids?: number[] }): Promise<Role> => {
        const response = await axiosInstance.put(`/roles/${id}/`, data); 
        return response.data;
    },
    deleteRole: (id: number): Promise<void> =>
        axiosInstance.delete(`/roles/${id}/`).then(() => {}),

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
                } else if (key !== 'imagen') {
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
            if (productoData[key as keyof Partial<Producto>] !== undefined) {
                if (key === 'imagen' && productoData.imagen instanceof File) {
                    formData.append(key, productoData.imagen);
                } else if (key === 'imagen' && productoData.imagen === null) {
                    formData.append(key, '');
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

    // === FUNCIONES PARA VENTAS ===
    fetchVentas: (params?: FilterParams): Promise<PaginatedResponse<Venta>> =>
        axiosInstance.get('/ventas/', { params }).then(res => normalizePaginatedResponse(res.data)),
    getVentaById: (id: number): Promise<Venta> =>
        axiosInstance.get(`/ventas/${id}/`).then(res => res.data),
    createVenta: (ventaData: Venta): Promise<Venta> =>
        axiosInstance.post('/ventas/', ventaData).then(res => res.data),
    updateVenta: (id: number, ventaData: Partial<Venta>): Promise<Venta> =>
        axiosInstance.put(`/ventas/${id}/`, ventaData).then(res => res.data),
    deleteVenta: (id: number): Promise<void> =>
        axiosInstance.delete(`/ventas/${id}/`).then(() => {}),
    cancelarVenta: (id: number) => axiosInstance.post(`/ventas/${id}/cancelar/`).then(res => res.data),

    // === FUNCIONES PARA MOVIMIENTOS DE STOCK (CONSOLIDADAS Y CORRECTAS) ===
    fetchMovimientos: (filters?: MovimientoFilters): Promise<PaginatedResponse<Movimiento>> => 
        axiosInstance.get('/movimientos/', { params: filters }).then(res => normalizePaginatedResponse(res.data)),
    getMovimientoById: (id: number): Promise<Movimiento> => 
        axiosInstance.get(`/movimientos/${id}/`).then(res => res.data),
    createMovimiento: (movimientoData: MovimientoFormData): Promise<Movimiento> => 
        axiosInstance.post('/movimientos/', movimientoData).then(res => res.data),
    updateMovimiento: (id: number, movimientoData: Partial<MovimientoFormData>): Promise<Movimiento> => 
        axiosInstance.patch(`/movimientos/${id}/`, movimientoData).then(res => res.data),
    deleteMovimiento: (id: number): Promise<void> => 
        axiosInstance.delete(`/movimientos/${id}/`).then(() => {}),
    aceptarMovimiento: (id: number): Promise<any> => 
        axiosInstance.post(`/movimientos/${id}/aceptar/`).then(res => res.data),
    rechazarMovimiento: (id: number): Promise<any> => 
        axiosInstance.post(`/movimientos/${id}/rechazar/`).then(res => res.data),

    // === FUNCIONES PARA REPORTES (¡NUEVAS ADICIONES!) ===
    // IMPORTANTE: Ahora pasamos los filtros directamente al objeto `params` de Axios.
    // Axios se encarga de ignorar `undefined` o `null` valores.
    // Tu `ReportsPage.tsx` ya envía `undefined` para "all", lo cual es ideal.
    getSalesSummaryReport: (filters: ReportFilters): Promise<SalesSummaryReportData> => {
        return axiosInstance.get('/reports/sales-summary/', { params: filters }).then(res => res.data);
    },
    getTopSellingProductsReport: (filters: ReportFilters): Promise<TopSellingProductReportData[]> => {
        return axiosInstance.get('/reports/top-selling-products/', { params: filters }).then(res => res.data);
    },
    getStockLevelReport: (filters: ReportFilters): Promise<StockLevelReportData[]> => {
        return axiosInstance.get('/reports/stock-level/', { params: filters }).then(res => res.data);
    },
    getClientPerformanceReport: (filters: ReportFilters): Promise<ClientPerformanceReportData[]> => {
        return axiosInstance.get('/reports/client-performance/', { params: filters }).then(res => res.data);
    },
    // Mantengo buildReportDownloadPath para los casos de descarga, ya que `window.open`
    // no usa el interceptor de Axios ni su manejo de `params` automáticamente.
    buildReportUrl: buildReportDownloadPath, 


// === FUNCIONES PARA EL LADO COMERCIAL (MARKETPLACE Y TIENDAS) ===

  /**
   * Fetches a list of active companies for the public marketplace.
   * GET /api/marketplace/empresas/
   * @returns Promise<EmpresaMarketplace[]> - A list of marketplace-ready company data.
   */
  // --- ¡MODIFICACIÓN CLAVE AQUÍ: Asegurar el tipo de retorno! ---
  getMarketplaceEmpresas: async (): Promise<EmpresaMarketplace[]> => {
    const response = await axiosInstance.get('/marketplace/empresas/');
    // Aquí podemos hacer una aserción de tipo si confiamos en el backend
    return response.data as EmpresaMarketplace[]; 
  },

  /**
   * Fetches detailed information for a specific company in the public marketplace.
   * GET /api/marketplace/empresas/{id}/
   * @param id The ID of the company.
   * @returns Promise<EmpresaMarketplace> - Detailed company data for the marketplace.
   */
  getMarketplaceEmpresaDetail: async (id: number): Promise<EmpresaMarketplace> => {
    const response = await axiosInstance.get(`/marketplace/empresas/${id}/`);
    return response.data as EmpresaMarketplace;
  },

  /**
   * Fetches a list of products for a specific company's public store.
   * GET /api/marketplace/empresas/{empresa_id}/productos/
   * @param empresaId The ID of the company whose products to fetch.
   * @returns Promise<Producto[]> - A list of products.
   */
  getPublicProductosByEmpresa: async (empresaId: number): Promise<Producto[]> => {
    const response = await axiosInstance.get(`/marketplace/empresas/${empresaId}/productos/`);
    return response.data as Producto[];
  },

  /**
   * Fetches detailed information for a specific product from the public store.
   * GET /api/public-products/{id}/
   * @param productId The ID of the product.
   * @returns Promise<Producto> - Detailed product information.
   */
  getPublicProductoDetail: async (productId: number): Promise<Producto> => {
    const response = await axiosInstance.get(`/public-products/${productId}/`);
    return response.data as Producto;
  },

  /**
   * Fetches a simulated demand prediction for a specific product.
   * GET /api/public-products/{id}/demanda-predictiva/
   * @param productId The ID of the product for which to predict demand.
   * @returns Promise<DemandaPredictivaResponse> - The prediction results and explanation.
   */
  getDemandaPredictiva: async (productId: number): Promise<DemandaPredictivaResponse> => {
    const response = await axiosInstance.get(`/public-products/${productId}/demanda-predictiva/`);
    return response.data as DemandaPredictivaResponse;
  },
  // === FUNCIONES PARA PAGOS (¡NUEVA ADICIÓN!) ===
    createPago: (pagoData: Omit<Pago, 'id' | 'fecha_pago' | 'fecha_creacion' | 'cliente_nombre' | 'empresa_nombre' | 'venta_id'>): Promise<Pago> =>
        axiosInstance.post('/pagos/', pagoData).then(res => res.data),
    fetchPagos: (params?: FilterParams): Promise<PaginatedResponse<Pago>> => // Para listar pagos
        axiosInstance.get('/pagos/', { params }).then(res => normalizePaginatedResponse(res.data)),
    getPagoById: (id: number): Promise<Pago> => // Para ver detalle de pago
        axiosInstance.get(`/pagos/${id}/`).then(res => res.data),

};
export default api;