export interface EmpresaMarketplace {
  id: number;
  nombre: string;
  descripcion_corta?: string; 
  direccion?: string;        
  is_active: boolean;       
}

export interface DemandaPredictivaResponse {
  producto_id: number;
  producto_nombre: string;
  prediccion_demanda_proximos_dias: number;
  confianza_prediccion: number;
  fecha_prediccion: string;
  explicacion_simplificada: string;
  beneficio_erp: string;
}