import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Layout from '@/components/layout/Layout';

// Componentes de UI de Shadcn
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';


// Páginas del sistema ERP
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Unauthorized from '@/pages/Unauthorized';
import NotFound from '@/pages/NotFound';
import Perfil from '@/pages/Perfil';
import GestionarUsuario from '@/pages/GestionarUsuario';
import Suscripciones from '@/pages/Suscripciones';
import Empresas from '@/pages/Empresas';
import Sucursales from '@/pages/Sucursales';
import Almacenes from '@/pages/Almacenes';
import Categorias from '@/pages/Categorias';
import Productos from '@/pages/Productos';

// Importa el SettingsPanel
import SettingsPanel from '@/pages/SettingsPanel';

// === NUEVAS IMPORTACIONES PARA VENTAS ===
import Ventas from '@/pages/Ventas'; // Listado de ventas
import VentaDetalle from '@/pages/VentaDetalle'; // Detalle de venta
import VentaForm from '@/pages/VentaForm'; // Formulario de creación/edición de venta


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
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout /> {/* Layout para las rutas protegidas */}
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              <Route path="gestionar-usuarios" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER']}> 
                  <GestionarUsuario />
                </ProtectedRoute>
              } />
              
              <Route path="perfil" element={
                <ProtectedRoute>
                  <Perfil />
                </ProtectedRoute>
              } />

              <Route path="suscripciones" element={
                <ProtectedRoute allowedRoles={['SUPERUSER']}>
                  <Suscripciones />
                </ProtectedRoute>
              } />
              <Route path="empresas" element={
                <ProtectedRoute allowedRoles={['SUPERUSER']}>
                  <Empresas />
                </ProtectedRoute>
              } />
              <Route path="sucursales" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER']}>
                  <Sucursales />
                </ProtectedRoute>
              } />
              <Route path="almacenes" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER', 'EMPLEADO']}>
                  <Almacenes />
                </ProtectedRoute>
              } />
              <Route path="categorias" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER', 'EMPLEADO']}>
                  <Categorias />
                </ProtectedRoute>
              } />
              <Route path="productos" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER', 'EMPLEADO']}>
                  <Productos />
                </ProtectedRoute>
              } />

              <Route path="personalizacion" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER', 'EMPLEADO', 'CLIENTE']}>
                  <SettingsPanel />
                </ProtectedRoute>
              } />

              
              <Route path="ventas" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER', 'EMPLEADO']}>
                  <Ventas />
                </ProtectedRoute>
              } />
              {/* Detalle de Venta (visible para Empleado, Admin, Superuser) */}
              <Route path="ventas/:id" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER', 'EMPLEADO']}>
                  <VentaDetalle />
                </ProtectedRoute>
              } />
              {/* Formulario de Creación de Venta (solo para Admin, Superuser) */}
              <Route path="ventas/crear" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER']}>
                  <VentaForm />
                </ProtectedRoute>
              } />
              {/* Formulario de Edición de Venta (solo para Admin, Superuser) */}
              <Route path="ventas/editar/:id" element={
                <ProtectedRoute allowedRoles={['ADMINISTRATIVO', 'SUPERUSER']}>
                  <VentaForm />
                </ProtectedRoute>
              } />
             

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;