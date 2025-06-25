import React, { useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Building,
  Users,
  MapPin,
  Warehouse,
  Tag,
  Package,
  DollarSign,
  AlertTriangle,
  Server,
  Loader2,
  ShoppingCart,
  TrendingUp,
  LayoutDashboard,
  LineChart as LineChartIcon,
  BarChart,
  Clock,
  UserPlus // Importamos UserPlus para el tipo 'user_created' en Actividad Reciente
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart as RechartsBarChart, Bar
} from 'recharts';
import { DashboardERPMetrics, FilterParams }  from '@/services/api'; // Asegúrate de que DashboardERPMetrics y FilterParams están exportadas aquí
import { toast } from '@/components/ui/use-toast';

// Datos de ejemplo si no vienen de la API.
const demoMonthlySalesData = [
  { name: 'Ene', Ventas: 4000 },
  { name: 'Feb', Ventas: 3000 },
  { name: 'Mar', Ventas: 2000 },
  { name: 'Abr', Ventas: 2780 },
  { name: 'May', Ventas: 1890 },
  { name: 'Jun', Ventas: 2390 },
  { name: 'Jul', Ventas: 3490 },
];

const demoTopProductsData = [
  { name: 'Laptop Ultra', sales: 1200, units: 120 },
  { name: 'Monitor Curvo 27"', sales: 950, units: 80 },
  { name: 'Teclado Mecánico RGB', sales: 720, units: 150 },
  { name: 'Mouse Gamer Ergonómico', sales: 500, units: 200 },
  { name: 'Webcam HD Pro', sales: 300, units: 60 },
];

const demoCategoryDistributionData = [
  { name: 'Electrónica', products_count: 150 },
  { name: 'Oficina', products_count: 80 },
  { name: 'Hogar', products_count: 50 },
  { name: 'Accesorios', products_count: 200 },
  { name: 'Software', products_count: 30 },
];

const demoRecentActivitiesData = [
  { id: 'a1', description: 'Usuario John Doe inició sesión', timestamp: '2024-06-24T10:30:00Z', type: 'login' },
  { id: 'a2', description: 'Producto "Silla Ergonómica" actualizado', timestamp: '2024-06-24T09:45:00Z', type: 'product_update' },
  { id: 'a3', description: 'Nuevo pedido #00123 creado por Cliente ABC', timestamp: '2024-06-23T16:00:00Z', type: 'order_created' },
  { id: 'a4', description: 'Alerta: Stock bajo para "Impresora Láser"', timestamp: '2024-06-23T11:20:00Z', type: 'alert' },
  { id: 'a5', description: 'Nuevo usuario registrado: Jane Smith', timestamp: '2024-06-22T08:00:00Z', type: 'user_created' },
];

const demoInventoryByWarehouseData = [
  { name: 'Almacén Principal', total_value: 75000, product_count: 250 },
  { name: 'Almacén Secundario', total_value: 30000, product_count: 100 },
  { name: 'Almacén de Repuestos', total_value: 12000, product_count: 80 },
  { name: 'Almacén de Devoluciones', total_value: 5000, product_count: 30 },
];


const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isSuperUser = user?.is_superuser;

  const { data: dashboardStats, isLoading, error } = useQuery<DashboardERPMetrics, Error>({
    queryKey: ['erp-dashboard-stats', user?.id, user?.empresa, isSuperUser],
    queryFn: ({ queryKey }) => {
      const [_key, _userId, empresaId, isSuperUserQuery] = queryKey;
      const filters: FilterParams = {};

      if (!isSuperUserQuery && empresaId) {
        filters.empresa = empresaId as number;
      }
      return api.fetchDashboardData(filters);
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (error) {
      console.error('Error al cargar el dashboard ERP:', error);
      toast({
        title: 'Error al cargar el dashboard',
        description: 'No se pudieron cargar los datos del dashboard. Por favor, intenta de nuevo más tarde.',
        variant: 'destructive',
      });
    }
  }, [error]);

  const CHART_COLORS = useMemo(() => ([
    '#6366f1', // Indigo 500 
    '#22c55e', // Green 500
    '#ef4444', // Red 500
    '#f97316', // Orange 500
    '#06b6d4', // Cyan 500
    '#a855f7', // Purple 500
    '#ec4899', // Pink 500
    '#3b82f6', // Blue 500
    '#84cc16', // Lime 500
    '#eab308', // Yellow 500
  ]), []);

 
  const monthlySalesData = dashboardStats?.monthly_sales || demoMonthlySalesData;
  const topProductsData = dashboardStats?.top_products || demoTopProductsData;
  const categoryDistributionData = dashboardStats?.category_distribution || demoCategoryDistributionData;
  const recentActivitiesData = dashboardStats?.recent_activities || demoRecentActivitiesData;
  const inventoryByWarehouseData = dashboardStats?.inventory_by_warehouse || demoInventoryByWarehouseData;


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Cargando datos del dashboard...</p>
      </div>
    );
  }

  if (error || !dashboardStats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-background text-destructive">
        <AlertTriangle className="h-12 w-12 mb-2" />
        <h3 className="text-lg font-medium text-destructive-foreground">Error al cargar el dashboard</h3>
        <p className="text-muted-foreground">No se pudieron obtener los datos. Por favor, intenta de nuevo más tarde.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-background text-foreground font-body">
      {/* Sección de Bienvenida Mejorada */}
      <Card className="bg-primary text-primary-foreground rounded-xl p-6 shadow-lg font-heading relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 opacity-20 transform rotate-45 translate-x-1/2 -translate-y-1/2">
          <LayoutDashboard className="w-full h-full text-white" />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold mb-2">
            ¡Bienvenido/a, {user?.first_name}!
          </h1>
          <p className="text-lg opacity-90">
            {isSuperUser
              ? 'Panel de control centralizado del sistema ERP SaaS'
              : `Dashboard de gestión para ${user?.empresa_detail?.nombre || 'tu empresa'}`
            }
          </p>
          <div className="text-right mt-4 sm:mt-0">
            <Badge variant="secondary" className="bg-primary/20 text-primary-foreground border-primary/30 mb-2">
              {user?.role === 'SUPERUSER' ? 'SUPER USUARIO' : user?.role === 'ADMINISTRATIVO' ? 'ADMINISTRATIVO' : 'EMPLEADO'}
            </Badge>
            <p className="opacity-80 text-sm">
              {new Date().toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>
      </Card>

      {/* Sección de Tarjetas de Estadísticas Clave */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isSuperUser && (
          <Card className="bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Empresas</CardTitle>
              <Building className="h-5 w-5 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{dashboardStats.total_empresas ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Empresas activas en el sistema</p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Usuarios</CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{dashboardStats.total_usuarios ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Usuarios registrados ({isSuperUser ? 'en el sistema' : 'en tu empresa'})</p>
            </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sucursales</CardTitle>
            <MapPin className="h-5 w-5 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{dashboardStats.total_sucursales ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Sucursales ({isSuperUser ? 'en el sistema' : 'en tu empresa'})</p>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Almacenes</CardTitle>
            <Warehouse className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{dashboardStats.total_almacenes ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Almacenes ({isSuperUser ? 'en el sistema' : 'en tu empresa'})</p>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Categorías</CardTitle>
            <Tag className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{dashboardStats.total_categorias ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Categorías de productos ({isSuperUser ? 'en el sistema' : 'en tu empresa'})</p>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Productos</CardTitle>
            <Package className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{dashboardStats.total_productos ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Productos registrados ({isSuperUser ? 'en el sistema' : 'en tu empresa'})</p>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total Inventario</CardTitle>
            <DollarSign className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            {/* Convertir a Number antes de toFixed */}
            <div className="text-2xl font-bold text-foreground">${Number(dashboardStats.valor_total_inventario).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Valor estimado de todos los productos</p>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-300 border border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Productos Bajo Stock</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{dashboardStats.productos_bajo_stock?.length ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Productos que necesitan reabastecimiento</p>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6 bg-border" />

      {/* Sección de Gráficos Adicionales y Listados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Ventas Mensuales */}
        <Card className="bg-card text-card-foreground shadow-lg border border-border">
          <CardHeader>
            <CardTitle className="font-semibold text-foreground flex items-center">
              <LineChartIcon className="h-5 w-5 mr-2 text-primary" /> Ventas Mensuales
            </CardTitle>
            <CardDescription className="text-muted-foreground">Evolución de las ventas en los últimos meses.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsLineChart data={monthlySalesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    color: 'hsl(var(--foreground))'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  // Formatear el valor de las Ventas en el Tooltip
                  formatter={(value) => `$${Number(value).toFixed(2)}`}
                />
                <Legend />
                {/* Recharts generalmente puede manejar strings numéricos, pero aseguramos */}
                <Line type="monotone" dataKey="Ventas" stroke="hsl(var(--primary))" activeDot={{ r: 8 }} strokeWidth={2} />
              </RechartsLineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Distribución de Suscripciones (Solo para SuperUsuario) */}
        {isSuperUser && dashboardStats.distribucion_suscripciones && dashboardStats.distribucion_suscripciones.length > 0 && (
          <Card className="bg-card text-card-foreground shadow-lg border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center">
                <Server className="h-5 w-5 mr-2 text-accent" /> Distribución de Suscripciones
              </CardTitle>
              <CardDescription className="text-muted-foreground">Número de empresas por plan de suscripción</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dashboardStats.distribucion_suscripciones}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="cantidad_empresas"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    nameKey="plan_nombre"
                  >
                    {dashboardStats.distribucion_suscripciones.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      color: 'hsl(var(--foreground))'
                    }}
                    formatter={(value, name, props) => [`${value} empresas`, props.payload.plan_nombre]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Gráfico de Distribución de Productos por Categoría */}
        <Card className="bg-card text-card-foreground shadow-lg border border-border">
          <CardHeader>
            <CardTitle className="font-semibold text-foreground flex items-center">
              <BarChart className="h-5 w-5 mr-2 text-primary" /> Productos por Categoría
            </CardTitle>
            <CardDescription className="text-muted-foreground">Cantidad de productos por cada categoría.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsBarChart data={categoryDistributionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    color: 'hsl(var(--foreground))'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Bar dataKey="products_count" name="Cantidad de Productos" fill="hsl(var(--secondary))" />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico/Tabla de Detalle de Inventario por Almacén */}
        <Card className="bg-card text-card-foreground shadow-lg border border-border">
          <CardHeader>
            <CardTitle className="font-semibold text-foreground flex items-center">
              <Warehouse className="h-5 w-5 mr-2 text-accent" /> Inventario por Almacén
            </CardTitle>
            <CardDescription className="text-muted-foreground">Valor total y cantidad de productos por cada almacén.</CardDescription>
          </CardHeader>
          <CardContent>
            {inventoryByWarehouseData && inventoryByWarehouseData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsBarChart data={inventoryByWarehouseData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        color: 'hsl(var(--foreground))'
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      // Formatear los valores en el Tooltip
                      formatter={(value, name) => [
                          name === 'total_value' ? `$${Number(value).toFixed(2)}` : value,
                          name === 'total_value' ? 'Valor Total' : 'Productos'
                      ]}
                    />
                    <Legend />
                    {/* Aseguramos que dataKey 'total_value' y 'product_count' se lean correctamente, Recharts puede manejar strings numéricos */}
                    <Bar dataKey="total_value" name="Valor Total" fill="hsl(var(--primary))" />
                    <Bar dataKey="product_count" name="Cantidad Productos" fill="hsl(var(--secondary))" />
                  </RechartsBarChart>
                </ResponsiveContainer>
                <div className="mt-4 max-h-40 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2 text-left font-medium text-muted-foreground">Almacén</th>
                        <th className="py-2 text-right font-medium text-muted-foreground">Valor</th>
                        <th className="py-2 text-right font-medium text-muted-foreground">Productos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryByWarehouseData.map((item, index) => (
                        <tr key={index} className="border-b border-border last:border-b-0 hover:bg-background/50">
                          <td className="py-2">{item.name}</td>
                          {/* === CORRECCIÓN CLAVE AQUÍ: Convertir a Number === */}
                          <td className="py-2 text-right">${Number(item.total_value).toFixed(2)}</td> 
                          <td className="py-2 text-right">{item.product_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center text-muted-foreground py-4">
                <p>No hay datos de inventario por almacén disponibles.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Listado de Productos Más Vendidos */}
        <Card className="bg-card text-card-foreground shadow-lg border border-border">
          <CardHeader>
            <CardTitle className="font-semibold text-foreground flex items-center">
              <ShoppingCart className="h-5 w-5 mr-2 text-primary" /> Productos Más Vendidos
            </CardTitle>
            <CardDescription className="text-muted-foreground">Los productos con mayor volumen de ventas.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {topProductsData.map((product, index) => (
                <li key={index} className="flex items-center justify-between p-2 rounded-md hover:bg-background transition-colors duration-200">
                  <span className="font-medium text-foreground">{product.name}</span>
                  <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                    {product.units} unidades
                  </Badge>
                  {/* Convertir a Number antes de toFixed */}
                  <span className="text-sm text-muted-foreground ml-auto">${Number(product.sales).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Sección de Productos Bajo Stock */}
        <Card className="bg-card text-card-foreground shadow-lg border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-destructive" /> Alertas de Stock Bajo
              </CardTitle>
              <CardDescription className="text-muted-foreground">Productos que requieren reposición inmediata.</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardStats.productos_bajo_stock && dashboardStats.productos_bajo_stock.length > 0 ? (
                <ul className="space-y-3 max-h-64 overflow-y-auto">
                  {dashboardStats.productos_bajo_stock.map((productName, index) => (
                    <li key={index} className="flex items-center p-2 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="font-medium">{productName}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <p>No hay productos con stock bajo actualmente. ¡Excelente gestión!</p>
                </div>
              )}
            </CardContent>
          </Card>

        {/* Feed de Actividad Reciente */}
        <Card className="bg-card text-card-foreground shadow-lg border border-border">
          <CardHeader>
            <CardTitle className="font-semibold text-foreground flex items-center">
              <Clock className="h-5 w-5 mr-2 text-secondary" /> Actividad Reciente
            </CardTitle>
            <CardDescription className="text-muted-foreground">Eventos recientes en el sistema.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 max-h-64 overflow-y-auto">
              {recentActivitiesData.map((activity) => (
                <li key={activity.id} className="flex items-start p-2 rounded-md hover:bg-background transition-colors duration-200">
                  <span className="flex-shrink-0 mr-3 text-muted-foreground">
                    {/* Icono según el tipo de actividad */}
                    {activity.type === 'login' && <Users className="h-4 w-4" />}
                    {activity.type === 'product_update' && <Package className="h-4 w-4" />}
                    {activity.type === 'order_created' && <ShoppingCart className="h-4 w-4" />}
                    {activity.type === 'alert' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    {activity.type === 'user_created' && <UserPlus className="h-4 w-4" />} {/* Usamos UserPlus */}
                    {/* Puedes añadir más iconos aquí */}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground leading-snug">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(activity.timestamp).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;