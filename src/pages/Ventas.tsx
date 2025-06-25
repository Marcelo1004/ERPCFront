// src/pages/Ventas.tsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // Importa useMutation y useQueryClient
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Search, Eye, Edit, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Venta } from '@/types/ventas';
import api from '@/services/api';
import { toast } from '@/components/ui/use-toast'; // Importa toast
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'; // Importa componentes de AlertDialog

const Ventas: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrSuperuser = user?.is_superuser || user?.role === 'ADMINISTRATIVO';
  const queryClient = useQueryClient(); // Instancia de QueryClient

  const [searchTerm, setSearchTerm] = useState('');

  // UseQuery para obtener la lista de ventas
  const { data, isLoading, isError, error } = useQuery<any, Error, Venta[]>({
    queryKey: ['ventas', user?.empresa_detail?.id, user?.is_superuser, searchTerm],
    queryFn: async ({ queryKey }) => {
      const [_key, empresaId, isSuperUser, search] = queryKey;
      const filters: any = {};
      if (!isSuperUser && empresaId) {
        filters.empresa = empresaId;
      }
      if (search) {
        filters.search = search;
      }
      const response = await api.fetchVentas(filters);
      return response.results;
    },
    enabled: !!user,
    staleTime: 5 * 1000,
  });

  // === Nueva mutación para eliminar ventas ===
  const deleteVentaMutation = useMutation({
    mutationFn: (ventaId: number) => api.deleteVenta(ventaId),
    onSuccess: () => {
      toast({
        title: 'Venta Eliminada',
        description: 'La venta ha sido eliminada correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['ventas'] }); // Invalida la caché para refrescar la lista
      // Opcional: invalidar también el dashboard si afecta a las métricas de ventas
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Error al Eliminar',
        description: `No se pudo eliminar la venta: ${err.response?.data?.detail || err.message}`,
        variant: 'destructive',
      });
    },
  });


  // Manejar estado de carga
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Cargando ventas...</p>
      </div>
    );
  }

  // Manejar estado de error
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-background text-destructive">
        <AlertTriangle className="h-12 w-12 mb-2" />
        <h3 className="text-lg font-medium text-destructive-foreground">Error al cargar ventas</h3>
        <p className="text-muted-foreground">No se pudieron obtener las ventas. Por favor, intenta de nuevo más tarde.</p>
        <p className="text-sm text-muted-foreground mt-1">{error?.message}</p>
      </div>
    );
  }

  const ventas = data || [];

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground min-h-screen-minus-header">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary font-heading">Gestión de Ventas</h1>
        {isAdminOrSuperuser && (
          <Link to="/ventas/crear">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Nueva Venta
            </Button>
          </Link>
        )}
      </div>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold">Listado de Ventas</CardTitle>
          <CardDescription className="text-muted-foreground">Consulta y gestiona las ventas de tu empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar ventas por ID o cliente..."
              className="flex-1 bg-input border-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {/* Formato sin espacios en blanco para evitar warning */}
                <TableRow className="bg-muted hover:bg-muted/90"><TableHead className="text-muted-foreground">ID Venta</TableHead><TableHead className="text-muted-foreground">Fecha</TableHead><TableHead className="text-muted-foreground">Cliente</TableHead><TableHead className="text-muted-foreground text-right">Monto Total</TableHead><TableHead className="text-muted-foreground">Estado</TableHead><TableHead className="text-muted-foreground text-center">Acciones</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {ventas.length > 0 ? (
                  ventas.map((venta) => (
                    // Formato sin espacios en blanco para evitar warning
                    <TableRow key={venta.id} className="border-border hover:bg-background/50">
                      <TableCell className="font-medium">{venta.id}</TableCell>
                      <TableCell>{new Date(venta.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
                      <TableCell>{venta.usuario_nombre || 'N/A'}</TableCell>
                      <TableCell className="text-right">${Number(venta.monto_total).toFixed(2)}</TableCell>
                      <TableCell>
                        {venta.estado === 'Completada' && <span className="bg-green-100 text-green-800 px-2.5 py-0.5 rounded-full text-xs font-medium">Completada</span>}
                        {venta.estado === 'Pendiente' && <span className="bg-yellow-100 text-yellow-800 px-2.5 py-0.5 rounded-full text-xs font-medium">Pendiente</span>}
                        {venta.estado === 'Cancelada' && <span className="bg-red-100 text-red-800 px-2.5 py-0.5 rounded-full text-xs font-medium">Cancelada</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center items-center gap-2">
                          <Link to={`/ventas/${venta.id}`}>
                            <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10" title="Ver Detalles">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {isAdminOrSuperuser && (
                            <>
                              {/* === CAMBIO DE ESTILO DEL BOTÓN EDITAR === */}
                              <Link to={`/ventas/editar/${venta.id}`}>
                                <Button variant="secondary" size="icon" className="text-primary-foreground hover:bg-secondary/80" title="Editar Venta">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                              
                              {/* === IMPLEMENTACIÓN DEL BOTÓN ELIMINAR CON ALERTDIALOG === */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" title="Eliminar Venta" disabled={deleteVentaMutation.isPending}>
                                    {deleteVentaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card text-card-foreground p-6 rounded-lg shadow-lg">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-muted-foreground">
                                      Esta acción no se puede deshacer. Esto eliminará permanentemente la venta #{venta.id}
                                      y removerá sus datos de nuestros servidores.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="border-border bg-background text-foreground hover:bg-muted">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteVentaMutation.mutate(venta.id)}
                                      className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                      disabled={deleteVentaMutation.isPending}
                                    >
                                      {deleteVentaMutation.isPending ? 'Eliminando...' : 'Sí, eliminar venta'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                      No hay ventas registradas.
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

export default Ventas;