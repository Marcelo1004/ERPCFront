// src/pages/VentaForm.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { PlusCircle, Save, ArrowLeft, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { User } from '@/types/auth';
import { Producto } from '@/types/productos';
import { Venta, DetalleVenta } from '@/types/ventas';

// === TIPO DE ESTADO INTERNO PARA DETALLES DEL FORMULARIO ===
type VentaFormDetalle = {
  id?: number;
  producto: number;
  cantidad: number;
  precio_unitario: string; // Para el input HTML
  producto_nombre?: string; // Para la UI
};

const VentaForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    fecha: '',
    cliente_id: '',
    monto_total: '0.00',
    estado: 'Pendiente',
    detalles: [] as VentaFormDetalle[],
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Movido para que esté al mismo nivel que formInitialized


  // 1. Query para obtener la lista de usuarios (clientes)
  const { data: usersData, isLoading: isLoadingUsers, isError: isErrorUsers } = useQuery<any, Error, User[]>({
    queryKey: ['all_users_for_select', user?.empresa_detail?.id, user?.is_superuser],
    queryFn: async ({ queryKey }) => {
        const [_key, empresaId, isSuperUser] = queryKey;
        const filters: any = {};
        if (!isSuperUser && empresaId) {
            filters.empresa = empresaId;
        }
        const response = await api.fetchUsuarios(filters);
        return response.results;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const clients = useMemo(() => {
    return (usersData || [])
      .filter(u => u.role === 'CLIENTE' && (user?.is_superuser || u.empresa === user?.empresa_detail?.id));
  }, [usersData, user]);


  // 2. Query para obtener la lista de productos
  const { data: productsData, isLoading: isLoadingProducts, isError: isErrorProducts } = useQuery<any, Error, Producto[]>({
    queryKey: ['all_products_for_select', user?.empresa_detail?.id, user?.is_superuser],
    queryFn: async ({ queryKey }) => {
        const [_key, empresaId, isSuperUser] = queryKey;
        const filters: any = {};
        if (!isSuperUser && empresaId) {
            filters.empresa = empresaId;
        }
        const response = await api.fetchProductos(filters);
        return response.results;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const availableProducts = useMemo(() => {
    return (productsData || []).map(p => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
    }));
  }, [productsData]);


  // 3. Query para obtener los datos de la venta si estamos en modo edición
  const { data: ventaToEdit, isLoading: isLoadingVenta, isError: isErrorVenta } = useQuery<Venta, Error>({
    queryKey: ['venta', id],
    queryFn: () => api.getVentaById(Number(id)),
    // Habilitar solo cuando editando y las listas base están cargadas y la forma no ha sido inicializada
    enabled: isEditing && !!user && !isLoadingUsers && !isLoadingProducts && !formInitialized,
    staleTime: 5 * 1000,
  });


  // === EFECTO PARA LA INICIALIZACIÓN ÚNICA DEL FORMULARIO ===
  useEffect(() => {
    // Si el formulario ya fue inicializado, o si aún se están cargando datos esenciales, no hacer nada.
    if (formInitialized || isLoadingUsers || isLoadingProducts || (isEditing && isLoadingVenta)) {
      return;
    }

    if (isEditing) {
      // Si estamos editando y ya tenemos los datos de la venta, inicializar.
      if (ventaToEdit) {
        setFormData({
          fecha: ventaToEdit.fecha.slice(0, 16),
          cliente_id: String(ventaToEdit.usuario),
          monto_total: ventaToEdit.monto_total,
          estado: ventaToEdit.estado,
          detalles: (ventaToEdit.detalles || []).map(detalle => ({
            id: detalle.id,
            producto: detalle.producto,
            producto_nombre: availableProducts.find(p => p.id === detalle.producto)?.nombre || detalle.producto_nombre || 'Producto Desconocido',
            cantidad: detalle.cantidad,
            precio_unitario: String(detalle.precio_unitario),
          })),
        });
        setFormInitialized(true);
      }
      // Si estamos editando pero ventaToEdit aún no ha cargado, esperamos.
    } else {
      // Modo Creación: Inicializar con valores por defecto si no estamos editando
      setFormData(prev => ({
        ...prev,
        fecha: new Date().toISOString().slice(0, 16),
        monto_total: '0.00',
        cliente_id: clients.length > 0 ? String(clients[0].id) : '',
      }));
      setFormInitialized(true);
    }
  }, [formInitialized, isEditing, ventaToEdit, clients, availableProducts, isLoadingUsers, isLoadingProducts, isLoadingVenta]);

  // === EFECTO PARA CALCULAR EL MONTO TOTAL AUTOMÁTICAMENTE ===
  useEffect(() => {
    // Solo calcular si el formulario ya está inicializado
    if (formInitialized) {
      let total = 0;
      formData.detalles.forEach(item => {
        const cantidad = Number(item.cantidad);
        const precioUnitario = Number(item.precio_unitario);
        if (!isNaN(cantidad) && !isNaN(precioUnitario)) {
          total += cantidad * precioUnitario;
        }
      });
      setFormData(prev => ({
        ...prev,
        monto_total: total.toFixed(2),
      }));
    }
  }, [formData.detalles, formInitialized]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProductSelectChange = (index: number, productId: string) => {
    const newDetalles = [...formData.detalles];
    const selectedProduct = availableProducts.find(p => String(p.id) === productId);

    if (selectedProduct) {
        newDetalles[index] = {
            ...newDetalles[index],
            producto: Number(productId),
            producto_nombre: selectedProduct.nombre,
            precio_unitario: String(selectedProduct.precio),
        };
    } else {
        newDetalles[index] = {
            ...newDetalles[index],
            producto: 0,
            producto_nombre: '',
            precio_unitario: '0.00',
        };
    }
    setFormData(prev => ({ ...prev, detalles: newDetalles }));
  };

  const handleDetalleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newDetalles = [...formData.detalles];

    if (name === 'cantidad') {
      const numValue = Math.max(0, Math.floor(Number(value)));
      newDetalles[index] = { ...newDetalles[index], [name]: numValue };
    } else if (name === 'precio_unitario') {
      newDetalles[index] = { ...newDetalles[index], [name]: value };
    } else {
      newDetalles[index] = { ...newDetalles[index], [name]: value };
    }
    setFormData(prev => ({ ...prev, detalles: newDetalles }));
  };

  const addDetalle = () => {
    setFormData(prev => ({
      ...prev,
      detalles: [...prev.detalles, { producto: 0, cantidad: 1, precio_unitario: '0.00', producto_nombre: '' }],
    }));
  };

  const removeDetalle = (index: number) => {
    setFormData(prev => ({
      ...prev,
      detalles: prev.detalles.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // --- Validaciones Frontend ---
    if (!formData.cliente_id) {
      toast({ title: 'Error de Validación', description: 'Debes seleccionar un cliente para la venta.', variant: 'destructive' });
      setIsSaving(false); return;
    }
    if (formData.detalles.length === 0) {
      toast({ title: 'Error de Validación', description: 'La venta debe tener al menos un producto.', variant: 'destructive' });
      setIsSaving(false); return;
    }
    const hasInvalidDetail = formData.detalles.some(detalle => {
      const isProductoSelected = detalle.producto !== 0;
      const isValidCantidad = Number(detalle.cantidad) > 0;
      const isValidPrecioUnitario = Number(detalle.precio_unitario) > 0;
      if (!isProductoSelected) { toast({ title: 'Error de Validación', description: `Un producto en la lista de detalles no ha sido seleccionado. Por favor, selecciona un producto válido para cada fila.`, variant: 'destructive' }); return true; }
      if (!isValidCantidad) { toast({ title: 'Error de Validación', description: `La cantidad para el producto "${detalle.producto_nombre || 'sin nombre'}" debe ser mayor a 0.`, variant: 'destructive' }); return true; }
      if (!isValidPrecioUnitario) { toast({ title: 'Error de Validación', description: `El precio unitario para el producto "${detalle.producto_nombre || 'sin nombre'}" debe ser mayor a 0.`, variant: 'destructive' }); return true; }
      return false;
    });
    if (hasInvalidDetail) { setIsSaving(false); return; }
    // --- Fin Validaciones Frontend ---

  const detallesParaBackend: DetalleVenta[] = formData.detalles.map(d => ({
        id: d.id,
        producto: d.producto,
        cantidad: d.cantidad,
        precio_unitario: Number(d.precio_unitario),
    }));

    // === CAMBIOS CLAVE AQUÍ EN LA CONSTRUCCIÓN DE finalDataToSend ===
    // 1. Eliminar `cliente_id` de `formData` antes de copiarlo.
    // 2. Añadir `empresa` usando el `empresa_detail.id` del usuario autenticado.
    const { cliente_id, ...restOfFormData } = formData; // Extraer cliente_id

    const finalDataToSend: Venta = {
        ...restOfFormData, // Copiar el resto del formData (fecha, monto_total, estado, detalles)
        empresa: user?.empresa_detail?.id!, // <--- AÑADIR EMPRESA. El '!' es para asegurar que no es null si estás seguro.
                                            // Preferiblemente, deberías manejar el caso de user.empresa_detail.id ser null si es posible.
        usuario: Number(cliente_id),        // <--- USAR EL cliente_id EXTRAÍDO para 'usuario'
        detalles: detallesParaBackend,      // Los detalles ya mapeados
    };


    try {
      if (isEditing) {
        await api.updateVenta(Number(id), finalDataToSend); // Ahora finalDataToSend coincide con Venta
        toast({ title: 'Venta Actualizada', description: `La venta #${id} ha sido actualizada.` });
      } else {
        await api.createVenta(finalDataToSend); // Ahora finalDataToSend coincide con Venta
        toast({ title: 'Venta Creada', description: 'La nueva venta ha sido registrada con éxito.' });
      }
      navigate('/ventas');
    } catch (error: any) {
      console.error('Error al guardar venta (objeto completo):', error);
      let errorMessage = 'Hubo un error al guardar la venta.';
      if (error.response && error.response.data) {
        if (error.response.data.detail) {
          errorMessage = `Error: ${error.response.data.detail}`;
        } else {
          try { errorMessage = JSON.stringify(error.response.data, null, 2); } catch (e) { errorMessage = String(error.response.data); }
        }
      } else { errorMessage = error.message; }
      toast({ title: 'Error al Guardar Venta', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };


  // === Manejo unificado de estados de carga y error ===
  // Nota: formInitialized ahora se usa para decidir si ya debemos mostrar el formulario.
  const isOverallLoading = isLoadingUsers || isLoadingProducts || (isEditing && isLoadingVenta);
  const isOverallError = isErrorUsers || isErrorProducts || (isEditing && isErrorVenta);

  // === Renderizado condicional basado en estados de carga/error/inicialización ===
  if (isOverallLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Cargando {isEditing ? 'venta y datos de soporte' : 'datos de soporte'}...</p>
      </div>
    );
  }

  if (isOverallError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-background text-destructive">
        <AlertTriangle className="h-12 w-12 mb-2" />
        <h3 className="text-lg font-medium text-destructive-foreground">Error al cargar datos</h3>
        <p className="text-muted-foreground">No se pudieron obtener los datos necesarios. Por favor, intenta de nuevo.</p>
        <p className="text-sm text-muted-foreground mt-1">
          {(isErrorUsers && "Error al cargar usuarios.") ||
           (isErrorProducts && "Error al cargar productos.") ||
           (isErrorVenta && "Error al cargar la venta.")}
        </p>
      </div>
    );
  }

  // Si estamos en modo edición, pero la venta no se encontró después de cargar, y el formulario se intentó inicializar.
  if (isEditing && !ventaToEdit && formInitialized) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-background text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mb-2 text-yellow-500" />
        <h3 className="text-lg font-medium">Venta no encontrada</h3>
        <p className="text-muted-foreground">La venta con ID "{id}" no existe o no pudo ser cargada.</p>
        <Link to="/ventas">
          <Button variant="link" className="mt-4 text-primary">Volver al listado de ventas</Button>
        </Link>
      </div>
    );
  }

  // Si el formulario aún no ha sido inicializado pero ya no hay carga ni errores,
  // significa que estamos listos para inicializar (si se cumplen las condiciones de useEffect)
  // o estamos esperando una condición de habilitación para useQuery (ej. `user` no ha cargado)
  // Esto es una salvaguarda para evitar renderizar el formulario con datos incompletos.
  if (!formInitialized) {
    return (
      <div className="flex items-center justify-center h-64 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Preparando formulario...</p>
      </div>
    );
  }

  // === RETORNO PRINCIPAL DEL FORMULARIO ===
  // Este bloque se ejecuta solo cuando `formInitialized` es true y no hay estados de carga/error.
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground min-h-screen-minus-header">
      {/* ... El resto del JSX del formulario ... */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-primary font-heading">
          {isEditing ? `Editar Venta #${id}` : 'Nueva Venta'}
        </h1>
        <Link to="/ventas">
          <Button variant="outline" className="text-muted-foreground border-border hover:bg-background/80">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Ventas
          </Button>
        </Link>
      </div>

      <Card className="bg-card text-card-foreground border-border shadow-lg">
        <CardHeader>
          <CardTitle className="font-semibold">Formulario de Venta</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isEditing ? `Modifica los datos de la venta #${id}.` : 'Completa los campos para registrar una nueva venta.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fecha">Fecha y Hora</Label>
                <Input
                  id="fecha"
                  name="fecha"
                  type="datetime-local"
                  value={formData.fecha}
                  onChange={handleChange}
                  required
                  className="bg-input border-input mt-1"
                />
              </div>
              <div>
                <Label htmlFor="cliente_id">Cliente</Label>
                <Select
                  name="cliente_id"
                  value={formData.cliente_id}
                  onValueChange={(value) => handleSelectChange('cliente_id', value)}
                  required
                  disabled={isEditing || clients.length === 0}
                >
                  <SelectTrigger className="w-full bg-input border-input mt-1">
                    <SelectValue placeholder={"Selecciona un cliente"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length > 0 ? (
                      clients.map((client: User) => (
                        <SelectItem key={client.id} value={String(client.id)}>
                          {client.first_name} {client.last_name ? client.last_name : ''} ({client.email})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no_clients_available" disabled>No hay clientes disponibles</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="monto_total">Monto Total</Label>
                <Input
                  id="monto_total"
                  name="monto_total"
                  type="number"
                  step="0.01"
                  value={formData.monto_total}
                  readOnly
                  className="bg-input border-input mt-1 focus:ring-0 focus:border-input cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="estado">Estado</Label>
                <Select
                  name="estado"
                  value={formData.estado}
                  onValueChange={(value) => handleSelectChange('estado', value)}
                >
                  <SelectTrigger className="w-full bg-input border-input mt-1">
                    <SelectValue placeholder="Selecciona el estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendiente">Pendiente</SelectItem>
                    <SelectItem value="Completada">Completada</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator className="my-6 bg-border" />

            <h3 className="text-lg font-semibold text-foreground flex items-center">
              Detalles de la Venta
              <Button type="button" variant="outline" size="sm" onClick={addDetalle} className="ml-auto text-primary hover:bg-primary/10">
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Producto
              </Button>
            </h3>

            <div className="space-y-4">
              {formData.detalles.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Aún no hay productos en esta venta.</p>
              )}
              {formData.detalles.map((detalle, index) => (
                <Card key={index} className="bg-background border-border shadow-sm p-4">
                  <CardContent className="p-0 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-1">
                      <Label htmlFor={`producto-${index}`}>Producto</Label>
                      <Select
                        name="producto"
                        value={String(detalle.producto)}
                        onValueChange={(value) => handleProductSelectChange(index, value)}
                        required
                        disabled={availableProducts.length === 0}
                      >
                        <SelectTrigger className="w-full bg-input border-input mt-1">
                          <SelectValue placeholder={isLoadingProducts ? "Cargando productos..." : "Selecciona un producto"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProducts.length > 0 ? (
                            availableProducts.map((product: Producto) => (
                              <SelectItem key={product.id} value={String(product.id)}>
                                {product.nombre} (${Number(product.precio).toFixed(2)})
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no_products_available" disabled>No hay productos disponibles</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`cantidad-${index}`}>Cantidad</Label>
                      <Input
                          id={`cantidad-${index}`}
                          name="cantidad"
                          type="number"
                          min="0"
                          value={detalle.cantidad}
                          onChange={(e) => handleDetalleChange(index, e)}
                          required
                          className="bg-input border-input mt-1"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`precio_unitario-${index}`}>Precio Unitario</Label>
                        <Input
                            id={`precio_unitario-${index}`}
                            name="precio_unitario"
                            type="number"
                            step="0.01"
                            min="0"
                            value={detalle.precio_unitario}
                            onChange={(e) => handleDetalleChange(index, e)}
                            required
                            className="bg-input border-input mt-1"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeDetalle(index)} className="text-destructive hover:bg-destructive/10">
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-4">
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSaving || isOverallLoading}>
                {isSaving ? 'Guardando...' : <><Save className="mr-2 h-4 w-4" /> Guardar Venta</>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default VentaForm;