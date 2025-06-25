export interface Sucursal {
  id: number;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  empresa: number; // ID de la empresa a la que pertenece
  empresa_detail?: { // Detalles de la empresa para lectura
    id: number;
    nombre: string;
  } | null;
}