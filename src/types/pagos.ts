
export interface Pago {
    id: number;
    venta: number; // ID de la Venta asociada
    venta_id?: number; // Puede ser útil para mostrar en la UI, pero el backend espera 'venta'
    cliente: number; // ID del CustomUser que realizó el pago
    cliente_nombre?: string; // Nombre del cliente (read-only del backend)
    cliente_email?: string; // Email del cliente (read-only del backend)
    empresa: number; // ID de la Empresa que recibió el pago
    empresa_nombre?: string; // Nombre de la empresa (read-only del backend)
    monto: string; // Monto del pago (usar string para Decimal)
    fecha_pago: string; // Fecha y hora del pago (ISO string)
    metodo_pago: 'STRIPE' | 'QR' | 'EFECTIVO' | 'TRANSFERENCIA' | string;
    referencia_transaccion?: string | null;
    estado_pago: 'PENDIENTE' | 'COMPLETADO' | 'FALLIDO' | string;
    fecha_creacion?: string; // Campo de auditoría (read-only)
}
