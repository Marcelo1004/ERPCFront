import { Producto } from './productos'; // Asegúrate de que la ruta sea correcta para tu `Producto` tipo
import { Proveedor } from './proveedores'; // Asegúrate de que la ruta sea correcta para tu `Proveedor` tipo
import { Almacen } from './almacenes'; // Asegúrate de que la ruta sea correcta para tu `Almacen` tipo
import { Empresa } from './empresas'; // Asegúrate de que la ruta sea correcta para tu `Empresa` tipo
import { FilterParams } from '@/services/api'; // Asegúrate de que la ruta sea correcta para tu `FilterParams` tipo
export interface MovimientoDetail {
  id?: number; // Opcional, para cuando el detalle ya existe en edición
  producto: number; // ID del Producto (ForeignKey en Django)
  producto_nombre?: string; // Nombre del producto para mostrar en el frontend
  cantidad_suministrada: number; // Coincide con 'cantidad_suministrada' en Django
  colores?: string | null; // Coincide con 'colores' en Django
  valor_unitario: number; // Coincide con 'valor_unitario' en Django
  valor_total_producto?: number; // Calculado por Django, opcional en el frontend para envío
}

// Definición del tipo principal para un Movimiento de Stock
// Coincide con tu modelo Movimiento de Django
export interface Movimiento {
  id?: number;
  empresa: number; // ID de la Empresa (ForeignKey en Django)
  empresa_nombre?: string; // Nombre de la empresa para mostrar
  proveedor?: number | null; // ID del Proveedor (ForeignKey, null=True, blank=True)
  proveedor_nombre?: string; // Nombre del proveedor para mostrar
  almacen_destino?: number | null; // ID del Almacén de Destino (ForeignKey, null=True, blank=True)
  almacen_destino_nombre?: string; // Nombre del almacén de destino para mostrar
 estado?: 'Pendiente' | 'Aceptado' | 'Rechazado';

  fecha_llegada: string; // Fecha en formato string (YYYY-MM-DD), ya que es DateTimeField
  observaciones?: string | null; // TextField, puede ser null
  costo_transporte: number; // DecimalField
  monto_total_operacion?: number; // DecimalField, calculado por backend, opcional para envío



  detalles: MovimientoDetail[]; // Lista de detalles del movimiento
}


// Interfaz para los datos que se envían al backend al crear/actualizar un Movimiento (formData)
export interface MovimientoFormData {
  empresa: number;
  proveedor: number | null;
  almacen_destino: number | null;
  fecha_llegada: string; // Formato ISO 8601 (ej. "2025-06-26T14:30:00Z")
  observaciones?: string | null;
  costo_transporte: number;
  // monto_total_operacion no se envía, se calcula en el backend
  detalles: DetalleMovimientoFormData[]; // Aquí los detalles pueden no tener ID si son nuevos
}

// Interfaz para los detalles de movimiento al enviar en el formulario (puede que no tengan ID)
export interface DetalleMovimientoFormData {
  id?: number; // Para identificar si es un detalle existente al editar
  producto: number; // ID del producto
  cantidad_suministrada: number;
  colores?: string | null;
  valor_unitario: number;
  // valor_total_producto no se envía, se calcula en el backend
}

// Interfaz para filtros de la API de Movimientos
export interface MovimientoFilters extends FilterParams {
  // Aquí van tus filtros específicos de movimientos
  search?: string;
  empresa?: number;
  proveedor?: number;
  almacen_destino?: number;
   estado?: 'Pendiente' | 'Aceptado' | 'Rechazado';
}