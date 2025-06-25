export interface DashboardData {
  total_usuarios: number;
  total_sucursales: number;
  total_almacenes: number;
  total_categorias: number;
  total_productos: number;
  valor_total_inventario: string; // DecimalField de Django se mapea a string
  productos_bajo_stock: string[]; // Lista de nombres de productos

  // Campos opcionales para SuperUsuario
  total_empresas?: number;
  distribucion_suscripciones?: Array<{
    plan_nombre: string;
    cantidad_empresas: number;
  }>;
}
