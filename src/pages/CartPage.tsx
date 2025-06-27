// src/pages/CartPage.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Minus, ShoppingCart, ArrowLeft, Loader2, CreditCard, QrCode, CheckCircle } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";
import { Separator } from '@/components/ui/separator';
import api from '@/services/api'; // Importar el servicio API
import { useAuth } from '@/contexts/AuthContext'; // Importar el contexto de autenticación


const CartPage: React.FC = () => {
  const { cart, updateQuantity, removeFromCart, clearCart, getTotalItems, getTotalPrice } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth(); // Obtener el usuario autenticado

  // URL de ejemplo para el QR (¡REEMPLAZA CON LA RUTA A TU IMAGEN DEL QR!)
  const qrCodeImageUrl = "https://placehold.co/250x250/22c55e/ffffff?text=Tu+QR+Aqui"; // Placeholder para el QR

  const handleQuantityChange = (productId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value >= 1) {
      updateQuantity(productId, value);
    }
  };

  const handleIncreaseQuantity = (productId: number, currentQuantity: number, maxStock: number) => {
    if (currentQuantity < maxStock) {
      updateQuantity(productId, currentQuantity + 1);
    } else {
      toast({
        variant: "default",
        title: "Stock Máximo Alcanzado",
        description: "No puedes añadir más unidades de este producto al carrito.",
      });
    }
  };

  const handleDecreaseQuantity = (productId: number, currentQuantity: number) => {
    if (currentQuantity > 1) {
      updateQuantity(productId, currentQuantity - 1);
    } else {
      removeFromCart(productId);
      toast({
        title: "Producto eliminado",
        description: "Se eliminó el producto del carrito.",
      });
    }
  };

  const createSaleAndPayment = async (metodoPago: 'STRIPE' | 'QR') => {
    if (getTotalItems() === 0) {
      toast({ variant: "destructive", title: "Carrito Vacío", description: "No hay productos en tu carrito para proceder al pago." });
      return;
    }

    if (!user || !user.id || !user.empresa_detail?.id) {
        toast({ variant: "destructive", title: "Error de Usuario", description: "Debes iniciar sesión y estar asociado a una empresa para realizar una compra." });
        return;
    }

    try {
      // 1. Crear la Venta
      const ventaData = {
        fecha: new Date().toISOString().slice(0, 16), // Formato YYYY-MM-DDTHH:mm
        monto_total: getTotalPrice().toFixed(2), // Se recalculará en el backend, pero enviamos el estimado
        usuario: user.id, // El ID del usuario autenticado (cliente)
        empresa: user.empresa_detail.id, // La empresa del usuario (o la empresa a la que pertenece el producto si es diferente)
        estado: 'Completada', // La venta se completa al pagar
        origen: 'MARKETPLACE', // <-- ¡Aquí establecemos el origen!
        detalles: cart.map(item => ({
          producto: item.id,
          cantidad: item.quantity,
          precio_unitario: Number(item.precio).toFixed(2),
          descuento_aplicado: Number(item.descuento || 0).toFixed(4), // Asegurarse de enviar como Decimal de 4 decimales
        })),
      };

      console.log("Datos de venta a enviar:", ventaData);

      const ventaResponse = await api.createVenta(ventaData);
      console.log("Venta creada exitosamente:", ventaResponse);

      // 2. Crear el Pago asociado a la Venta
      const pagoData = {
        venta: ventaResponse.id, // ID de la venta recién creada
        cliente: user.id, // ID del cliente
        empresa: user.empresa_detail.id, // ID de la empresa receptora del pago
        monto: ventaResponse.monto_total, // Monto total de la venta (el que el backend calculó)
        metodo_pago: metodoPago,
        referencia_transaccion: `SIMULATED-${metodoPago}-${Date.now()}`, // Referencia de transacción simulada
        estado_pago: 'COMPLETADO',
      };
      
      console.log("Datos de pago a enviar:", pagoData);
      const pagoResponse = await api.createPago(pagoData); // Asume que tienes un `createPago` en tu API service
      console.log("Pago creado exitosamente:", pagoResponse);

      toast({ title: "Pago Confirmado", description: "Tu compra ha sido procesada exitosamente. ¡Gracias!", duration: 3000 });
      clearCart();
      navigate('/payment-confirmation');

    } catch (error: any) {
      console.error("Error al procesar la compra/pago:", error.response?.data || error.message);
      let errorMessage = 'Hubo un error al procesar tu compra.';
      if (error.response && error.response.data) {
        if (error.response.data.detail) {
          errorMessage = `Error: ${error.response.data.detail}`;
        } else if (error.response.data.detalles) {
            errorMessage = `Error en productos: ${JSON.stringify(error.response.data.detalles)}`;
        } else {
            errorMessage = `Detalles: ${JSON.stringify(error.response.data)}`;
        }
      }
      toast({ variant: "destructive", title: "Error en la Compra", description: errorMessage, duration: 5000 });
    }
  };

  const handleSimulatedQrPayment = () => createSaleAndPayment('QR');
  const handleSimulatedStripePayment = () => createSaleAndPayment('STRIPE');

  if (!cart) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="ml-2 text-gray-700">Cargando carrito...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 bg-gray-50 min-h-screen font-sans">
      <Button 
        onClick={() => navigate(-1)} 
        variant="outline" 
        className="mb-6 flex items-center text-indigo-600 hover:text-indigo-800 border-indigo-500 hover:bg-indigo-50 transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a comprar
      </Button>

      <Card className="shadow-xl rounded-xl border border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between p-6 bg-indigo-100 rounded-t-xl border-b border-indigo-200">
          <CardTitle className="text-3xl font-bold text-indigo-800 flex items-center">
            <ShoppingCart className="mr-3 h-8 w-8 text-indigo-600" /> Tu Carrito de Compras
          </CardTitle>
          {cart.length > 0 && (
            <Button
              variant="destructive"
              onClick={clearCart}
              className="text-sm font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 px-4 py-2"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Vaciar Carrito
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          {cart.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-lg">
              <ShoppingCart className="h-24 w-24 text-gray-400 mx-auto mb-6" />
              <p className="text-xl text-gray-600 mb-6">Tu carrito está vacío. ¡Añade algunos productos!</p>
              <Button onClick={() => navigate('/marketplace')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-300 px-6 py-3 text-lg">
                <ArrowLeft className="mr-2 h-5 w-5" /> Empezar a Comprar
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Columna de Productos del Carrito (Izquierda) */}
              <div className="lg:col-span-2 overflow-x-auto bg-white p-6 rounded-xl shadow-md border border-gray-200">
                <h3 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">Productos Seleccionados</h3>
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="text-gray-700">
                      <TableHead className="w-[120px] px-4 py-3 text-left text-sm font-medium uppercase tracking-wider">Producto</TableHead>
                      <TableHead className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider">Precio Unitario</TableHead>
                      <TableHead className="px-4 py-3 text-left text-sm font-medium uppercase tracking-wider">Cantidad</TableHead>
                      <TableHead className="px-4 py-3 text-right text-sm font-medium uppercase tracking-wider">Total</TableHead>
                      <TableHead className="px-4 py-3 text-right text-sm font-medium uppercase tracking-wider">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white divide-y divide-gray-100">
                    {cart.map(item => {
                      const originalPrice = parseFloat(item.precio);
                      const discountRate = parseFloat(item.descuento || '0');
                      const finalPricePerUnit = originalPrice * (1 - discountRate);
                      const itemTotalPrice = finalPricePerUnit * item.quantity;

                      return (
                        <TableRow key={item.id} className="hover:bg-indigo-50 transition-colors duration-200">
                          <TableCell className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <img 
                                src={item.imagen as string || `https://placehold.co/60x60/e2e8f0/64748b?text=No+Img`} 
                                alt={item.nombre} 
                                className="h-16 w-16 object-contain rounded-md border border-gray-200 flex-shrink-0"
                                onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/60x60/e2e8f0/64748b?text=No+Img`; }}
                              />
                              <div className="flex flex-col">
                                <span className="font-semibold text-gray-800 text-base">{item.nombre}</span>
                                {item.almacen_detail?.sucursal_detail?.nombre && (
                                    <span className="text-gray-500 text-xs mt-1">Sucursal: {item.almacen_detail.sucursal_detail.nombre}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4 whitespace-nowrap text-sm">
                            {discountRate > 0 ? (
                              <div className="flex flex-col">
                                <span className="line-through text-gray-500 text-xs">${originalPrice.toFixed(2)}</span>
                                <span className="font-semibold text-green-600 text-base">${finalPricePerUnit.toFixed(2)}</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-gray-800 text-base">${originalPrice.toFixed(2)}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-1">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDecreaseQuantity(item.id, item.quantity)}
                                className="p-1 h-8 w-8 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(item.id, e)}
                                className="w-16 text-center text-base font-semibold rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                min="1"
                                max={item.stock}
                              />
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleIncreaseQuantity(item.id, item.quantity, item.stock)}
                                className="p-1 h-8 w-8 rounded-full text-indigo-600 hover:bg-indigo-100 transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            {item.quantity > item.stock && (
                              <p className="text-red-500 text-xs mt-1">Solo {item.stock} en stock.</p>
                            )}
                            {item.stock === 0 && (
                                <p className="text-red-500 text-xs mt-1 font-semibold">¡Agotado!</p>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-4 whitespace-nowrap text-right font-bold text-lg text-gray-900">
                            ${itemTotalPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="px-4 py-4 whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.id)}
                              className="text-red-600 hover:bg-red-100 rounded-md p-2 transition-colors"
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Columna de Resumen y Pago (Derecha) */}
              <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-md border border-gray-200 self-start lg:sticky lg:top-8">
                <h3 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">Resumen del Pedido</h3>
                
                <div className="flex justify-between items-center mb-2 text-lg text-gray-700">
                  <span>Subtotal ({getTotalItems()} productos):</span>
                  <span className="font-semibold text-gray-800">${getTotalPrice().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center font-bold text-2xl text-indigo-800 mt-4 pt-4 border-t-2 border-indigo-200">
                  <span>Total a Pagar:</span>
                  <span>${getTotalPrice().toFixed(2)}</span>
                </div>

                <Separator className="my-6 bg-gray-200" />

                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                    <CreditCard className="mr-2 h-6 w-6 text-indigo-600" /> Métodos de Pago
                </h3>

                {/* Opción de Pago por QR */}
                <div className="border border-green-300 bg-green-50 rounded-lg p-4 mb-4 shadow-sm">
                    <h4 className="font-semibold text-lg mb-3 flex items-center text-green-800">
                        <QrCode className="mr-2 h-5 w-5 text-green-600" /> Pago con QR
                    </h4>
                    <p className="text-sm text-gray-700 mb-3">Escanea el código QR para completar tu pago.</p>
                    <div className="flex justify-center mb-4">
                        <img 
                            src={qrCodeImageUrl} 
                            alt="Código QR para Pago" 
                            className="w-40 h-40 object-contain border border-green-400 p-2 rounded-md"
                        />
                    </div>
                    <Button 
                        onClick={handleSimulatedQrPayment} 
                        className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-2 rounded-lg 
                                   transition-all duration-300 shadow-md hover:shadow-lg text-base"
                        disabled={getTotalItems() === 0}
                    >
                        <CheckCircle className="mr-2 h-5 w-5" /> Confirmar Pago por QR
                    </Button>
                </div>

                {/* Opción de Pasarela de Pago (Simulado Stripe) */}
                <div className="border border-blue-300 bg-blue-50 rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-lg mb-3 flex items-center text-blue-800">
                        <CreditCard className="mr-2 h-5 w-5 text-blue-600" /> Pagar con Tarjeta
                    </h4>
                    <p className="text-sm text-gray-700 mb-3">
                        Serás redirigido a una pasarela de pago segura (ej. Stripe) para completar tu compra.
                        <br/><span className="text-red-500 font-medium text-xs"> (Funcionalidad de demostración - no procesa pago real)</span>
                    </p>
                    <Button 
                        onClick={handleSimulatedStripePayment} 
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg 
                                   transition-all duration-300 shadow-md hover:shadow-lg text-base"
                        disabled={getTotalItems() === 0}
                    >
                        <CreditCard className="mr-2 h-5 w-5" /> Pagar con Tarjeta (Simulado)
                    </Button>
                </div>

                <Button 
                  onClick={() => navigate('/marketplace')} 
                  variant="ghost" 
                  className="w-full text-indigo-600 hover:bg-indigo-100 mt-4 rounded-lg transition-colors"
                >
                  Continuar Comprando
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CartPage;
