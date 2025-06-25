export interface Almacen {
  id: number;
  nombre: string;
  ubicacion?: string | null;
  capacidad?: number | null;
  sucursal?: number | null; // ID de la sucursal asociada (puede ser nulo)
  sucursal_detail?: { // Detalles de la sucursal para lectura
    id: number;
    nombre: string;
  } | null;
  empresa: number; // ID de la empresa a la que pertenece
  empresa_detail?: { // Detalles de la empresa para lectura
    id: number;
    nombre: string;
  } | null;
}