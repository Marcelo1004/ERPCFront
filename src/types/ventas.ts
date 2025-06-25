// src/types/ventas.ts

// Interfaz para el Detalle de Venta
export interface DetalleVenta {
  id?: number; // Puede ser opcional al crear un nuevo detalle
  producto: number; // ID del producto (ForeignKey)
  producto_nombre?: string; // <--- ¡AÑADE ESTA LÍNEA! Nombre del producto (para mostrar en el frontend, opcional)
  cantidad: number;
  precio_unitario: number; // Tu backend espera un número (DecimalField en DRF)
  venta?: number; // ID de la venta a la que pertenece (opcional al enviar en VentaSerializer anidado)
}

// Interfaz para la Venta
export interface Venta {
  id?: number; // Opcional al crear una nueva venta
  empresa: number; // ID de la empresa
  empresa_nombre?: string; // Nombre de la empresa (solo lectura, para mostrar)
  usuario: number; // ID del usuario (cliente)
  usuario_nombre?: string; // Nombre del usuario (solo lectura, para mostrar)
  fecha: string; // Fecha de la venta (string ISO 8601)
  monto_total: string; // Tu backend espera un string (DecimalField en DRF)
  estado: string;
  detalles?: DetalleVenta[]; // Lista de detalles de la venta (opcional)
}