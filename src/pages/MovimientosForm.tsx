import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';

import api, { PaginatedResponse } from '@/services/api'; 

import { useAuth } from '@/contexts/AuthContext';

// --- UI Components ---
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2, AlertTriangle, PlusCircle, MinusCircle, Home } from 'lucide-react';

// --- Tipos de Datos ---
import { Movimiento, MovimientoDetail, MovimientoFormData, DetalleMovimientoFormData } from '@/types/movimientos';
import { Empresa } from '@/types/empresas';
import { Proveedor } from '@/types/proveedores';
import { Almacen } from '@/types/almacenes';
import { Producto } from '@/types/productos';

// Función auxiliar para preprocesar IDs que vienen de selects (SIEMPRE devolverá STRING o cadena vacía)
const preprocessIdForSelectInput = (val: unknown) => {
  if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
    return ''; // Si es nulo, indefinido o cadena vacía, devuelve cadena vacía
  }
  return String(val); // De lo contrario, convierte a cadena para el Select
};

// Función auxiliar para preprocesar números para inputs numéricos
const preprocessNumberInput = (val: unknown) => {
  if (val === null || (typeof val === 'string' && val.trim() === '')) return null;
  const parsed = Number(val);
  return isNaN(parsed) ? null : parsed;
};

// --- Esquema de Validación con Zod ---
const formSchema = z.object({
  fecha_llegada: z.date({
    required_error: "La fecha de llegada es obligatoria.",
  }),
  tipo_movimiento: z.enum(['entrada', 'salida'], {
    required_error: "El tipo de movimiento es obligatorio.",
  }),
  
  // Empresa: El campo `field.value` del Select será `string`. Zod lo valida como `string` primero,
  // luego lo transforma a `number` para el tipo final de MovimientoFormValues.
  empresa: z.preprocess(
    preprocessIdForSelectInput, // Asegura que el valor de entrada sea siempre un string
    z.string().min(1, "La empresa es obligatoria.") // Valida la cadena (ej. no vacía)
  ).transform(val => Number(val)), // Transforma la cadena validada a un número

  // Proveedor: El campo `field.value` del Select será `string`. Puede ser opcional.
  proveedor: z.preprocess(
    preprocessIdForSelectInput,
    z.string() // Permite cadena vacía
  ).transform(val => val === '' ? null : Number(val)), // Si es cadena vacía, convierte a null; si no, a number

  // Almacén de Destino: Similar al proveedor
  almacen_destino: z.preprocess(
    preprocessIdForSelectInput,
    z.string() // Permite cadena vacía
  ).transform(val => val === '' ? null : Number(val)), // Si es cadena vacía, convierte a null; si no, a number

  observaciones: z.string().max(500, "Máximo 500 caracteres").optional().nullable(),
  costo_transporte: z.preprocess(
    preprocessNumberInput,
    z.number().min(0, "Debe ser un número positivo").optional().nullable()
  ),
  detalles: z.array(z.object({
    // Producto en detalles: Similar a empresa, proveedor, almacén.
    producto: z.preprocess(
      preprocessIdForSelectInput,
      z.string().min(1, "El producto es obligatorio.")
    ).transform(val => Number(val)), // Transforma a number

    cantidad_suministrada: z.preprocess(
      preprocessNumberInput,
      z.number().int().positive("La cantidad debe ser un número entero positivo.").nullable()
    ).refine(val => val !== null, "La cantidad suministrada es obligatoria."),
    colores: z.string().max(200, "Máximo 200 caracteres").optional().nullable(),
    valor_unitario: z.preprocess(
      preprocessNumberInput,
      z.number().positive("El valor unitario debe ser un número positivo.").nullable()
    ).refine(val => val !== null, "El valor unitario es obligatorio."),
  })).min(1, "Debe agregar al menos un detalle de producto."),
}).superRefine((data, ctx) => {
    // Estas validaciones ahora se realizan sobre los tipos ya transformados por .transform()
    // Es decir, `data.proveedor` y `data.almacen_destino` serán `number | null`.
    if (data.tipo_movimiento === 'entrada') {
        if (data.proveedor === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El proveedor es obligatorio para movimientos de entrada.",
                path: ['proveedor'],
            });
        }
        if (data.almacen_destino === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El almacén de destino es obligatorio para movimientos de entrada.",
                path: ['almacen_destino'],
            });
        }
    }
    if (data.tipo_movimiento === 'salida') {
        if (data.almacen_destino === null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El almacén de origen (destino) es obligatorio para movimientos de salida.",
                path: ['almacen_destino'],
            });
        }
        if (data.proveedor !== null) { // Si tiene un valor (no es null), es un error para salidas
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "El proveedor no debe especificarse para movimientos de salida.",
                path: ['proveedor'],
            });
        }
    }
});

// `MovimientoFormValues` ahora reflejará los tipos que Zod produce después de las transformaciones,
// es decir, `number | null` para los IDs.
type MovimientoFormValues = z.infer<typeof formSchema>;

const MovimientoForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser, hasPermission } = useAuth();
  const isEditMode = !!id;

  // --- Permisos ---
  const canCreate = hasPermission('add_movimiento');
  const canEdit = hasPermission('change_movimiento');
  const hasAccess = isEditMode ? canEdit : canCreate;

  // --- Configuración de React Hook Form ---
  const form = useForm<MovimientoFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fecha_llegada: new Date(),
      tipo_movimiento: 'entrada',
      observaciones: '',
      costo_transporte: 0,
      detalles: [{ producto: 0, cantidad_suministrada: 1, colores: '', valor_unitario: 0 }],
      proveedor: null, // Tipo esperado ahora es number | null
      almacen_destino: null, // Tipo esperado ahora es number | null
      empresa: undefined, // Se establecerá en useEffect
    },
  });

  // Watchers para campos condicionales
  const watchTipoMovimiento = form.watch('tipo_movimiento');
  const watchEmpresa = form.watch('empresa'); // `watchEmpresa` ahora observará el número (o null)

  // --- Carga de Datos para Selects (React Query) ---

  const { data: empresasData } = useQuery<PaginatedResponse<Empresa>, Error>({
    queryKey: ['empresas'],
    queryFn: () => api.fetchEmpresas({ page_size: 1000 }),
    enabled: currentUser?.is_superuser === true,
    staleTime: 5 * 60 * 1000,
  });
  const empresas = empresasData?.results || [];

  const { data: almacenesData } = useQuery<PaginatedResponse<Almacen>, Error>({
    queryKey: ['almacenes', watchEmpresa], 
    queryFn: async ({ queryKey }) => {
      const [_key, empresaId] = queryKey;
      console.log("Fetching almacenes for empresaId:", empresaId);
      // Validamos que empresaId sea un número y no nulo.
      if (typeof empresaId !== 'number' || empresaId === null) return { count: 0, next: null, previous: null, results: [] };
      return api.fetchAlmacenes({ empresa: empresaId, page_size: 1000 });
    },
    enabled: typeof watchEmpresa === 'number' && watchEmpresa !== null,
    staleTime: 5 * 60 * 1000,
  });
  const almacenes = almacenesData?.results || [];
  console.log("Almacenes disponibles en el Select:", almacenes);

  const { data: proveedoresData } = useQuery<PaginatedResponse<Proveedor>, Error>({
    queryKey: ['proveedores', watchEmpresa],
    queryFn: async ({ queryKey }) => {
      const [_key, empresaId] = queryKey;
      console.log("Fetching proveedores for empresaId:", empresaId);
      if (typeof empresaId !== 'number' || empresaId === null) return { count: 0, next: null, previous: null, results: [] };
      return api.fetchProveedores({ empresa: empresaId, page_size: 1000 });
    },
    enabled: (typeof watchEmpresa === 'number' && watchEmpresa !== null) && watchTipoMovimiento === 'entrada',
    staleTime: 5 * 60 * 1000,
  });
  const proveedores = proveedoresData?.results || [];
  console.log("Proveedores disponibles en el Select:", proveedores);

  const { data: productosData } = useQuery<PaginatedResponse<Producto>, Error>({
    queryKey: ['productos', watchEmpresa],
    queryFn: async ({ queryKey }) => {
      const [_key, empresaId] = queryKey;
      console.log("Fetching productos for empresaId:", empresaId);
      if (typeof empresaId !== 'number' || empresaId === null) return { count: 0, next: null, previous: null, results: [] };
      return api.fetchProductos({ empresa: empresaId, page_size: 1000 });
    },
    enabled: typeof watchEmpresa === 'number' && watchEmpresa !== null,
    staleTime: 5 * 60 * 1000,
  });
  const productos = productosData?.results || [];
  console.log("Productos disponibles en el Select:", productos);

  const { data: movimientoToEdit, isLoading: isLoadingMovimientoData } = useQuery<Movimiento, Error>({
    queryKey: ['movimiento', id],
    queryFn: () => api.getMovimientoById(Number(id!)),
    enabled: isEditMode,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    // Si estamos en modo edición y los datos de movimiento están cargados, poblar el formulario
    if (isEditMode && movimientoToEdit) {
      let inferredTipoMovimiento: MovimientoFormValues['tipo_movimiento'] = 'entrada';
      if (movimientoToEdit.proveedor) {
          inferredTipoMovimiento = 'entrada';
      } else if (movimientoToEdit.almacen_destino && movimientoToEdit.proveedor === null) {
          inferredTipoMovimiento = 'salida';
      }

      form.reset({
        fecha_llegada: new Date(movimientoToEdit.fecha_llegada),
        tipo_movimiento: inferredTipoMovimiento,
        empresa: movimientoToEdit.empresa, 
        almacen_destino: movimientoToEdit.almacen_destino || null, 
        proveedor: movimientoToEdit.proveedor || null, 
        observaciones: movimientoToEdit.observaciones || '',
        costo_transporte: movimientoToEdit.costo_transporte || 0,
        // Aseguramos que los detalles se mapeen correctamente
        detalles: movimientoToEdit.detalles.map(detail => ({
          producto: detail.producto, 
          cantidad_suministrada: detail.cantidad_suministrada,
          colores: detail.colores || '', // Aseguramos que sea string o cadena vacía
          valor_unitario: detail.valor_unitario,
        })),
      });
      // Asignar empresa para usuarios no-superusuarios o si es superusuario y la empresa ya está definida
      if (currentUser?.is_superuser && movimientoToEdit.empresa) {
        form.setValue('empresa', movimientoToEdit.empresa);
      } else if (!currentUser?.is_superuser && currentUser?.empresa_detail?.id) {
          form.setValue('empresa', currentUser.empresa_detail.id);
      }
    } 
    // En modo creación, si no es superusuario, pre-rellenar la empresa.
    else if (!isEditMode && currentUser && !currentUser.is_superuser && currentUser.empresa_detail?.id) {
        form.setValue('empresa', currentUser.empresa_detail.id);
    }
  }, [movimientoToEdit, isEditMode, currentUser, form]);

  const createMovimientoMutation = useMutation<Movimiento, Error, MovimientoFormData>({
    mutationFn: (newMovimiento) => {
      console.log("Enviando datos de creación:", newMovimiento);
      return api.createMovimiento(newMovimiento);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['movimientosList'] });
      toast({ title: "Movimiento registrado", description: "El movimiento de stock ha sido creado exitosamente." });
      console.log("Movimiento creado exitosamente:", data);
      navigate('/movimientos');
    },
    onError: (err: any) => {
      console.error("Error al crear movimiento:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.detail || err.message || "Error al crear movimiento.";
      toast({ variant: "destructive", title: "Error al crear movimiento", description: errorMessage });
    },
  });

  const updateMovimientoMutation = useMutation<Movimiento, Error, { id: number; data: Partial<MovimientoFormData> }>({
    mutationFn: ({ id, data }) => {
      console.log("Enviando datos de actualización:", { id, data });
      return api.updateMovimiento(id, data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['movimientosList'] });
      queryClient.invalidateQueries({ queryKey: ['movimiento', id] });
      toast({ title: "Movimiento actualizado", description: "El movimiento de stock ha sido actualizado exitosamente." });
      console.log("Movimiento actualizado exitosamente:", data);
      navigate('/movimientos');
    },
    onError: (err: any) => {
      console.error("Error al actualizar movimiento:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.detail || err.message || "Error al actualizar movimiento.";
      toast({ variant: "destructive", title: "Error al actualizar movimiento", description: errorMessage });
    },
  });

  const onSubmit = (values: MovimientoFormValues) => {
    console.log("onSubmit activado. Valores del formulario (antes de enviar a API):", values);
    
    // Los 'values' ya tienen los IDs como `number | null` gracias a las transformaciones de Zod.
    const dataToSend: MovimientoFormData = {
      fecha_llegada: values.fecha_llegada.toISOString().split('T')[0],
      empresa: values.empresa, 
      observaciones: values.observaciones || null,
      costo_transporte: values.costo_transporte || 0,
      proveedor: values.proveedor, 
      almacen_destino: values.almacen_destino, 
      detalles: values.detalles.map(d => ({
        producto: d.producto, 
        cantidad_suministrada: d.cantidad_suministrada,
        colores: d.colores === "" || typeof d.colores === 'undefined' ? null : d.colores, // Aseguramos null para cadena vacía
        valor_unitario: d.valor_unitario,
      })),
    };

    // Aseguramos que proveedor sea null si el tipo de movimiento es salida,
    // ya que el backend no debería recibir un proveedor para una salida.
    if (values.tipo_movimiento === 'salida') {
        dataToSend.proveedor = null;
    }

    console.log("Datos finales a enviar a la API:", dataToSend);

    if (isEditMode && id) {
      updateMovimientoMutation.mutate({ id: Number(id), data: dataToSend });
    } else {
      createMovimientoMutation.mutate(dataToSend);
    }
  };

  const onError = (errors: any) => {
    console.error("Errores de validación del formulario (Zod/React Hook Form):", errors);
    toast({
      variant: "destructive",
      title: "Error de validación",
      description: "Por favor, corrige los errores en el formulario. Revisa la consola para más detalles.",
    });
  };


  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-64px)] p-4 bg-background text-foreground">
        <AlertTriangle className="h-12 w-12 mb-4 text-red-500" />
        <h3 className="text-xl font-bold text-red-600 mb-2">Acceso Denegado</h3>
        <p className="text-muted-foreground text-center">No tienes permisos para {isEditMode ? 'editar' : 'crear'} movimientos de stock. Contacta a tu administrador.</p>
      </div>
    );
  }

  const isLoading = isLoadingMovimientoData || createMovimientoMutation.isPending || updateMovimientoMutation.isPending;

  // Placeholder para Skeleton si no tienes un componente Skeleton
  const Skeleton = ({ className }: { className: string }) => (
    <div className={`animate-pulse bg-gray-200 rounded-md ${className}`}></div>
  );

  if (isLoading && isEditMode && !movimientoToEdit) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const formTitle = isEditMode ? 'Editar Movimiento de Stock' : 'Registrar Nuevo Movimiento de Stock';

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-primary font-heading">{formTitle}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/movimientos')}
          className="text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        >
          <Home className="mr-2 h-4 w-4" /> Volver a Movimientos
        </Button>
      </div>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold">{formTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
              {/* Fecha de Llegada */}
              <FormField
                control={form.control}
                name="fecha_llegada"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Llegada</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={isLoading}
                          >
                            {field.value ? (
                              field.value.toLocaleDateString()
                            ) : (
                              <span>Selecciona una fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Fecha en que se registra el movimiento de stock.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo de Movimiento (frontend UX, no backend field) */}
              <FormField
                control={form.control}
                name="tipo_movimiento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Movimiento</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('proveedor', null); 
                        form.setValue('almacen_destino', null);
                      }}
                      value={field.value} 
                      disabled={isLoading || isEditMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona el tipo de movimiento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada (Compra/Recepción)</SelectItem>
                        <SelectItem value="salida">Salida (Venta/Consumo)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Define si es una entrada o salida de stock.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Empresa (solo para superusuarios o pre-rellenada) */}
              <FormField
                control={form.control}
                name="empresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(Number(value)); 
                        form.setValue('proveedor', null);
                        form.setValue('almacen_destino', null);
                        form.setValue('detalles', [{ producto: 0, cantidad_suministrada: 1, colores: '', valor_unitario: 0 }]);
                      }}
                      value={field.value !== null && field.value !== undefined ? String(field.value) : ''} 
                      disabled={!currentUser?.is_superuser || isLoading || isEditMode}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona la empresa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {empresas.map((emp) => (
                          <SelectItem key={emp.id} value={String(emp.id)}>
                            {emp.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Empresa asociada al movimiento.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Proveedor (Condicional para Entrada) */}
              {watchTipoMovimiento === 'entrada' && (
                <FormField
                  control={form.control}
                  name="proveedor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === '' ? null : Number(value))} // Convertir a null si es cadena vacía
                        value={field.value !== null && field.value !== undefined ? String(field.value) : ''} 
                        disabled={proveedores.length === 0 || isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el proveedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {proveedores.map((prov) => (
                            <SelectItem key={prov.id} value={String(prov.id)}>
                              {prov.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Proveedor del stock que ingresa.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Almacén de Destino (para Entradas) / Almacén de Origen (para Salidas) */}
              {(watchTipoMovimiento === 'entrada' || watchTipoMovimiento === 'salida') && (
                <FormField
                  control={form.control}
                  name="almacen_destino"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {watchTipoMovimiento === 'entrada' ? 'Almacén de Destino' : 'Almacén de Origen (para Salida)'}
                      </FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === '' ? null : Number(value))} // Convertir a null si es cadena vacía
                        value={field.value !== null && field.value !== undefined ? String(field.value) : ''} 
                        disabled={almacenes.length === 0 || isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={`Selecciona el almacén ${watchTipoMovimiento === 'entrada' ? 'de destino' : 'de origen'}`} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {almacenes.map((alm) => (
                            <SelectItem key={alm.id} value={String(alm.id)}>
                              {alm.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {watchTipoMovimiento === 'entrada' 
                          ? 'Almacén al que ingresa el stock.' 
                          : 'Almacén del que sale el stock (para salidas).'
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Costo de Transporte */}
              <FormField
                control={form.control}
                name="costo_transporte"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo de Transporte</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value !== null ? field.value : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === '' ? null : parseFloat(value));
                        }}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Costo asociado al transporte de este movimiento.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Observaciones */}
              <FormField
                control={form.control}
                name="observaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Notas adicionales sobre el movimiento..."
                        {...field}
                        value={field.value || ''}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Añade cualquier nota relevante.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* --- Sección de Detalles del Movimiento (Productos) --- */}
              <h3 className="text-lg font-semibold mt-6 mb-3">Detalles de Productos</h3>
              {form.watch('detalles')?.map((detail, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-md relative">
                  {/* Botón para eliminar detalle, si hay más de uno */}
                  {form.watch('detalles')!.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => {
                        const currentDetails = form.getValues('detalles');
                        if (currentDetails) {
                          form.setValue('detalles', currentDetails.filter((_, i) => i !== index));
                        }
                      }}
                      disabled={isLoading}
                    >
                      <MinusCircle className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Campo de Producto */}
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.producto`}
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Producto</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(Number(value))} 
                          value={field.value !== null && field.value !== undefined ? String(field.value) : ''} 
                          disabled={productos.length === 0 || isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un producto" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {productos.map((prod) => (
                              <SelectItem key={prod.id} value={String(prod.id)}>
                                {prod.nombre} ({prod.id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Campo de Cantidad Suministrada */}
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.cantidad_suministrada`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad Suministrada</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="1"
                            {...field}
                            value={field.value !== null ? field.value : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? null : parseInt(value, 10));
                            }}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Campo de Colores Suministrados */}
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.colores`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Colores</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Ej. Rojo, Azul"
                            {...field}
                            value={field.value || ''}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Campo de Valor Unitario */}
                  <FormField
                    control={form.control}
                    name={`detalles.${index}.valor_unitario`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Unitario</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...field}
                            value={field.value !== null ? field.value : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? null : parseFloat(value));
                            }}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}

              {/* Botón para añadir nuevo detalle */}
              <Button
                type="button"
                variant="outline"
                className="w-full mt-4"
                onClick={() => {
                  const currentDetails = form.getValues('detalles') || [];
                  form.setValue('detalles', [...currentDetails, { producto: 0, cantidad_suministrada: 1, colores: '', valor_unitario: 0 }]); 
                }}
                disabled={isLoading}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Otro Producto
              </Button>


              {/* Botones de Envío y Cancelar */}
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="outline" onClick={() => navigate('/movimientos')} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditMode ? 'Actualizar Movimiento' : 'Registrar Movimiento'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MovimientoForm;