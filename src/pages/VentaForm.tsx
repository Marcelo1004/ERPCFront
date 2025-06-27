import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Empresa } from '@/types/empresas'; 
import { Producto } from '@/types/productos';
import { Venta, DetalleVenta } from '@/types/ventas';

// === TIPO DE ESTADO INTERNO PARA DETALLES DEL FORMULARIO ===
type VentaFormDetalle = {
  id?: number; // `id` es opcional para nuevos detalles, pero crucial para los existentes
  producto: number;
  cantidad: number;
  precio_unitario: string; 
  descuento_aplicado: string; 
  producto_nombre?: string; 
};

const VentaForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    fecha: '',
    empresa: '',
    cliente_id: '',
    monto_total: '0.00',
    estado: 'Pendiente',
    detalles: [] as VentaFormDetalle[],
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // === QUERIES BASE ===

  const { data: empresasData, isLoading: isLoadingEmpresas } = useQuery<any, Error, Empresa[]>({
    queryKey: ['empresas_for_select'],
    queryFn: () => api.fetchEmpresas().then(res => res.results),
    enabled: !!user && user.is_superuser,
    staleTime: 5 * 60 * 1000,
  });

  const activeCompanyId = useMemo(() => {
    if (!user) return undefined;
    return user.is_superuser ? Number(formData.empresa) : user.empresa_detail?.id;
  }, [user, formData.empresa]);

  console.log("DEBUG VentaForm: activeCompanyId for queries:", activeCompanyId);


  // === RENOMBRANDO 'error' a 'queryErrorUsers' ===
  const { data: usersData, isLoading: isLoadingUsers, isError: isErrorUsers, error: queryErrorUsers } = useQuery<any, Error, User[]>({
    queryKey: ['all_users_for_select', activeCompanyId],
    queryFn: async ({ queryKey }) => {
      const [_key, companyId] = queryKey;
      const filters: any = {};
      if (companyId) {
        filters.empresa = companyId;
      }
      console.log("DEBUG VentaForm: Fetching usuarios with filters:", filters);
      const response = await api.fetchUsuarios(filters);
      console.log("DEBUG VentaForm: Usuarios fetched successfully:", response.results);
      return response.results;
    },
    enabled: !!user && !!activeCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  const clients = useMemo(() => {
    console.log("DEBUG VentaForm: Recalculating clients. Raw usersData:", usersData);
    console.log("DEBUG VentaForm: Current authenticated user:", user);

    return (usersData || [])
      .filter(u => u.role?.name === 'Cliente');
  }, [usersData]);

  // === RENOMBRANDO 'error' a 'queryErrorProducts' ===
  const { data: productsData, isLoading: isLoadingProducts, isError: isErrorProducts, error: queryErrorProducts } = useQuery<any, Error, Producto[]>({
    queryKey: ['all_products_for_select', activeCompanyId],
    queryFn: async ({ queryKey }) => {
      const [_key, companyId] = queryKey;
      const filters: any = {};
      if (companyId) {
        filters.empresa = companyId;
      }
      const response = await api.fetchProductos(filters);
      return response.results;
    },
    enabled: !!user && !!activeCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  const availableProducts = useMemo(() => {
    return (productsData || []).map(p => ({
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      descuento: (p.descuento === null || p.descuento === undefined) ? '0.00' : String(p.descuento), 
    }));
  }, [productsData]);

  // === RENOMBRANDO 'error' a 'queryErrorVenta' ===
  const { data: ventaToEdit, isLoading: isLoadingVenta, isError: isErrorVenta, error: queryErrorVenta } = useQuery<Venta, Error>({
    queryKey: ['venta', id],
    queryFn: () => api.getVentaById(Number(id)),
    enabled: isEditing && !!user && !isLoadingUsers && !isLoadingProducts && !formInitialized,
    staleTime: 5 * 1000,
  });

  // === EFECTO PARA LA INICIALIZACIÓN ÚNICA DEL FORMULARIO ===
  useEffect(() => {
    console.log("DEBUG VentaForm: useEffect for form initialization triggered.");
    console.log("  - formInitialized:", formInitialized);
    console.log("  - isLoadingUsers:", isLoadingUsers);
    console.log("  - isLoadingProducts:", isLoadingProducts);
    console.log("  - isLoadingEmpresas (if superuser):", isLoadingEmpresas);
    console.log("  - isLoadingVenta (if editing):", isLoadingVenta);
    console.log("  - clients.length (at init effect):", clients.length);
    console.log("  - isEditing:", isEditing);
    console.log("  - user:", user);

    if (formInitialized || isLoadingUsers || isLoadingProducts || (isEditing && isLoadingVenta) || (user?.is_superuser && isLoadingEmpresas)) {
      return;
    }

    setFormData(prev => {
      let initialEmpresaId: string = prev.empresa;

      if (user?.is_superuser) {
        if (!prev.empresa && empresasData && empresasData.length > 0) {
          initialEmpresaId = String(empresasData[0].id);
        }
      } else if (user?.empresa_detail?.id) {
        initialEmpresaId = String(user.empresa_detail.id);
      }

      if (isEditing && ventaToEdit) {
        console.log("DEBUG VentaForm: Form initialized for editing. ventaToEdit:", ventaToEdit);
        return {
          fecha: ventaToEdit.fecha.slice(0, 16),
          empresa: String(ventaToEdit.empresa),
          cliente_id: String(ventaToEdit.usuario),
          monto_total: ventaToEdit.monto_total,
          estado: ventaToEdit.estado,
          detalles: (ventaToEdit.detalles || []).map(detalle => {
            const productMatch = availableProducts.find(p => p.id === detalle.producto);
            return {
              id: detalle.id, 
              producto: detalle.producto,
              producto_nombre: productMatch?.nombre || detalle.producto_nombre || 'Producto Desconocido',
              cantidad: detalle.cantidad,
              precio_unitario: String(detalle.precio_unitario),
              descuento_aplicado: (detalle.descuento_aplicado === null || detalle.descuento_aplicado === undefined) ? '0.00' : String(detalle.descuento_aplicado), 
            };
          }),
        };
      } else if (!isEditing) {
        const newFormData = {
          ...prev,
          fecha: new Date().toISOString().slice(0, 16),
          monto_total: '0.00',
          estado: 'Pendiente',
          empresa: initialEmpresaId,
        };

        if (!isLoadingUsers && clients.length > 0 && !newFormData.cliente_id) {
          newFormData.cliente_id = String(clients[0].id);
          console.log("DEBUG VentaForm: Form initialized for creation. Auto-selected client:", clients[0]?.id);
        } else if (!isLoadingUsers && clients.length === 0 && !newFormData.cliente_id) {
          console.log("DEBUG VentaForm: Form initialized for creation. No clients available to auto-select.");
          newFormData.cliente_id = '';
        }
        console.log("DEBUG VentaForm: Form initialized for creation with initial state:", newFormData);
        return newFormData;
      }
      return prev;
    });

    if ((isEditing && ventaToEdit) || (!isEditing && !isLoadingUsers && !isLoadingEmpresas && user && ((user.is_superuser && empresasData) || (!user.is_superuser && user.empresa_detail)))) {
      setFormInitialized(true);
      console.log("DEBUG VentaForm: Form initialization completed.");
    }

  }, [formInitialized, isEditing, ventaToEdit, clients, availableProducts, isLoadingUsers, isLoadingProducts, isLoadingVenta, user, empresasData, isLoadingEmpresas]);


  // === EFECTO PARA CALCULAR EL MONTO TOTAL AUTOMÁTICAMENTE ===
  useEffect(() => {
    if (formInitialized) {
      let total = 0;
      formData.detalles.forEach(item => {
        const cantidad = Number(item.cantidad);
        const precioUnitario = Number(item.precio_unitario);
        const descuentoAplicado = Number(item.descuento_aplicado || '0.00'); 

        if (!isNaN(cantidad) && cantidad > 0 && !isNaN(precioUnitario) && precioUnitario > 0) {
          const precioConDescuento = precioUnitario * (1 - descuentoAplicado);
          total += cantidad * precioConDescuento;
        }
      });
      setFormData(prev => ({
        ...prev,
        monto_total: total.toFixed(2),
      }));
    }
  }, [formData.detalles, formInitialized]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    console.log(`DEBUG VentaForm: handleSelectChange - Name: ${name}, Value: ${value}`);
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'empresa' && user?.is_superuser) {
      setFormData(prev => ({ ...prev, cliente_id: '', detalles: [] })); 
      console.log("DEBUG VentaForm: Empresa changed by superuser. Resetting cliente_id and details.");
    }
  };

  const handleProductSelectChange = (index: number, productId: string) => {
    const newDetalles = [...formData.detalles];
    const selectedProduct = availableProducts.find(p => String(p.id) === productId);

    if (selectedProduct) {
      newDetalles[index] = {
        ...newDetalles[index],
        id: newDetalles[index].id, 
        producto: Number(productId),
        producto_nombre: selectedProduct.nombre,
        cantidad: 1, 
        precio_unitario: String(selectedProduct.precio),
        descuento_aplicado: selectedProduct.descuento || '0.00', 
      };
    } else {
      newDetalles[index] = {
        id: undefined, 
        producto: 0,
        producto_nombre: '',
        cantidad: 0,
        precio_unitario: '0.00',
        descuento_aplicado: '0.00',
      };
    }
    setFormData(prev => ({ ...prev, detalles: newDetalles }));
  };

  const handleDetalleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newDetalles = [...formData.detalles];
    
    let parsedValue: string | number = value;
    if (name === 'cantidad') {
      parsedValue = value === '' ? 0 : Math.max(0, Math.floor(Number(value))); 
    } else if (name === 'precio_unitario' || name === 'descuento_aplicado') {
      parsedValue = value === '' ? '0' : value; 
    }

    newDetalles[index] = { ...newDetalles[index], [name]: parsedValue as any }; 
    setFormData(prev => ({ ...prev, detalles: newDetalles }));
  };

  const addDetalle = () => {
    setFormData(prev => ({
      ...prev,
      detalles: [...prev.detalles, { producto: 0, cantidad: 1, precio_unitario: '0.00', descuento_aplicado: '0.00', producto_nombre: '' }],
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
    if (!formData.empresa || formData.empresa === 'empty-selection-option') {
      toast({ title: 'Error de Validación', description: 'Debes seleccionar una empresa para la venta.', variant: 'destructive' });
      setIsSaving(false); return;
    }
    if (!formData.cliente_id || formData.cliente_id === 'no_clients_available' || formData.cliente_id === '') {
      toast({ title: 'Error de Validación', description: 'Debes seleccionar un cliente para la venta.', variant: 'destructive' });
      setIsSaving(false); return;
    }
    if (formData.detalles.length === 0) {
      toast({ title: 'Error de Validación', description: 'La venta debe tener al menos un producto.', variant: 'destructive' });
      setIsSaving(false); return;
    }

    let hasValidationErrors = false;
    formData.detalles.forEach((detalle, index) => {
      const isProductoSelected = detalle.producto !== 0;
      const cantidadNum = Number(detalle.cantidad);
      const isValidCantidad = !isNaN(cantidadNum) && cantidadNum > 0;
      
      const precioUnitarioNum = Number(detalle.precio_unitario);
      const isValidPrecioUnitario = !isNaN(precioUnitarioNum) && precioUnitarioNum > 0;

      const descuentoAplicadoNum = Number(detalle.descuento_aplicado); 
      const isValidDescuento = !isNaN(descuentoAplicadoNum) && descuentoAplicadoNum >= 0 && descuentoAplicadoNum <= 1; 

      if (!isProductoSelected) { 
        toast({ title: 'Error de Validación', description: `Fila ${index + 1}: Selecciona un producto válido.`, variant: 'destructive' }); 
        hasValidationErrors = true; 
      }
      if (!isValidCantidad) { 
        toast({ title: 'Error de Validación', description: `Fila ${index + 1}: La cantidad debe ser un número positivo.`, variant: 'destructive' }); 
        hasValidationErrors = true; 
      }
      if (!isValidPrecioUnitario) { 
        toast({ title: 'Error de Validación', description: `Fila ${index + 1}: El precio unitario debe ser un número positivo.`, variant: 'destructive' }); 
        hasValidationErrors = true; 
      }
      if (!isValidDescuento) { 
        toast({ title: 'Error de Validación', description: `Fila ${index + 1}: El descuento aplicado (${detalle.descuento_aplicado}) debe ser un valor entre 0 y 1. Por favor, asegúrate de que el producto tiene un descuento válido.`, variant: 'destructive' }); 
        hasValidationErrors = true; 
      }
    });

    if (hasValidationErrors) { setIsSaving(false); return; }
    // --- Fin Validaciones Frontend ---

    const detallesParaBackend: DetalleVenta[] = formData.detalles.map(d => {
        const mappedDetail: DetalleVenta = {
            producto: d.producto,
            cantidad: d.cantidad,
            precio_unitario: Number(d.precio_unitario).toFixed(2), 
            descuento_aplicado: Number(d.descuento_aplicado).toFixed(4), 
        };
        // === CRÍTICO: Asegurarse de que el ID solo se incluya si existe y es un número válido !== 0 ===
        if (d.id !== undefined && d.id !== null && d.id > 0) {
            mappedDetail.id = d.id;
        }
        return mappedDetail;
    }) as DetalleVenta[];

    const { cliente_id, empresa, estado, ...restOfFormData } = formData;

    const finalDataToSend: Venta = {
        ...restOfFormData,
        empresa: Number(empresa),
        usuario: Number(cliente_id),
        estado: estado,
        detalles: detallesParaBackend,
    };

    console.log("DEBUG VentaForm: Data to send to backend (finalDataToSend):", finalDataToSend); 
    finalDataToSend.detalles.forEach((d, i) => {
        console.log(`DEBUG VentaForm: Detalle ${i} - id: ${d.id}, producto: ${d.producto}, cantidad: ${d.cantidad}, precio_unitario: '${d.precio_unitario}', descuento_aplicado: '${d.descuento_aplicado}' (typeof: ${typeof d.descuento_aplicado})`);
    });

    try {
      if (isEditing) {
        await api.updateVenta(Number(id), finalDataToSend);
        toast({ title: 'Venta Actualizada', description: `La venta #${id} ha sido actualizada.` });
      } else {
        await api.createVenta(finalDataToSend);
        toast({ title: 'Venta Creada', description: 'La nueva venta ha sido registrada con éxito.' });
      }
      navigate('/ventas');
    } catch (error: any) { 
      console.error('Error al guardar venta (objeto completo):', error);
      let errorMessage = 'Hubo un error al guardar la venta.';
      
      if (error.response && error.response.data) {
        console.error("Detalles del error del backend (error.response.data):", error.response.data);
        if (error.response.data.detail) {
          errorMessage = `Error: ${error.response.data.detail}`;
        } else if (error.response.data.non_field_errors) {
            errorMessage = `Error: ${error.response.data.non_field_errors[0]}`;
        } else if (error.response.data.detalles) {
            if (Array.isArray(error.response.data.detalles)) {
                errorMessage = `Error en detalles: ${error.response.data.detalles.join(', ')}`;
            } else if (typeof error.response.data.detalles === 'object') {
                errorMessage = `Error en detalles: ${JSON.stringify(error.response.data.detalles, null, 2)}`;
            } else {
                errorMessage = `Error en detalles: ${String(error.response.data.detalles)}`;
            }
        } else {
          try { 
            errorMessage = `Detalles del error: ${JSON.stringify(error.response.data, null, 2)}`; 
          } catch (e) { 
            errorMessage = `Detalles del error: ${String(error.response.data)}`; 
          }
        }
      } else { 
        errorMessage = error.message; 
      }
      toast({ title: 'Error al Guardar Venta', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };


  // === CORRECCIÓN AQUÍ: Asegúrate de que queryErrorGlobal sea un objeto Error o null ===
  const isOverallLoading = isLoadingUsers || isLoadingProducts || (isEditing && isLoadingVenta) || (user?.is_superuser && isLoadingEmpresas);
  const isOverallError = isErrorUsers || isErrorProducts || (isEditing && isErrorVenta); 

  // Asigna directamente los objetos de error (que son tipo Error | null)
  const queryErrorGlobal: Error | null = queryErrorUsers || queryErrorProducts || queryErrorVenta || null;


  if (isOverallLoading) {
    console.log("DEBUG VentaForm: Overall loading state. Showing loader.");
    return (
      <div className="flex items-center justify-center h-64 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Cargando {isEditing ? 'venta y datos de soporte' : 'datos de soporte'}...</p>
      </div>
    );
  }

  if (isOverallError) {
    console.log("DEBUG VentaForm: Overall error state. Showing error message.");
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-background text-destructive">
        <AlertTriangle className="h-12 w-12 mb-2" />
        <h3 className="text-lg font-medium text-destructive-foreground">Error al cargar datos</h3>
        <p className="text-muted-foreground">No se pudieron obtener los datos necesarios. Detalles: {queryErrorGlobal?.message || 'Error desconocido'}</p> 
      </div>
    );
  }

  if (isEditing && !ventaToEdit && formInitialized) {
    console.log("DEBUG VentaForm: Editing mode, but ventaToEdit not found after initialization.");
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

  if (!formInitialized) {
    console.log("DEBUG VentaForm: Form not yet initialized. Showing preparing message.");
    return (
      <div className="flex items-center justify-center h-64 bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Preparando formulario...</p>
      </div>
    );
  }

  console.log("DEBUG VentaForm: Rendering main form.");
  console.log("  - Current formData.empresa:", formData.empresa);
  console.log("  - Current formData.cliente_id:", formData.cliente_id);
  console.log("  - clients array (for Select):", clients);
  console.log("  - Select client disabled state:", isEditing || clients.length === 0 || !formData.empresa);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-background text-foreground min-h-screen-minus-header">
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

              {user?.is_superuser && (
                <div>
                  <Label htmlFor="empresa">Empresa</Label>
                  <Select
                    name="empresa"
                    value={formData.empresa}
                    onValueChange={(value) => handleSelectChange('empresa', value)}
                    required
                    disabled={isLoadingEmpresas || (empresasData?.length === 0)}
                  >
                    <SelectTrigger className="w-full bg-input border-input mt-1">
                      <SelectValue placeholder={isLoadingEmpresas ? "Cargando empresas..." : "Selecciona una empresa"} />
                    </SelectTrigger>
                    <SelectContent>
                      {empresasData?.length > 0 ? (
                        empresasData.map((emp: Empresa) => (
                          <SelectItem key={emp.id} value={String(emp.id)}>
                            {emp.nombre}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no_empresas_available" disabled>No hay empresas disponibles</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="cliente_id">Cliente</Label>
                <Select
                  name="cliente_id"
                  value={formData.cliente_id}
                  onValueChange={(value) => handleSelectChange('cliente_id', value)}
                  required
                  disabled={isEditing || clients.length === 0 || (user?.is_superuser && !formData.empresa)}
                >
                  <SelectTrigger className="w-full bg-input border-input mt-1">
                    <SelectValue placeholder={isLoadingUsers ? "Cargando clientes..." : "Selecciona un cliente"} />
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
              <Button type="button" variant="outline" size="sm" onClick={addDetalle} className="ml-auto text-primary hover:bg-primary/10"
                disabled={!formData.empresa}
              >
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
                        disabled={availableProducts.length === 0 || !formData.empresa}
                      >
                        <SelectTrigger className="w-full bg-input border-input mt-1">
                          <SelectValue placeholder={isLoadingProducts ? "Cargando productos..." : "Selecciona un producto"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProducts.length > 0 ? (
                            availableProducts.map((product: Producto) => (
                              <SelectItem key={product.id} value={String(product.id)}>
                                {product.nombre} (${Number(product.precio).toFixed(2)})
                                {Number(product.descuento) > 0 && ` (-${(Number(product.descuento) * 100).toFixed(0)}%)`}
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
                        <Label htmlFor={`precio_unitario-${index}`}>Precio Unitario (Aplicado)</Label>
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
                      {/* Mostrar el descuento aplicado en el detalle */}
                      {Number(detalle.descuento_aplicado) > 0 && (
                        <div className="flex-1 text-sm text-muted-foreground ml-2">
                          Descuento: {(Number(detalle.descuento_aplicado) * 100).toFixed(2)}%
                        </div>
                      )}
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
