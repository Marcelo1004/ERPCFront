import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Modo de desarrollo - Establece en true para desactivar temporalmente las restricciones de roles
// IMPORTANTE: Recuerda establecerlo en false antes de pasar a producción
const DEV_MODE = false;

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'CLIENTE' | 'EMPLEADO' | 'ADMINISTRATIVO' | 'SUPERUSER'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles
}) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // En modo desarrollo, permitir acceso sin restricciones de rol
  if (!DEV_MODE && allowedRoles && user && !allowedRoles.includes(user.role)) {
    console.log('Acceso denegado - Rol requerido:', allowedRoles, 'Rol actual:', user.role);
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
