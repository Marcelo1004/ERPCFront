export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string | null;
  empresa: number; // ID de la empresa a la que pertenece
  empresa_detail?: { // Detalles de la empresa para lectura
    id: number;
    nombre: string;
  } | null;
}
