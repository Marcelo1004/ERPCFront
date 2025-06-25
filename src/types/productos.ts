// src/types/productos.ts
import { Categoria } from './categorias'; // Asegúrate de que esta importación exista si categoria_detail está aquí
import { Almacen } from './almacenes';   // Asegúrate de que esta importación exista si almacen_detail está aquí

export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string | null;
  precio: string; // DecimalField en Django se mapea comúnmente a string en TS
  stock: number;
  imagen?: string | File | null; // Puede ser una URL de imagen (string) o un objeto File para subida

  categoria?: number | null; // ID de la categoría
  categoria_detail?: { // Detalles de la categoría para lectura
    id: number;
    nombre: string;
  } | null;

  almacen?: number | null; // ID del almacén
  almacen_detail?: { // Detalles del almacén para lectura
    id: number;
    nombre: string;
    // Agrega las propiedades de sucursal aquí:
    sucursal: number; // El ID de la sucursal a la que pertenece este almacén
    sucursal_detail?: { // Detalles de la sucursal
      id: number;
      nombre: string;
    } | null;
  } | null;

  empresa: number; // ID de la empresa a la que pertenece
  empresa_detail?: { // Detalles de la empresa para lectura
    id: number;
    nombre: string;
  } | null;
}