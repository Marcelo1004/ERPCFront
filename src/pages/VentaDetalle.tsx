// src/pages/VentaDetalle.tsx

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Calendar, User, DollarSign, Info, Loader2, AlertTriangle, Edit } from 'lucide-react';
import api from '@/services/api';
import { Venta } from '@/types/ventas'; // Asegúrate de que DetalleVenta ya está anidado en Venta si lo esperas así
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const VentaDetalle: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();

  // console.log para verificar el ID de la URL
  console.log('VentaDetalle: ID de la URL ->', id);

  // Query para obtener los detalles de la venta por su ID
  const { data: venta, isLoading, isError, error } = useQuery<Venta, Error>({
    queryKey: ['ventaDetalle', id],
    queryFn: async () => {
      if (!id) {
        // Esto solo debería ocurrir si la ruta no pasa un ID, pero es una buena salvaguarda.
        console.error('VentaDetalle: ID de venta es undefined.');
        throw new Error('ID de venta no proporcionado.');
      }
      const parsedId = Number(id);
      if (isNaN(parsedId)) {
        console.error('VentaDetalle: ID de venta no es un número válido:', id);
        throw new Error('ID de venta inválido.');
      }
      console.log('VentaDetalle: Llamando a api.getVentaById con ID ->', parsedId);
      return api.getVentaById(parsedId); // Llama a la función de la API con el ID parseado
    },
    // Solo ejecuta la query si el ID está presente y es un número válido después de parsearlo
    enabled: !!id && !isNaN(Number(id)), 
    staleTime: 1000 * 60 * 5, // Los datos se consideran frescos por 5 minutos
  });

  console.log('VentaDetalle: isLoading ->', isLoading);
  console.log('VentaDetalle: isError ->', isError);
  console.log('VentaDetalle: venta data ->', venta);


  // Determinar si el usuario actual tiene permisos para editar la venta
  const canEdit = user?.is_superuser || user?.role?.name === 'Administrador';


  // Manejar estados de carga y error
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Cargando detalles de la venta...</p>
      </div>
    );
  }

  if (isError || !venta) { // Si hay un error o la venta no se encontró
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-background text-destructive">
        <AlertTriangle className="h-12 w-12 mb-2" />
        <h3 className="text-lg font-medium text-destructive-foreground">Venta no encontrada o error de carga</h3>
        <p className="text-muted-foreground">La venta con ID "{id}" no existe o hubo un problema al cargarla.</p>
        <p className="text-sm text-muted-foreground mt-1">{error?.message}</p>
        <Link to="/ventas">
          <Button variant="link" className="mt-4 text-primary">Volver al listado de ventas</Button>
        </Link>
      </div>
    );
  }

  // Si la venta se cargó correctamente, mostrar los detalles
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground min-h-screen-minus-header">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-primary font-heading">
          Detalle de Venta #{venta.id}
        </h1>
        <div className="flex gap-2">
            {canEdit && (
                <Link to={`/ventas/editar/${venta.id}`}>
                    <Button variant="secondary" className="text-primary-foreground hover:bg-secondary/80">
                        <Edit className="mr-2 h-4 w-4" /> Editar Venta
                    </Button>
                </Link>
            )}
            <Link to="/ventas">
                <Button variant="outline" className="text-muted-foreground border-border hover:bg-background/80">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Ventas
                </Button>
            </Link>
        </div>
      </div>

      <Card className="bg-card text-card-foreground border-border shadow-lg mb-6">
        <CardHeader>
          <CardTitle className="font-semibold text-xl">Información General</CardTitle>
          <CardDescription className="text-muted-foreground">Datos principales de la venta y el cliente.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <p className="text-base">
              <span className="font-semibold">Fecha:</span>{' '}
              {venta.fecha ? new Date(venta.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <p className="text-base">
              <span className="font-semibold">Cliente:</span> {venta.usuario_nombre || 'N/A'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <p className="text-base">
              <span className="font-semibold">Monto Total:</span> ${Number(venta.monto_total).toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-muted-foreground" />
            <p className="text-base">
              <span className="font-semibold">Estado:</span> {venta.estado}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold text-xl">Productos de la Venta</CardTitle>
          <CardDescription className="text-muted-foreground">Detalles de los productos incluidos en esta venta.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted/90">
                  <TableHead className="text-muted-foreground">Producto</TableHead>
                  <TableHead className="text-muted-foreground text-right">Cantidad</TableHead>
                  <TableHead className="text-muted-foreground text-right">Precio Unitario</TableHead>
                  <TableHead className="text-muted-foreground text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venta.detalles && venta.detalles.length > 0 ? (
                  venta.detalles.map((detalle) => (
                    <TableRow key={detalle.id || `${detalle.producto}-${detalle.cantidad}-${detalle.precio_unitario}`}>
                      <TableCell className="font-medium">{detalle.producto_nombre || 'Producto Desconocido'}</TableCell>
                      <TableCell className="text-right">{detalle.cantidad}</TableCell>
                      <TableCell className="text-right">${Number(detalle.precio_unitario).toFixed(2)}</TableCell>
                      <TableCell className="text-right">${(detalle.cantidad * Number(detalle.precio_unitario)).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                      No hay productos en esta venta.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VentaDetalle;