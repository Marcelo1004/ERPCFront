export interface Proveedor {
  id: number;
  empresa: number; // ID de la empresa
  empresa_detail?: { id: number; nombre: string; nit?: string; } | null; // Detalles de la empresa para mostrar en el frontend
  nombre: string;
  contacto_nombre: string | null; // Coincide con models.py
  contacto_email: string | null;  // Coincide con models.py
  contacto_telefono: string | null; // Coincide con models.py
  direccion: string | null;
  nit: string | null;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

// Interfaz para los datos que el formulario envía al backend
// No incluye 'id' porque es para creación/actualización donde 'id' se maneja por URL o es auto-generado.
// Los campos pueden ser opcionales (Partial) si no todos son obligatorios en tu backend para PATCH.
export interface ProveedorFormData {
  nombre: string;
  contacto_nombre?: string | null; // Coincide con models.py y puede ser opcional
  contacto_email?: string | null;  // Coincide con models.py y puede ser opcional
  contacto_telefono?: string | null; // Coincide con models.py y puede ser opcional
  direccion?: string | null;
  nit?: string | null;
  activo: boolean;
  empresa: number | undefined; // Siempre será un ID numérico o undefined al inicializar
}


// Actualiza ProveedorFilters para incluir `page_size` y otros filtros comunes
export interface ProveedorFilters {
    search?: string;
    ordering?: string;
    page?: number;
    page_size?: number; // <--- AÑADIDO AQUÍ
    empresa?: number; // <--- Asegúrate de que este también esté si se usa
    [key: string]: string | number | boolean | undefined; // Permite otras propiedades si es necesario
}

// Puedes mantener esta si la usas en algún lugar, pero ProveedorFilters es la que nos importa ahora
export interface ProveedoresApiResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Proveedor[];
}