// src/types/reports.ts

// Tipos para los datos de los reportes (la estructura de los objetos que devuelve el backend)

export type SalesSummaryReportData = {
  total_ventas_cantidad: number;
  monto_total_ventas: string; // Puede ser string si el backend lo devuelve formateado
  promedio_por_venta: string; // Puede ser string si el backend lo devuelve formateado
};

export type TopSellingProductReportData = {
  id: number;
  nombre: string;
  cantidad_vendida: number;
  ingresos_generados: string; // Puede ser string si el backend lo devuelve formateado
};

export type StockLevelReportData = {
  id: number;
  nombre: string;
  stock_actual: number;
  almacen_nombre: string;
  empresa_nombre: string;
};

export type ClientPerformanceReportData = {
  id: number;
  nombre_cliente: string;
  email_cliente: string;
  monto_total_comprado: string; // Puede ser string si el backend lo devuelve formateado
  numero_ventas_realizadas: number;
};

// Tipo genérico para la data de cualquier reporte
export type ReportData =
  | SalesSummaryReportData
  | TopSellingProductReportData[]
  | StockLevelReportData[]
  | ClientPerformanceReportData[];

// Tipos para los parámetros de filtro de los reportes
export type ReportFilters = {
  empresa_id?: number | string; // Opcional, solo si es superusuario o para filtro
  fecha_inicio?: string; // Formato 'YYYY-MM-DD'
  fecha_fin?: string; // Formato 'YYYY-MM-DD'
  cliente_id?: number | string;
  estado?: 'Pendiente' | 'Completada' | 'Cancelada';
  categoria_id?: number | string;
  limit?: number;
  almacen_id?: number | string;
  stock_min?: number;
  stock_max?: number;
};

// Tipos para la configuración de un reporte específico
export type ReportConfig = {
  title: string;
  endpoint: string; // Endpoint base para la previsualización
  excelEndpoint: string; // Endpoint para exportar a Excel
  pdfEndpoint: string; // Endpoint para exportar a PDF
  txtEndpoint: string; // Endpoint para exportar a TXT
  filters: (keyof ReportFilters)[]; // Filtros aplicables a este reporte
  tableHeaders: { key: string; label: string }[]; // Encabezados para la tabla de previsualización
};