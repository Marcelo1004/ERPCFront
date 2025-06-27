// src/pages/PaymentConfirmationPage.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Home, ShoppingCart } from 'lucide-react';

const PaymentConfirmationPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-8 bg-gray-50 min-h-screen font-sans flex items-center justify-center">
      <Card className="shadow-2xl rounded-xl border border-green-200 bg-white max-w-md w-full text-center p-6">
        <CardHeader className="flex flex-col items-center justify-center p-0 mb-6">
          <CheckCircle className="h-24 w-24 text-green-500 mb-4 animate-scale-in" />
          <CardTitle className="text-3xl font-extrabold text-green-700 mb-2">¡Compra Exitosa!</CardTitle>
          <p className="text-gray-600 text-lg">Tu pedido ha sido procesado correctamente.</p>
        </CardHeader>
        <CardContent className="p-0">
          <p className="text-gray-700 mb-6">
            Gracias por tu compra. Recibirás una confirmación por correo electrónico con los detalles de tu pedido.
          </p>
          <div className="flex flex-col space-y-4">
            <Button 
              onClick={() => navigate('/marketplace')} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg 
                         shadow-md hover:shadow-lg transition-all duration-300 text-base"
            >
              <ShoppingCart className="mr-2 h-5 w-5" /> Continuar Comprando
            </Button>
            <Button 
              onClick={() => navigate('/landing')} 
              variant="outline" 
              className="w-full border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold py-3 rounded-lg 
                         shadow-sm hover:shadow-md transition-all duration-300 text-base"
            >
              <Home className="mr-2 h-5 w-5" /> Ir a la Página de Inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentConfirmationPage;
