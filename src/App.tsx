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
import Movimientos from "@/pages/MovimientosList"; // Mantengo tu nombre de importación "Movimientos"
import MovimientosForm from "@/pages/MovimientosForm"; // Mantengo tu nombre de importación "MovimientosForm"
import MovimientoDetalle from "@/pages/MovimientoDetalle"; // ¡NUEVO: Importa el componente de detalle!


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
            {/* Rutas Públicas (accesibles sin autenticación) */}
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Ruta principal protegida con Layout. 
              Todas las rutas anidadas aquí heredarán ProtectedRoute y Layout.
            */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              {/* Ruta por defecto cuando se accede a "/" estando autenticado */}
              <Route index element={<Navigate to="/dashboard" replace />} />

              {/* Rutas generales de usuario */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="personalizacion" element={<SettingsPanel />} />

              {/* Rutas de Gestión de Usuarios y RBAC */}
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

              {/* Rutas de Gestión de Entidades */}
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
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><Almacenes /></ProtectedRoute>}
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
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><Proveedores /></ProtectedRoute>}
              />

              {/* Rutas de Ventas */}
              {/* Rutas anidadas dentro del Layout */}
              <Route
                path="ventas/crear"
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><VentaForm /></ProtectedRoute>}
              />
              {/* Más específica: Editar Venta */}
              <Route
                path="ventas/editar/:id"
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario"]}><VentaForm /></ProtectedRoute>}
              />
              {/* Genérica: Detalles de Venta */}
              <Route
                path="ventas/:id"
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><VentaDetalle /></ProtectedRoute>}
              />
              {/* Ruta base: Lista de Ventas */}
              <Route
                path="ventas"
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><Ventas /></ProtectedRoute>}
              />
              
              {/* === Rutas para Movimientos de Stock === */}
              {/* Ruta base: Lista de Movimientos */}
              <Route
                path="movimientos"
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><Movimientos /></ProtectedRoute>}
              />
              {/* Ruta para crear nuevo movimiento */}
              <Route
                path="movimientos/crear"
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><MovimientosForm /></ProtectedRoute>}
              />
              {/* Más específica: Editar Movimiento */}
              <Route
                path="movimientos/editar/:id"
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><MovimientosForm /></ProtectedRoute>}
              />
              {/* Genérica: Detalles de Movimiento (¡DEBE IR DESPUÉS DE LA RUTA DE EDICIÓN!) */}
              <Route
                path="movimientos/:id"
                element={<ProtectedRoute allowedRoles={["Administrador", "Super Usuario", "Empleado"]}><MovimientoDetalle /></ProtectedRoute>}
              />

              {/* Cierre de la ruta principal con ProtectedRoute y Layout */}
            </Route>

            {/* Catch-all para rutas no encontradas fuera del layout protegido o login */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;