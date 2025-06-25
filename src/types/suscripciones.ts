export interface Suscripcion {
  id: number;
  nombre: string;
  descripcion?: string | null;
  cantidad_usuarios_permitidos: number;
   precio?: number;
}
