import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { Pencil, Trash2, PlusCircle, RotateCcw, Eye } from 'lucide-react'; // ¡Importa Eye!
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react'; // Asegúrate que AlertTriangle esté correctamente importado
import api from '@/services/api';
import { Venta } from '@/types/ventas';
import { useAuth } from '@/contexts/AuthContext';

const Ventas: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: ventas, isLoading, isError, error } = useQuery<Venta[], Error>({
    queryKey: ['ventas', user?.empresa_detail?.id, user?.is_superuser],
    queryFn: async () => {
      const filters: any = {};
      if (user && !user.is_superuser && user.empresa_detail?.id) {
        filters.empresa = user.empresa_detail.id;
      }
      const response = await api.fetchVentas(filters);
      return response.results;
    },
    enabled: !!user,
  });

  const cancelVentaMutation = useMutation<Venta, Error, number>({
    mutationFn: (ventaId) => api.cancelarVenta(ventaId),
    onSuccess: (updatedVenta) => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      toast({
        title: 'Venta Cancelada',
        description: `La venta #${updatedVenta.id} ha sido cancelada y el stock ajustado.`,
      });
    },
    onError: (err: any) => {
      let errorMessage = 'Error al cancelar la venta.';
      if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = `Error: ${err.response.data.detail}`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      toast({
        title: 'Error al Cancelar Venta',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const deleteVentaMutation = useMutation<any, Error, number>({
    mutationFn: (ventaId) => api.deleteVenta(ventaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas'] });
      toast({
        title: 'Venta Eliminada',
        description: 'La venta ha sido eliminada y el stock ajustado.',
      });
    },
    onError: (err: any) => {
      let errorMessage = 'Error al eliminar la venta.';
      if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = `Error: ${err.response.data.detail}`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      toast({
        title: 'Error al Eliminar Venta',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  const handleCancelClick = (ventaId: number) => {
    if (window.confirm(`¿Estás seguro de que quieres CANCELAR la venta #${ventaId}? Esto ajustará el stock.`)) {
      cancelVentaMutation.mutate(ventaId);
    }
  };

  const handleDeleteClick = (ventaId: number) => {
    if (window.confirm(`¿Estás seguro de que quieres ELIMINAR la venta #${ventaId} permanentemente? Esto también ajustará el stock.`)) {
      deleteVentaMutation.mutate(ventaId);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-background text-destructive">
        <AlertTriangle className="h-12 w-12 mb-2" />
        <h3 className="text-lg font-medium text-destructive-foreground">Error al cargar ventas</h3>
        <p className="text-muted-foreground">No se pudieron obtener las ventas. Detalles: {error?.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-primary font-heading">Listado de Ventas</h1>
        <Link to="/ventas/crear">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <PlusCircle className="mr-2 h-4 w-4" /> Crear Nueva Venta
          </Button>
        </Link>
      </div>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold">Ventas Registradas</CardTitle>
        </CardHeader>
        <CardContent>
          {ventas && ventas.length === 0 ? (
            <p className="text-center text-muted-foreground">No hay ventas registradas aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas?.map((venta) => (
                    <TableRow key={venta.id}>
                      <TableCell className="font-medium">{venta.id}</TableCell>
                      <TableCell>{new Date(venta.fecha).toLocaleString()}</TableCell>
                      <TableCell>{venta.empresa_nombre}</TableCell>
                      <TableCell>{venta.usuario_nombre}</TableCell>
                      <TableCell>${Number(venta.monto_total).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${venta.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${venta.estado === 'Completada' ? 'bg-green-100 text-green-800' : ''}
                          ${venta.estado === 'Cancelada' ? 'bg-red-100 text-red-800' : ''}
                        `}>
                          {venta.estado}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2 flex justify-end">
                        {/* Botón para VER Detalles de Venta */}
                        <Link to={`/ventas/${venta.id}`}> {/* Esta ruta apunta a VentaDetalle */}
                          <Button variant="outline" size="icon" title="Ver Detalles">
                            <Eye className="h-4 w-4 text-gray-600" /> {/* Ícono de ojo */}
                          </Button>
                        </Link>
                        
                        {/* Botón de Cancelar Pedido (solo si no está cancelada) */}
                        {venta.estado !== 'Cancelada' && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleCancelClick(venta.id)}
                            title="Cancelar Venta"
                            disabled={cancelVentaMutation.isPending || deleteVentaMutation.isPending}
                            className="border-orange-400 text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Botón para EDITAR Venta */}
                        <Link to={`/ventas/editar/${venta.id}`}>
                          <Button variant="outline" size="icon" title="Editar Venta">
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                        </Link>
                        
                        {/* Botón de Eliminar Venta */}
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleDeleteClick(venta.id)}
                          title="Eliminar Venta"
                          disabled={cancelVentaMutation.isPending || deleteVentaMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Ventas;