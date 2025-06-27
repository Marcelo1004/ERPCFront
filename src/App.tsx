import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Layout from "@/components/layout/Layout";

// Componentes de UI de Shadcn
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Páginas del sistema ERP
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

// === NUEVA IMPORTACIÓN PARA REPORTES ===
import ReportsPage from "@/pages/ReportsPage";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes (accessible without authentication) */}
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Main protected route with Layout. 
              All nested routes here will inherit ProtectedRoute and Layout.
            */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Default route when accessing "/" while authenticated */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* General user routes */}
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

              {/* === NEW REPORTS ROUTE === */}
              <Route
                path="reports"
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><ReportsPage /></ProtectedRoute>}
              />

            </Route>

            {/* Catch-all for not-found routes outside the protected layout or login */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;