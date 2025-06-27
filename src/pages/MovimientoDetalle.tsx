import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import api from '@/services/api';

// Importa los tipos necesarios
import { Movimiento } from '@/types/movimientos';

// Importa componentes de UI
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton'; // Para el estado de carga
import { AlertTriangle, Home, Loader2, Edit, CalendarIcon, Package, DollarSign, Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator'; // Si tienes un componente Separator

const MovimientoDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // Obtiene el ID de la URL
  const navigate = useNavigate();

  // Query para obtener los detalles de un movimiento específico por su ID
  const { 
    data: movimiento, 
    isLoading, 
    isError, 
    error 
  } = useQuery<Movimiento, Error>({
    queryKey: ['movimiento', id], // La key de la query incluye el ID
    queryFn: () => {
      if (!id) {
        // Esto no debería pasar si la ruta está bien configurada con :id, pero es una buena práctica
        throw new Error("ID de movimiento no proporcionado.");
      }
      return api.getMovimientoById(Number(id)); // Asegúrate de que tu API acepte el ID como número
    },
    enabled: !!id, // Solo ejecuta la query si hay un ID
    staleTime: 5 * 60 * 1000, // Los datos se consideran "fresh" por 5 minutos
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 bg-background text-foreground">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    const errorMessage = error?.message || "Error desconocido al cargar los detalles del movimiento.";
    toast({ variant: "destructive", title: "Error", description: errorMessage });
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-64px)] p-4 bg-background text-foreground">
        <AlertTriangle className="h-12 w-12 mb-4 text-red-500" />
        <h3 className="text-xl font-bold text-red-600 mb-2">Error al cargar el movimiento</h3>
        <p className="text-muted-foreground text-center">{errorMessage}</p>
        <Button onClick={() => navigate('/movimientos')} className="mt-4">
          Volver a Movimientos
        </Button>
      </div>
    );
  }

  if (!movimiento) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-64px)] p-4 bg-background text-foreground">
        <AlertTriangle className="h-12 w-12 mb-4 text-orange-500" />
        <h3 className="text-xl font-bold text-orange-600 mb-2">Movimiento no encontrado</h3>
        <p className="text-muted-foreground text-center">El movimiento solicitado no existe o no está disponible.</p>
        <Button onClick={() => navigate('/movimientos')} className="mt-4">
          Volver a Movimientos
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-primary font-heading">
          Detalles del Movimiento #{movimiento.id}
        </h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/movimientos')}
            className="text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <Home className="mr-2 h-4 w-4" /> Volver a Movimientos
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(`/movimientos/editar/${movimiento.id}`)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Edit className="mr-2 h-4 w-4" /> Editar Movimiento
          </Button>
        </div>
      </div>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold">Información General</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
            <p><span className="font-semibold">Fecha de Llegada:</span> {new Date(movimiento.fecha_llegada).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <p><span className="font-semibold">Tipo:</span> {movimiento.proveedor ? 'Entrada' : 'Salida'}</p>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
    <Home className="h-5 w-5 text-muted-foreground" />
    <p><span className="font-semibold">Empresa:</span> {movimiento.empresa_nombre || 'N/A'}</p>
  </div>

  {/* LÍNEA CORREGIDA PARA PROVEEDOR (ya estaba bien si tu API manda proveedor_nombre) */}
  {movimiento.proveedor_nombre && (
    <div className="flex items-center gap-2">
      <Package className="h-5 w-5 text-muted-foreground" />
      <p><span className="font-semibold">Proveedor:</span> {movimiento.proveedor_nombre}</p>
    </div>
  )}
  {/* LÍNEA CORREGIDA PARA ALMACÉN (ya estaba bien si tu API manda almacen_destino_nombre) */}
  {movimiento.almacen_destino_nombre && (
    <div className="flex items-center gap-2">
      <Package className="h-5 w-5 text-muted-foreground" />
      <p><span className="font-semibold">Almacén:</span> {movimiento.almacen_destino_nombre}</p>
    </div>
  )}
          {movimiento.observaciones && (
            <div className="md:col-span-2">
              <p className="font-semibold">Observaciones:</p>
              <p className="ml-2 text-muted-foreground">{movimiento.observaciones}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold">Detalles de Productos</CardTitle>
        </CardHeader>
        <CardContent>
          {movimiento.detalles && movimiento.detalles.length > 0 ? (
            <div className="space-y-4">
              {movimiento.detalles.map((detalle, index) => (
                <div key={index} className="border p-4 rounded-md shadow-sm">
                  <h4 className="font-semibold text-lg text-secondary-foreground">
                    Producto: {detalle.producto_nombre || 'N/A'} ({detalle.producto || 'N/A'})
                  </h4>
                  <p><span className="font-medium">Cantidad Suministrada:</span> {detalle.cantidad_suministrada}</p>
                  <p><span className="font-medium">Valor Unitario:</span> ${Number(detalle.valor_unitario).toFixed(2)}</p>
                  {detalle.colores && (
                    <p><span className="font-medium">Colores:</span> {detalle.colores}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No hay detalles de productos para este movimiento.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
export default MovimientoDetalle;