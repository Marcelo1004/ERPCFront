// src/types/empresas.ts

// Puedes importar la interfaz Suscripcion si quieres un tipado más fuerte para suscripcion_detail
import { Suscripcion } from './suscripciones'; 

// Puedes importar la interfaz User (o un subconjunto de ella) si quieres un tipado más fuerte para admin_empresa_detail
// Para evitar circularidades, a veces se define un tipo más ligero para el detalle en este punto.
// Por ejemplo:
interface UserBasicInfo {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface Empresa {
  id: number;
  nombre: string;
  nit?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email_contacto?: string | null;
  logo?: string | null; // La URL de la imagen si ya está subida
  fecha_registro: string; // La fecha se maneja como string desde Django
  is_active: boolean;
   descripcion_corta?: string;

  suscripcion?: number | null; // ID de la Suscripcion (para enviar en peticiones)
  suscripcion_detail?: Suscripcion | null; // Detalles de la Suscripcion (para recibir en respuestas)

  admin_empresa?: number | null; // ID del usuario administrador de la empresa
  admin_empresa_detail?: UserBasicInfo | null; // Detalles básicos del usuario administrador
}