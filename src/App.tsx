// src/App.tsx

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Layout from "@/components/layout/Layout";
import DemandPredictionPage from "@/pages/DemandPredictionPage";
// Componentes de UI de Shadcn
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Páginas del sistema ERP (Administrativas/Protegidas)
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Unauthorized from "@/pages/Unauthorized";
import NotFound from "@/pages/NotFound";
import Perfil from "@/pages/Perfil";
import GestionarUsuario from "@/pages/GestionarUsuario";
import Suscripciones from "@/pages/Suscripciones";
import Empresas from "@/pages/Empresas";
import Sucursales from "@/pages/Sucursales";
import Almacenes from "@/pages/Almacenes";
import Categorias from "@/pages/Categorias";
import Productos from "@/pages/Productos";
import Proveedores from "@/pages/Proveedores";

import SettingsPanel from "@/pages/SettingsPanel";

// === Importaciones para Ventas ===
import Ventas from "@/pages/Ventas";
import VentaDetalle from "@/pages/VentaDetalle";
import VentaForm from "@/pages/VentaForm";

// Páginas de Gestión de RBAC (Permisos y Roles)
import RbacPermissions from "@/pages/RbacPermissions";
import RbacRoles from "@/pages/RbacRoles";

// === Importaciones para Movimientos de Stock ===
import Movimientos from "@/pages/MovimientosList";
import MovimientosForm from "@/pages/MovimientosForm";
import MovimientoDetalle from "@/pages/MovimientoDetalle";

// === Importaciones para Reportes ===
import ReportsPage from "@/pages/ReportsPage";

// === NUEVAS IMPORTACIONES PARA EL LADO COMERCIAL (MARKETPLACE) ===
//import LandingPage from "@/pages/LandingPage"; 
import MarketplacePage from "@/pages/MarketplacePage";
import CompanyProductsPage from "@/pages/CompanyProductPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CartPage from "@/pages/CartPage";
import PaymentConfirmationPage from "@/pages/PaymentConfirmationPage"; // Importación de la página de confirmación

// Icono de carrito para la navegación
import { ShoppingCart } from 'lucide-react';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

// Componente para el icono del carrito en la navegación
const CartIcon: React.FC = () => {
  const { getTotalItems } = useCart();
  const totalItems = getTotalItems();

  return (
    <Link to="/cart" className="relative p-2 rounded-md hover:bg-gray-700 transition-colors duration-200">
      <ShoppingCart className="h-6 w-6 text-white" />
      {totalItems > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold animate-bounce-once">
          {totalItems}
        </span>
      )}
    </Link>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Navegación Pública */}
            <nav className="p-4 bg-gray-800 text-white flex items-center justify-between px-6 shadow-lg">
              {/* Contenedor para los enlaces centrados */}
              <div className="flex-grow flex justify-center space-x-6">
                <Link to="/landing" className="hover:text-blue-300 font-semibold transition-colors duration-200">Inicio ERP (Público)</Link>
                <Link to="/marketplace" className="hover:text-blue-300 font-semibold transition-colors duration-200">Marketplace de Tiendas</Link>
                <Link to="/login" className="hover:text-blue-300 font-semibold transition-colors duration-200">Acceso ERP (Admin)</Link>
              </div>
              {/* Icono del carrito a la derecha */}
              <div className="ml-auto">
                <CartIcon />
              </div>
            </nav>

            <Routes>
              {/* Rutas Públicas (accesibles sin autenticación) */}
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/not-found" element={<NotFound />} /> 

              {/* Rutas para el LADO COMERCIAL (Marketplace) - FUERA DE PROTECTEDROUTE */}
             {/* <Route path="/landing" element={<LandingPage />} />*/}
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/marketplace/:empresaId/productos" element={<CompanyProductsPage />} />
              <Route path="/public-products/:productId" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/payment-confirmation" element={<PaymentConfirmationPage />} />


              {/* Ruta por defecto para "/" - si no está autenticado, redirige a /landing */}
              <Route path="/" element={<Navigate to="/landing" replace />} />


              {/* Main protected route with Layout for ERP ADMINISTRATIVE SECTION */}
              <Route
                path="/" 
                element={
                  <ProtectedRoute>
                    <Layout /> 
                  </ProtectedRoute>
                }
              >
                {/* Default route when accessing "/" while authenticated (e.g. after login) */}
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* Rutas administrativas (accesibles con autenticación y permisos) */}
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="perfil" element={<Perfil />} />
                <Route path="personalizacion" element={<SettingsPanel />} />

                {/* User Management and RBAC Routes */}
                <Route
                  path="admin/usuarios"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><GestionarUsuario /></ProtectedRoute>}
                />
                <Route
                  path="admin/roles"
                  element={<ProtectedRoute allowedRoles={["Super Usuario"]}><RbacRoles /></ProtectedRoute>}
                />
                <Route
                  path="admin/permissions"
                  element={<ProtectedRoute allowedRoles={["Super Usuario"]}><RbacPermissions /></ProtectedRoute>}
                />

                {/* Entity Management Routes */}
                <Route
                  path="suscripciones"
                  element={<ProtectedRoute allowedRoles={["Super Usuario"]}><Suscripciones /></ProtectedRoute>}
                />
                <Route
                  path="empresas"
                  element={<ProtectedRoute allowedRoles={["Super Usuario"]}><Empresas /></ProtectedRoute>}
                />
                <Route
                  path="sucursales"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><Sucursales /></ProtectedRoute>}
                />
                <Route
                  path="almacenes"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><Almacenes /></ProtectedRoute>}
                />
                <Route
                  path="categorias"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><Categorias /></ProtectedRoute>}
                />
                <Route
                  path="productos"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><Productos /></ProtectedRoute>}
                />
                <Route
                  path="proveedores"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><Proveedores /></ProtectedRoute>}
                />

                {/* Sales Routes */}
                <Route
                  path="ventas/crear"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario","Empleado"]}><VentaForm /></ProtectedRoute>}
                />
                <Route
                  path="ventas/editar/:id"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><VentaForm /></ProtectedRoute>}
                />
                <Route
                  path="ventas/:id"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><VentaDetalle /></ProtectedRoute>}
                />
                <Route
                  path="ventas"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><Ventas /></ProtectedRoute>}
                />
                
                {/* Stock Movement Routes */}
                <Route
                  path="movimientos"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><Movimientos /></ProtectedRoute>}
                />
                <Route
                  path="movimientos/crear"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><MovimientosForm /></ProtectedRoute>}
                />
                <Route
                  path="movimientos/editar/:id"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><MovimientosForm /></ProtectedRoute>}
                />
                <Route
                  path="movimientos/:id"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><MovimientoDetalle /></ProtectedRoute>}
                />

                {/* Reports Route */}
                <Route
                  path="reports"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><ReportsPage /></ProtectedRoute>}
                />

                {/* Predicción de Demanda */}
                <Route
                  path="demand-prediction"
                  element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><DemandPredictionPage /></ProtectedRoute>}
                />

              </Route>

              {/* Catch-all for not-found routes (if no other route matches) */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
