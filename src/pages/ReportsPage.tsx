import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Loader2, FileText, FileSpreadsheet, FileOutput, CalendarDays, Filter, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { Empresa } from '@/types/empresas';
import { User } from '@/types/auth';
import { Categoria } from '@/types/categorias';
import { Almacen } from '@/types/almacenes';
import {
  ReportFilters,
  ReportConfig,
  SalesSummaryReportData,
  TopSellingProductReportData,
  StockLevelReportData,
  ClientPerformanceReportData,
} from '@/types/reports';

// === Definición de los reportes disponibles ===
const REPORT_CONFIGS: { [key: string]: ReportConfig } = {
  sales_summary: {
    title: 'Resumen de Ventas',
    endpoint: '/reports/sales-summary/',
    excelEndpoint: '/reports/sales-summary/export/excel/',
    pdfEndpoint: '/reports/sales-summary/export/pdf/',
    txtEndpoint: '/reports/sales-summary/export/txt/',
    filters: ['fecha_inicio', 'fecha_fin', 'empresa_id', 'cliente_id', 'estado'],
    tableHeaders: [
      { key: 'total_ventas_cantidad', label: 'Total Ventas' },
      { key: 'monto_total_ventas', label: 'Monto Total Ventas' },
      { key: 'promedio_por_venta', label: 'Promedio por Venta' },
    ],
  },
  top_selling_products: {
    title: 'Productos Más Vendidos',
    endpoint: '/reports/top-selling-products/',
    excelEndpoint: '/reports/top-selling-products/export/excel/',
    pdfEndpoint: '/reports/top-selling-products/export/pdf/',
    txtEndpoint: '/reports/top-selling-products/export/txt/',
    filters: ['fecha_inicio', 'fecha_fin', 'empresa_id', 'categoria_id', 'limit'],
    tableHeaders: [
      { key: 'id', label: 'ID Producto' },
      { key: 'nombre', label: 'Nombre Producto' },
      { key: 'cantidad_vendida', label: 'Cantidad Vendida' },
      { key: 'ingresos_generados', label: 'Ingresos Generados' },
    ],
  },
  stock_level: {
    title: 'Nivel de Stock',
    endpoint: '/reports/stock-level/',
    excelEndpoint: '/reports/stock-level/export/excel/',
    pdfEndpoint: '/reports/stock-level/export/pdf/',
    txtEndpoint: '/reports/stock-level/export/txt/',
    filters: ['empresa_id', 'almacen_id', 'categoria_id', 'stock_min', 'stock_max'],
    tableHeaders: [
      { key: 'id', label: 'ID Producto' },
      { key: 'nombre', label: 'Nombre Producto' },
      { key: 'stock_actual', label: 'Stock Actual' },
      { key: 'almacen_nombre', label: 'Almacén' },
      { key: 'empresa_nombre', label: 'Empresa' },
    ],
  },
  client_performance: {
    title: 'Rendimiento de Clientes',
    endpoint: '/reports/client-performance/',
    excelEndpoint: '/reports/client-performance/export/excel/',
    pdfEndpoint: '/reports/client-performance/export/pdf/',
    txtEndpoint: '/reports/client-performance/export/txt/',
    filters: ['fecha_inicio', 'fecha_fin', 'empresa_id'],
    tableHeaders: [
      { key: 'id', label: 'ID Cliente' },
      { key: 'nombre_cliente', label: 'Nombre Cliente' },
      { key: 'email_cliente', label: 'Email Cliente' },
      { key: 'monto_total_comprado', label: 'Monto Total Comprado' },
      { key: 'numero_ventas_realizadas', label: 'Número Ventas' },
    ],
  },
};

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedReportType, setSelectedReportType] = useState<keyof typeof REPORT_CONFIGS>('sales_summary');
  const [filters, setFilters] = useState<ReportFilters>({});
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentReportConfig = REPORT_CONFIGS[selectedReportType];

  // === Carga de datos para filtros (Empresas, Clientes, Categorías, Almacenes) ===
  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery<any, Error, Empresa[]>({
    queryKey: ['empresas_for_reports'],
    queryFn: () => api.fetchEmpresas().then(res => res.results),
    enabled: !!user && user.is_superuser,
    staleTime: 5 * 60 * 1000,
  });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery<any, Error, User[]>({
    queryKey: ['users_for_reports', filters.empresa_id],
    queryFn: async ({ queryKey }) => {
      const [_key, companyId] = queryKey;
      const filterParams: any = {};
      if (companyId && companyId !== "all") filterParams.empresa = companyId;
      const response = await api.fetchUsuarios(filterParams);
      return response.results;
    },
    enabled: !!user && (user.is_superuser ? true : !!user.empresa_detail?.id),
    staleTime: 5 * 60 * 1000,
  });

  const clients = useMemo(() => {
    return (usersData || []).filter(u => u.role?.name === 'Cliente');
  }, [usersData]);

  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery<any, Error, Categoria[]>({
    queryKey: ['categories_for_reports', filters.empresa_id],
    queryFn: async ({ queryKey }) => {
      const [_key, companyId] = queryKey;
      const filterParams: any = {};
      if (companyId && companyId !== "all") filterParams.empresa = companyId;
      const response = await api.fetchCategorias(filterParams);
      return response.results;
    },
    enabled: !!user && (user.is_superuser ? true : !!user.empresa_detail?.id),
    staleTime: 5 * 60 * 1000,
  });

  const { data: almacenesData, isLoading: isLoadingAlmacenes } = useQuery<any, Error, Almacen[]>({
    queryKey: ['almacenes_for_reports', filters.empresa_id],
    queryFn: async ({ queryKey }) => {
      const [_key, companyId] = queryKey;
      const filterParams: any = {};
      if (companyId && companyId !== "all") filterParams.empresa = companyId;
      const response = await api.fetchAlmacenes(filterParams);
      return response.results;
    },
    enabled: !!user && (user.is_superuser ? true : !!user.empresa_detail?.id),
    staleTime: 5 * 60 * 1000,
  });

  // === Efecto para inicializar filtros y resetear al cambiar el tipo de reporte ===
  useEffect(() => {
    // Inicializar o resetear filtros al cambiar el tipo de reporte
    const initialFilters: ReportFilters = {};
    
    // Asignar empresa por defecto
    if (user && !user.is_superuser && user.empresa_detail?.id) {
      initialFilters.empresa_id = user.empresa_detail.id;
    } else if (user?.is_superuser && empresasData && empresasData.length > 0) {
      initialFilters.empresa_id = empresasData[0].id;
    } else if (user?.is_superuser && !empresasData?.length) {
        initialFilters.empresa_id = undefined;
    }

    // Establecer fechas por defecto: últimos 90 días
    const today = new Date();
    const ninetyDaysAgo = new Date(today);
    ninetyDaysAgo.setDate(today.getDate() - 90);
    initialFilters.fecha_fin = today.toISOString().slice(0, 10);
    initialFilters.fecha_inicio = ninetyDaysAgo.toISOString().slice(0, 10);

    // Inicializar otros selectores a 'undefined' (para que no se envíen al backend si no son modificados)
    if (currentReportConfig) {
      currentReportConfig.filters.forEach(filterKey => {
        // Excluir fecha_inicio, fecha_fin, y empresa_id ya que se manejan arriba con lógica específica
        if (!['fecha_inicio', 'fecha_fin', 'empresa_id'].includes(filterKey)) {
             // ASÍ SE SOLUCIONA EL ERROR 'Type any is not assignable to never'
             // Se asigna undefined, y se asegura que TypeScript entienda la asignación dinámica.
             (initialFilters as any)[filterKey] = undefined; 
        }
      });
    }

    setFilters(initialFilters);
    setReportData(null); // Limpiar datos del reporte anterior
  }, [selectedReportType, user, empresasData, currentReportConfig]);

  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    // Si el valor es "all", se establece el filtro a undefined (para que no se envíe al backend)
    // De lo contrario, se usa el valor tal cual.
    const newValue = value === "all" ? undefined : value;
    setFilters(prev => ({ ...prev, [key]: newValue }));

    // Resetear filtros dependientes si la empresa cambia
    if (key === 'empresa_id') {
      setFilters(prev => ({
        ...prev,
        cliente_id: undefined, // Se inicializan a undefined para que el backend no los reciba
        categoria_id: undefined,
        almacen_id: undefined,
      }));
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setReportData(null); // Limpiar previsualización anterior

    // Validación mínima: Asegurarse de que si es superusuario, se ha seleccionado una empresa.
    // Esto se aplica si el reporte incluye el filtro de empresa_id.
    if (user?.is_superuser && !filters.empresa_id && currentReportConfig.filters.includes('empresa_id')) {
        toast({
            title: 'Error de Filtro',
            description: 'Como Super Usuario, debes seleccionar una empresa para generar el reporte.',
            variant: 'destructive',
        });
        setIsGenerating(false);
        return;
    }
    // Si no es superusuario y no tiene empresa asignada, y el reporte requiere empresa
    if (!user?.is_superuser && !user?.empresa_detail?.id && currentReportConfig.filters.includes('empresa_id')) {
        toast({
            title: 'Error de Permisos',
            description: 'Tu usuario no está asociado a una empresa. Contacta a un administrador.',
            variant: 'destructive',
        });
        setIsGenerating(false);
        return;
    }


    try {
      let data;
      // Llamadas a la API específicas por tipo de reporte
      if (selectedReportType === 'sales_summary') {
        data = await api.getSalesSummaryReport(filters);
        // El resumen es un solo objeto, lo envolvemos en un array para la tabla
        setReportData(data ? [data] : []); 
      } else if (selectedReportType === 'top_selling_products') {
        data = await api.getTopSellingProductsReport(filters);
        setReportData(data);
      } else if (selectedReportType === 'stock_level') {
        data = await api.getStockLevelReport(filters);
        setReportData(data);
      } else if (selectedReportType === 'client_performance') {
        data = await api.getClientPerformanceReport(filters);
        setReportData(data);
      }
      
      toast({ title: 'Reporte Generado', description: 'Previsualización del reporte lista.' });
    } catch (error: any) {
      console.error('Error al generar reporte:', error);
      let errorMessage = 'Hubo un error al generar el reporte.';
      if (error.response && error.response.data) {
        if (typeof error.response.data === 'object' && error.response.data.detail) {
            errorMessage = `Error: ${error.response.data.detail}`;
        } else if (typeof error.response.data === 'object') {
            // Intentar parsear el error del backend si es un objeto JSON (ej. errores de validación)
            try {
                errorMessage = Object.values(error.response.data).flat().join(', ');
            } catch {
                errorMessage = `Detalles: ${String(error.response.data)}`;
            }
        } else {
            errorMessage = `Detalles: ${String(error.response.data)}`;
        }
      } else {
        errorMessage = error.message;
      }
      toast({ title: 'Error al Generar Reporte', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = (format: 'excel' | 'pdf' | 'txt') => {
    // Validación mínima antes de exportar
    if (user?.is_superuser && !filters.empresa_id && currentReportConfig.filters.includes('empresa_id')) {
        toast({
            title: 'Error de Exportación',
            description: 'Como Super Usuario, debes seleccionar una empresa para exportar el reporte.',
            variant: 'destructive',
        });
        return;
    }
    if (!user?.is_superuser && !user?.empresa_detail?.id && currentReportConfig.filters.includes('empresa_id')) {
        toast({
            title: 'Error de Exportación',
            description: 'Tu usuario no está asociado a una empresa. No se puede exportar el reporte.',
            variant: 'destructive',
        });
        return;
    }

    let exportUrl = '';
    if (format === 'excel') {
      exportUrl = currentReportConfig.excelEndpoint;
    } else if (format === 'pdf') {
      exportUrl = currentReportConfig.pdfEndpoint;
    } else if (format === 'txt') {
      exportUrl = currentReportConfig.txtEndpoint;
    }

    const fullExportUrl = api.buildReportUrl(exportUrl, filters);
    // Abre en nueva pestaña para descarga
    // api.baseURL ya incluye /api, y exportUrl ya empieza con /, así que la concatenación es directa.
    window.open(`${api.baseURL}${fullExportUrl}`, '_blank'); 
    toast({ title: `Exportando a ${format.toUpperCase()}`, description: 'El archivo se está descargando.' });
  };


  // === Renderizado de Filtros Dinámicos ===
  const renderFilterInput = (filterKey: keyof ReportFilters) => {
    // Helper para determinar el valor del Select (puede ser string o number)
    const getSelectValue = (key: keyof ReportFilters) => {
        const val = filters[key];
        // Si el valor del filtro es undefined o null, se mapea a "all" para el SelectItem
        return val === undefined || val === null ? "all" : String(val);
    };

    switch (filterKey) {
      case 'fecha_inicio':
      case 'fecha_fin':
        return (
          <div key={filterKey}>
            <Label htmlFor={filterKey}>Fecha {filterKey.includes('inicio') ? 'Inicio' : 'Fin'}</Label>
            <Input
              id={filterKey}
              type="date"
              value={filters[filterKey] || ''}
              onChange={(e) => handleFilterChange(filterKey, e.target.value)}
              className="mt-1"
            />
          </div>
        );
      case 'empresa_id':
        const isEmpresaDisabled = !user?.is_superuser || isLoadingEmpresas || !empresasData?.length;
        
        // Determinar el valor para el Select de Empresa
        let empresaSelectValue: string = "all"; // Valor por defecto para Select
        if (user && !user.is_superuser && user.empresa_detail?.id) {
            // Usuario normal: siempre su empresa
            empresaSelectValue = String(user.empresa_detail.id);
        } else if (filters.empresa_id !== undefined && filters.empresa_id !== null) {
            // Superusuario: si ya hay un ID de empresa en los filtros
            empresaSelectValue = String(filters.empresa_id);
        } else if (user?.is_superuser && empresasData && empresasData.length > 0) {
            // Superusuario: si no hay un ID de empresa, pero hay empresas, toma la primera como inicial
            // Esto es solo para que el Select no esté "vacío" si no hay filtro explícito
            empresaSelectValue = String(empresasData[0].id);
        } else {
            // Si es superusuario y no hay empresas o filters.empresa_id es undefined/null
            // o si es usuario normal sin empresa, se usará el valor "all" para el Select
            // o el placeholder se encargará (si el Select no tiene un valor que corresponda a "all")
            empresaSelectValue = "all"; // O 'undefined' si el SelectValue lo permite para placeholder
        }


        return (
          <div key={filterKey}>
            <Label htmlFor={filterKey}>Empresa</Label>
            <Select
              value={empresaSelectValue}
              onValueChange={(value) => handleFilterChange('empresa_id', value)}
              disabled={isEmpresaDisabled}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder={isLoadingEmpresas ? "Cargando empresas..." : "Selecciona una empresa"} />
              </SelectTrigger>
              <SelectContent>
                {/* Solo superusuarios pueden ver y seleccionar "Todas las Empresas" o una específica */}
                {user?.is_superuser && (
                  <SelectItem value="all">Todas las Empresas</SelectItem>
                )}
                {user?.is_superuser && empresasData?.map(emp => (
                  <SelectItem key={emp.id} value={String(emp.id)}>{emp.nombre}</SelectItem>
                ))}
                {(!user?.is_superuser && user?.empresa_detail) && (
                  <SelectItem key={user.empresa_detail.id} value={String(user.empresa_detail.id)}>
                    {user.empresa_detail.nombre} (Tu Empresa)
                  </SelectItem>
                )}
                {/* Opciones deshabilitadas si no hay datos o permiso */}
                 {user?.is_superuser && !isLoadingEmpresas && !empresasData?.length && (
                    <SelectItem value="no_empresas" disabled>No hay empresas disponibles</SelectItem>
                 )}
                 {!user?.is_superuser && !user?.empresa_detail && (
                    <SelectItem value="no_empresa_asignada" disabled>No hay empresa asignada</SelectItem>
                 )}
              </SelectContent>
            </Select>
          </div>
        );
      case 'cliente_id':
        return (
          <div key={filterKey}>
            <Label htmlFor={filterKey}>Cliente</Label>
            <Select
              value={getSelectValue('cliente_id')}
              onValueChange={(value) => handleFilterChange('cliente_id', value)}
              disabled={isLoadingUsers || clients.length === 0}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder={isLoadingUsers ? "Cargando clientes..." : "Selecciona un cliente"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Clientes</SelectItem>
                {clients.map(client => (
                  <SelectItem key={client.id} value={String(client.id)}>
                    {client.first_name} {client.last_name || ''} ({client.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'estado':
        return (
          <div key={filterKey}>
            <Label htmlFor={filterKey}>Estado de Venta</Label>
            <Select
              value={getSelectValue('estado')}
              onValueChange={(value) => handleFilterChange('estado', value)}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Completada">Completada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      case 'categoria_id':
        return (
          <div key={filterKey}>
            <Label htmlFor={filterKey}>Categoría</Label>
            <Select
              value={getSelectValue('categoria_id')}
              onValueChange={(value) => handleFilterChange('categoria_id', value)}
              disabled={isLoadingCategories || categoriesData?.length === 0}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder={isLoadingCategories ? "Cargando categorías..." : "Selecciona una categoría"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Categorías</SelectItem>
                {categoriesData?.map(cat => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'limit':
        return (
          <div key={filterKey}>
            <Label htmlFor={filterKey}>Límite de Resultados</Label>
            <Input
              id={filterKey}
              type="number"
              value={filters.limit || ''}
              onChange={(e) => handleFilterChange(filterKey, Number(e.target.value) || undefined)}
              placeholder="Ej. 10"
              min="1"
              className="mt-1"
            />
          </div>
        );
      case 'almacen_id':
        return (
          <div key={filterKey}>
            <Label htmlFor={filterKey}>Almacén</Label>
            <Select
              value={getSelectValue('almacen_id')}
              onValueChange={(value) => handleFilterChange('almacen_id', value)}
              disabled={isLoadingAlmacenes || almacenesData?.length === 0}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder={isLoadingAlmacenes ? "Cargando almacenes..." : "Selecciona un almacén"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Almacenes</SelectItem>
                {almacenesData?.map(almacen => (
                  <SelectItem key={almacen.id} value={String(almacen.id)}>{almacen.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case 'stock_min':
        return (
          <div key={filterKey}>
            <Label htmlFor={filterKey}>Stock Mínimo</Label>
            <Input
              id={filterKey}
              type="number"
              value={filters.stock_min || ''}
              onChange={(e) => handleFilterChange(filterKey, Number(e.target.value) || undefined)}
              placeholder="Ej. 10"
              min="0"
              className="mt-1"
            />
          </div>
        );
      case 'stock_max':
        return (
          <div key={filterKey}>
            <Label htmlFor={filterKey}>Stock Máximo</Label>
            <Input
              id={filterKey}
              type="number"
              value={filters.stock_max || ''}
              onChange={(e) => handleFilterChange(filterKey, Number(e.target.value) || undefined)}
              placeholder="Ej. 100"
              min="0"
              className="mt-1"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 bg-background text-foreground min-h-screen">
      <h1 className="text-3xl font-bold text-primary font-heading">Generador de Reportes</h1>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold">Selección de Reporte</CardTitle>
          <CardDescription className="text-muted-foreground">Elige el tipo de reporte que deseas generar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.keys(REPORT_CONFIGS).map(reportKey => (
              <Button
                key={reportKey}
                variant={selectedReportType === reportKey ? 'default' : 'outline'}
                onClick={() => setSelectedReportType(reportKey as keyof typeof REPORT_CONFIGS)}
                // --- CAMBIO AQUÍ: Icono al lado del texto ---
                className="py-6 flex items-center justify-center text-center group space-x-2" // space-x-2 para espacio entre icono y texto
              >
                {selectedReportType === reportKey ? (
                  <span className="text-white flex items-center space-x-2"> {/* flex items-center space-x-2 también para el span interno */}
                    <FileText className="h-6 w-6 flex-shrink-0" /> {/* flex-shrink-0 para que el icono no se encoja */}
                    <span className="font-bold text-lg">{REPORT_CONFIGS[reportKey].title}</span>
                  </span>
                ) : (
                  <span className="text-gray-600 group-hover:text-primary transition-colors flex items-center space-x-2"> {/* igual aquí */}
                    <FileText className="h-6 w-6 flex-shrink-0" />
                    <span className="font-semibold">{REPORT_CONFIGS[reportKey].title}</span>
                  </span>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold flex items-center">
            <Filter className="h-5 w-5 mr-2" /> Filtros para "{currentReportConfig.title}"
          </CardTitle>
          <CardDescription className="text-muted-foreground">Aplica los filtros para refinar los resultados del reporte.</CardDescription>
        </CardHeader> {/* <-- CIERRE DE CARDHEADER PARA FILTROS */}
        <CardContent> {/* <-- INICIO DE CARDCONTENT PARA FILTROS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentReportConfig.filters.map(filterKey => renderFilterInput(filterKey))}
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleGenerateReport} disabled={isGenerating} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...
                </>
              ) : (
                <>
                  <CalendarDays className="mr-2 h-4 w-4" /> Generar Reporte
                </>
              )}
            </Button>
          </div>
        </CardContent> {/* <-- CIERRE DE CARDCONTENT PARA FILTROS */}

        {reportData && (
          <CardContent> {/* <-- ESTE ES EL CARDCONTENT PARA LA PREVISUALIZACIÓN DEL REPORTE */}
            {reportData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No se encontraron datos para los filtros seleccionados.</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      {currentReportConfig.tableHeaders.map(header => (
                        <th key={header.key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          {header.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {reportData.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {currentReportConfig.tableHeaders.map(header => (
                          <td key={header.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {/* Renderizar valores Decimal con 2 decimales para mostrar en UI si son strings numéricos */}
                            { (typeof row[header.key] === 'string' && !isNaN(parseFloat(row[header.key]))) ? 
                                parseFloat(row[header.key]).toFixed(2) : 
                                row[header.key]
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <Separator className="my-6" />

            <div className="flex justify-end gap-3">
              <Button onClick={() => handleExport('excel')} disabled={isGenerating || reportData.length === 0} className="bg-green-600 hover:bg-green-700 text-white">
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar a Excel
              </Button>
              <Button onClick={() => handleExport('pdf')} disabled={isGenerating || reportData.length === 0} className="bg-red-600 hover:bg-red-700 text-white">
                <FileOutput className="mr-2 h-4 w-4" /> Exportar a PDF
              </Button>
              <Button onClick={() => handleExport('txt')} disabled={isGenerating || reportData.length === 0} className="bg-gray-600 hover:bg-gray-700 text-white">
                <FileText className="mr-2 h-4 w-4" /> Exportar a TXT
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ReportsPage;