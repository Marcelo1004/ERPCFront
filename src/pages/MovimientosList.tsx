import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api, { PaginatedResponse, FilterParams } from '@/services/api'; 

// Importa los tipos necesarios
import { Movimiento, MovimientoFilters } from '@/types/movimientos';
import { Proveedor } from '@/types/proveedores';
import { Almacen } from '@/types/almacenes';
import { Empresa } from '@/types/empresas';

// Importa los componentes de UI de Shadcn
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';

// Nuevos imports para DropdownMenu y iconos para acciones
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  PlusCircle,
  Edit,
  Trash2,
  Search,
  AlertTriangle,
  Loader2,
  Home,
  Eye,
  Filter,
  RotateCcw,
  Check, 
  X,     
} from 'lucide-react';


const MovimientosList: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // --- Estados para filtros y búsqueda (valores de UI) ---
  const [searchInputValue, setSearchInputValue] = useState<string>('');
  const [selectedEmpresaFilter, setSelectedEmpresaFilter] = useState<string>('all'); 
  const [selectedProveedorFilter, setSelectedProveedorFilter] = useState<string>('all'); 
  const [selectedAlmacenFilter, setSelectedAlmacenFilter] = useState<string>('all'); 
  // ¡CORRECCIÓN DE TIPO AQUÍ!
  const [selectedEstadoFilter, setSelectedEstadoFilter] = useState<'all' | 'Pendiente' | 'Aceptado' | 'Rechazado'>('all'); 
  
  // --- Estado para los filtros que realmente se envían a la API (después de aplicar) ---
  const [apiFilters, setApiFilters] = useState<MovimientoFilters>({
    page: 1,
    page_size: 10,
    search: '',
    empresa: undefined, 
    proveedor: undefined,
    almacen_destino: undefined,
    estado: undefined, 
  });

  // --- Estados para los diálogos de confirmación ---
  const [showConfirmDeleteDialog, setShowConfirmDeleteDialog] = useState<boolean>(false);
  const [movimientoToDeleteId, setMovimientoToDeleteId] = useState<number | null>(null);

  const [showConfirmAcceptDialog, setShowConfirmAcceptDialog] = useState<boolean>(false); 
  const [movimientoToAcceptId, setMovimientoToAcceptId] = useState<number | null>(null); 

  const [showConfirmRejectDialog, setShowConfirmRejectDialog] = useState<boolean>(false); 
  const [movimientoToRejectId, setMovimientoToRejectId] = useState<number | null>(null); 


  // --- Permisos ---
  const canViewMovimientos = hasPermission('view_movimiento');
  const canAddMovimientos = hasPermission('add_movimiento');
  const canChangeMovimientos = hasPermission('change_movimiento'); 
  const canDeleteMovimientos = hasPermission('delete_movimiento');
  const canManageMovimientos = canAddMovimientos || canChangeMovimientos || canDeleteMovimientos;

  // --- QUERIES DE DATOS ---

  // 1. Query principal para obtener la lista de movimientos
  const { 
    data: movimientosData, 
    isLoading: isLoadingMovimientos, 
    error: movimientosError, 
    isError: isErrorMovimientos 
  } = useQuery<PaginatedResponse<Movimiento>, Error>({
    queryKey: ['movimientosList', apiFilters], 
    queryFn: async ({ queryKey }) => {
      const [_key, currentApiFilters] = queryKey as [string, MovimientoFilters]; 
      
      const filtersToSend: MovimientoFilters = { ...currentApiFilters }; 
      
      if (!currentUser?.is_superuser && currentUser?.empresa_detail?.id) {
        filtersToSend.empresa = currentUser.empresa_detail.id;
      } else if (!currentUser?.is_superuser && !currentUser?.empresa_detail?.id) {
         return { count: 0, next: null, previous: null, results: [] };
      }

      console.log('QueryFn: Filters being sent to API:', filtersToSend);
      
      const response = await api.fetchMovimientos(filtersToSend);
      return response;
    },
    enabled: !!currentUser?.id && canViewMovimientos, 
    placeholderData: (previousData) => previousData, 
    staleTime: 5 * 60 * 1000,
  });

  const movimientos = movimientosData?.results || [];
  const totalItems = movimientosData?.count || 0;
  const totalPages = Math.ceil(totalItems / (apiFilters.page_size || 10)); 

  // 2. Query para obtener todas las empresas (solo si es superusuario o ya tiene una empresa)
  const { 
    data: empresasData, 
    isLoading: isLoadingEmpresas, 
    error: empresasError, 
    isError: isErrorEmpresas 
  } = useQuery<PaginatedResponse<Empresa>, Error>({
    queryKey: ['empresasForMovimientosFilter'],
    queryFn: () => api.fetchEmpresas({ page_size: 1000 }),
    enabled: !!currentUser?.is_superuser || !!currentUser?.empresa_detail?.id, 
    staleTime: 5 * 60 * 1000,
  });
  const empresas = empresasData?.results || [];

  // Función para determinar si las consultas de proveedores/almacenes deben estar habilitadas
  const shouldEnableRelatedFilters = useMemo(() => {
    const superUserHasSelectedCompany = currentUser?.is_superuser && selectedEmpresaFilter !== 'all';
    const regularUserHasCompany = !currentUser?.is_superuser && !!currentUser?.empresa_detail?.id;
    
    return regularUserHasCompany || superUserHasSelectedCompany; // Orden cambiado para claridad
  }, [currentUser, selectedEmpresaFilter]);


  // 3. Query para obtener proveedores (filtrados por empresa si es necesario)
  const { 
    data: proveedoresData, 
    isLoading: isLoadingProveedores, 
    error: proveedoresError, 
    isError: isErrorProveedores 
  } = useQuery<PaginatedResponse<Proveedor>, Error>({
    queryKey: ['proveedoresForMovimientosFilter', selectedEmpresaFilter, currentUser?.empresa_detail?.id],
    queryFn: async ({ queryKey }) => {
      const [_key, empresaIdFilterStr] = queryKey as [string, string]; // Explicitly cast to string
      const filters: FilterParams = { page_size: 1000 };

      let effectiveEmpresaId: number | undefined;

      if (currentUser?.is_superuser && empresaIdFilterStr && empresaIdFilterStr !== 'all') {
        effectiveEmpresaId = Number(empresaIdFilterStr);
      } else if (!currentUser?.is_superuser && currentUser?.empresa_detail?.id) {
        effectiveEmpresaId = currentUser.empresa_detail.id;
      } else {
        return { count: 0, next: null, previous: null, results: [] };
      }
      
      filters.empresa = effectiveEmpresaId;
      const response = await api.fetchProveedores(filters); // Acepta FilterParams
      return response;
    },
    enabled: shouldEnableRelatedFilters, 
    staleTime: 5 * 60 * 1000,
  });
  const proveedores = proveedoresData?.results || [];

  // 4. Query para obtener almacenes (filtrados por empresa si es necesario)
  const { 
    data: almacenesData, 
    isLoading: isLoadingAlmacenes, 
    error: almacenesError, 
    isError: isErrorAlmacenes 
  } = useQuery<PaginatedResponse<Almacen>, Error>({
    queryKey: ['almacenesForMovimientosFilter', selectedEmpresaFilter, currentUser?.empresa_detail?.id],
    queryFn: async ({ queryKey }) => {
      const [_key, empresaIdFilterStr] = queryKey as [string, string]; // Explicitly cast to string
      const filters: FilterParams = { page_size: 1000 };

      let effectiveEmpresaId: number | undefined;

      if (currentUser?.is_superuser && empresaIdFilterStr && empresaIdFilterStr !== 'all') {
        effectiveEmpresaId = Number(empresaIdFilterStr);
      } else if (!currentUser?.is_superuser && currentUser?.empresa_detail?.id) {
        effectiveEmpresaId = currentUser.empresa_detail.id;
      } else {
        return { count: 0, next: null, previous: null, results: [] };
      }
      
      filters.empresa = effectiveEmpresaId;
      const response = await api.fetchAlmacenes(filters); // Acepta FilterParams
      return response;
    },
    enabled: shouldEnableRelatedFilters,
    staleTime: 5 * 60 * 1000,
  });
  const almacenes = almacenesData?.results || [];

  // --- MUTACIONES ---
  const deleteMovimientoMutation = useMutation<void, Error, number>({
    mutationFn: (id: number) => api.deleteMovimiento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimientosList'] });
      toast({ title: "Movimiento eliminado", description: "El movimiento de stock ha sido eliminado y el stock revertido." });
      setShowConfirmDeleteDialog(false);
    },
    onError: (err: any) => {
      console.error("Error al eliminar movimiento:", err.response?.data || err.message);
      let errorMessage = 'No se pudo eliminar el movimiento.';
      if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = `Error: ${err.response.data.detail}`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      toast({ variant: "destructive", title: "Error al eliminar movimiento", description: errorMessage });
      setShowConfirmDeleteDialog(false);
    },
  });

  const aceptarMovimientoMutation = useMutation<any, Error, number>({
    mutationFn: (id: number) => api.aceptarMovimiento(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['movimientosList'] });
      toast({ title: "Movimiento Aceptado", description: `El movimiento #${data?.movimiento_id || ''} ha sido aceptado y el stock ajustado.` });
      setShowConfirmAcceptDialog(false);
    },
    onError: (err: any) => {
      console.error("Error al aceptar movimiento:", err.response?.data || err.message);
      let errorMessage = 'No se pudo aceptar el movimiento.';
      if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = `Error: ${err.response.data.detail}`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      toast({ variant: "destructive", title: "Error al aceptar movimiento", description: errorMessage });
      setShowConfirmAcceptDialog(false);
    },
  });

  const rechazarMovimientoMutation = useMutation<any, Error, number>({
    mutationFn: (id: number) => api.rechazarMovimiento(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['movimientosList'] });
      toast({ title: "Movimiento Rechazado", description: `El movimiento #${data?.movimiento_id || ''} ha sido rechazado.` });
      setShowConfirmRejectDialog(false);
    },
    onError: (err: any) => {
      console.error("Error al rechazar movimiento:", err.response?.data || err.message);
      let errorMessage = 'No se pudo rechazar el movimiento.';
      if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = `Error: ${err.response.data.detail}`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      toast({ variant: "destructive", title: "Error al rechazar movimiento", description: errorMessage });
      setShowConfirmRejectDialog(false);
    },
  });


  // --- MANEJADORES DE EVENTOS ---

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleApplyFilters = () => {
    const newFilters: MovimientoFilters = {
      ...apiFilters, 
      search: searchInputValue,
      empresa: selectedEmpresaFilter === 'all' ? undefined : Number(selectedEmpresaFilter),
      proveedor: selectedProveedorFilter === 'all' ? undefined : Number(selectedProveedorFilter),
      almacen_destino: selectedAlmacenFilter === 'all' ? undefined : Number(selectedAlmacenFilter),
      estado: selectedEstadoFilter === 'all' ? undefined : selectedEstadoFilter, // selectedEstadoFilter ya es del tipo correcto gracias al useState
      page: 1, 
    };
    console.log('handleApplyFilters: Applying new filters:', newFilters);
    setApiFilters(newFilters);
  };

  const handleResetFilters = () => {
    setSearchInputValue('');
    setSelectedEmpresaFilter('all'); 
    setSelectedProveedorFilter('all');
    setSelectedAlmacenFilter('all');
    setSelectedEstadoFilter('all'); 

    const resetFilters: MovimientoFilters = {
      page: 1,
      page_size: 10,
      search: '',
      empresa: undefined,
      proveedor: undefined,
      almacen_destino: undefined,
      estado: undefined, 
    };
    console.log('handleResetFilters: Resetting filters to:', resetFilters);
    setApiFilters(resetFilters);
  };

  const confirmDelete = (id: number) => {
    setMovimientoToDeleteId(id);
    setShowConfirmDeleteDialog(true);
  };

  const executeDelete = () => {
    if (movimientoToDeleteId !== null) {
      deleteMovimientoMutation.mutate(movimientoToDeleteId);
    }
  };

  const confirmAccept = (id: number) => {
    setMovimientoToAcceptId(id);
    setShowConfirmAcceptDialog(true);
  };

  const executeAccept = () => {
    if (movimientoToAcceptId !== null) {
      aceptarMovimientoMutation.mutate(movimientoToAcceptId);
    }
  };

  const confirmReject = (id: number) => {
    setMovimientoToRejectId(id);
    setShowConfirmRejectDialog(true);
  };

  const executeReject = () => {
    if (movimientoToRejectId !== null) {
      rechazarMovimientoMutation.mutate(movimientoToRejectId);
    }
  };


  const handlePageChange = (newPage: number) => {
    console.log('handlePageChange: Changing page to:', newPage);
    setApiFilters(prev => ({ ...prev, page: newPage }));
  };
  const handlePageSizeChange = (newSize: string) => {
    console.log('handlePageSizeChange: Changing page size to:', newSize);
    setApiFilters(prev => ({ ...prev, page_size: Number(newSize), page: 1 }));
  };

  useEffect(() => {
    if (currentUser && !currentUser.is_superuser && currentUser.empresa_detail?.id && selectedEmpresaFilter === 'all') {
      const userEmpresaId = currentUser.empresa_detail.id.toString();
      setSelectedEmpresaFilter(userEmpresaId); 
      setApiFilters(prev => ({ ...prev, empresa: Number(userEmpresaId) }));
      console.log('useEffect: Setting default company filter for non-superuser:', userEmpresaId);
    }
  }, [currentUser, selectedEmpresaFilter, setSelectedEmpresaFilter, setApiFilters]);

  // --- RENDERIZADO CONDICIONAL: Carga, Error, Acceso Denegado ---

  if (!canViewMovimientos) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-64px)] p-4 bg-background text-foreground">
        <AlertTriangle className="h-12 w-12 mb-4 text-red-500" />
        <h3 className="text-xl font-bold text-red-600 mb-2">Acceso Denegado</h3>
        <p className="text-muted-foreground text-center">No tienes permisos para ver esta sección. Contacta a tu administrador.</p>
      </div>
    );
  }

  const showLoader = isLoadingMovimientos || isLoadingEmpresas || isLoadingProveedores || isLoadingAlmacenes || deleteMovimientoMutation.isPending || aceptarMovimientoMutation.isPending || rechazarMovimientoMutation.isPending;
  
  if (showLoader && (!movimientosData || !movimientosData.results.length)) { 
    return (
      <div className="p-4 md:p-6 space-y-4 bg-background text-foreground">
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

  const anyError = isErrorMovimientos || isErrorEmpresas || isErrorProveedores || isErrorAlmacenes; 
  if (anyError) {
    const errorMessage = movimientosError?.message || empresasError?.message || proveedoresError?.message || almacenesError?.message || 'Error desconocido al cargar los datos.';
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <AlertTriangle className="h-12 w-12 mb-4 text-red-500" />
        <h3 className="text-lg font-medium text-destructive-foreground">Error al cargar movimientos</h3>
        <p className="text-muted-foreground text-center">No se pudieron obtener los movimientos. Detalles: {errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-primary font-heading">Listado de Movimientos de Stock</h1>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGoToDashboard}
            className="text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            <Home className="mr-2 h-4 w-4" /> Volver al Dashboard
          </Button>
          {canAddMovimientos && (
            <Link to="/movimientos/crear">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <PlusCircle className="mr-2 h-4 w-4" /> Registrar Nuevo Movimiento
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader className="flex flex-row justify-between items-center flex-wrap gap-2"> 
          <CardTitle className="font-semibold">Filtros de Movimientos</CardTitle>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleResetFilters} disabled={showLoader}>
              <RotateCcw className="mr-2 h-4 w-4" /> Limpiar Filtros
            </Button>
            <Button onClick={handleApplyFilters} disabled={showLoader}>
              <Filter className="mr-2 h-4 w-4" /> Aplicar Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative col-span-full md:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                placeholder="Buscar por observaciones, productos..."
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-primary focus:border-primary"
                onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                    handleApplyFilters();
                    }
                }}
                disabled={showLoader}
                />
            </div>

            {/* Filtro por Empresa */}
            {currentUser?.is_superuser ? (
              <Select
                value={selectedEmpresaFilter}
                onValueChange={(value) => {
                  setSelectedEmpresaFilter(value);
                  setSelectedProveedorFilter('all'); 
                  setSelectedAlmacenFilter('all'); 
                }}
                disabled={showLoader || isLoadingEmpresas}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filtrar por Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Empresas</SelectItem> 
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
                <div className="flex flex-col justify-center gap-1">
                    <Label className="text-sm font-medium text-muted-foreground">Empresa Asignada:</Label>
                    <Input value={currentUser?.empresa_detail?.nombre || 'N/A'} disabled className="font-semibold" />
                </div>
            )}

            {/* Filtro por Proveedor */}
            <Select
              value={selectedProveedorFilter}
              onValueChange={setSelectedProveedorFilter}
              disabled={showLoader || isLoadingProveedores || proveedores.length === 0 || !shouldEnableRelatedFilters} 
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrar por Proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Proveedores</SelectItem> 
                {proveedores.map((prov) => (
                  <SelectItem key={prov.id} value={String(prov.id)}>
                    {prov.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro por Almacén */}
            <Select
              value={selectedAlmacenFilter}
              onValueChange={setSelectedAlmacenFilter}
              disabled={showLoader || isLoadingAlmacenes || almacenes.length === 0 || !shouldEnableRelatedFilters}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrar por Almacén" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Almacenes</SelectItem> 
                {almacenes.map((alm) => (
                  <SelectItem key={alm.id} value={String(alm.id)}>
                    {alm.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro: Estado del Movimiento */}
            <Select
              value={selectedEstadoFilter}
              onValueChange={(value: 'all' | 'Pendiente' | 'Aceptado' | 'Rechazado') => setSelectedEstadoFilter(value)}
              
              disabled={showLoader}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrar por Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Aceptado">Aceptado</SelectItem>
                <SelectItem value="Rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>

          </div>
        </CardContent>
      </Card>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold">Lista de Movimientos de Stock</CardTitle>
        </CardHeader>
        <CardContent>
          {showLoader && (!movimientosData || !movimientosData.results.length) ? (
            <div className="flex flex-col items-center justify-center p-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Cargando movimientos...</p>
            </div>
          ) : anyError ? (
            <div className="flex flex-col items-center justify-center p-8">
              <AlertTriangle className="h-12 w-12 mb-4 text-red-500" />
              <p className="text-red-500">Error al cargar los movimientos.</p>
              <p className="text-muted-foreground text-sm mt-2">Por favor, inténtelo de nuevo más tarde o contacte a soporte.</p>
            </div>
          ) : movimientos.length === 0 ? (
            <p className="text-center text-muted-foreground">No hay movimientos de stock registrados con los filtros actuales.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Fecha Llegada</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Almacén Destino</TableHead>
                    <TableHead>Costo Transporte</TableHead>
                    <TableHead>Monto Total</TableHead>
                    <TableHead>Estado</TableHead> 
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimientos.map((movimiento) => (
                    <TableRow key={movimiento.id}>
                      <TableCell className="font-medium">{movimiento.id}</TableCell>
                      <TableCell>{new Date(movimiento.fecha_llegada).toLocaleDateString()}</TableCell>
                      <TableCell>{movimiento.empresa_nombre || 'N/A'}</TableCell>
                      <TableCell>{movimiento.proveedor_nombre || 'N/A'}</TableCell>
                      <TableCell>{movimiento.almacen_destino_nombre || 'N/A'}</TableCell>
                      <TableCell>${Number(movimiento.costo_transporte).toFixed(2)}</TableCell>
                      <TableCell>${Number(movimiento.monto_total_operacion).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${movimiento.estado === 'Aceptado' ? 'bg-green-100 text-green-800' : ''}
                          ${movimiento.estado === 'Rechazado' ? 'bg-red-100 text-red-800' : ''}
                          ${movimiento.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' : ''}
                        `}>
                          {movimiento.estado}
                        </span>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Abrir menú</span>
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ellipsis"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {canViewMovimientos && (
                              <DropdownMenuItem onClick={() => navigate(`/movimientos/${movimiento.id}`)}>
                                <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                              </DropdownMenuItem>
                            )}
                            {canChangeMovimientos && movimiento.estado === 'Pendiente' && ( 
                              <DropdownMenuItem onClick={() => navigate(`/movimientos/editar/${movimiento.id}`)}>
                                <Edit className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                            )}
                            {canChangeMovimientos && movimiento.estado === 'Pendiente' && ( 
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => confirmAccept(Number(movimiento.id!))}>
                                <Check className="mr-2 h-4 w-4 text-green-600" /> Aceptar
                              </DropdownMenuItem>
                            )}
                            {canChangeMovimientos && movimiento.estado === 'Pendiente' && ( 
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => confirmReject(Number(movimiento.id!))}>
                                <X className="mr-2 h-4 w-4 text-red-600" /> Rechazar
                              </DropdownMenuItem>
                            )}
                            {canDeleteMovimientos && (
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => confirmDelete(Number(movimiento.id!))}>
                                <Trash2 className="mr-2 h-4 w-4 text-red-500" /> Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex justify-end items-center space-x-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(apiFilters.page! - 1)}
                    disabled={apiFilters.page === 1 || showLoader}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {apiFilters.page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => handlePageChange(apiFilters.page! + 1)}
                    disabled={apiFilters.page === totalPages || showLoader}
                  >
                    Siguiente
                  </Button>
                  <Select value={String(apiFilters.page_size)} onValueChange={handlePageSizeChange} disabled={showLoader}>
                      <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Tamaño" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de Confirmación de Eliminación */}
      <AlertDialog open={showConfirmDeleteDialog} onOpenChange={setShowConfirmDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el movimiento
              con ID #{movimientoToDeleteId} y sus datos asociados de nuestros servidores,
              y el stock de los productos involucrados será revertido (solo si el movimiento fue Aceptado).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMovimientoMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={deleteMovimientoMutation.isPending}>
              {deleteMovimientoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Confirmación para Aceptar Movimiento */}
      <AlertDialog open={showConfirmAcceptDialog} onOpenChange={setShowConfirmAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Aceptación de Movimiento</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres **Aceptar** el movimiento #{movimientoToAcceptId}?
              Esta acción ajustará el stock de los productos involucrados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aceptarMovimientoMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeAccept} disabled={aceptarMovimientoMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {aceptarMovimientoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, Aceptar Movimiento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de Confirmación para Rechazar Movimiento */}
      <AlertDialog open={showConfirmRejectDialog} onOpenChange={setShowConfirmRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Rechazo de Movimiento</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres **Rechazar** el movimiento #{movimientoToRejectId}?
              Esta acción marcará el movimiento como rechazado y no afectará el stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rechazarMovimientoMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeReject} disabled={rechazarMovimientoMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white">
              {rechazarMovimientoMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, Rechazar Movimiento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MovimientosList;