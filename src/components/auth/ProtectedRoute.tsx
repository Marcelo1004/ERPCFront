// src/components/auth/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; // Asegúrate de que esta ruta sea correcta
import { UserRoleName } from '@/types/rbac'; // Importa el tipo de rol si lo usas

interface ProtectedRouteProps {
  children: React.ReactNode; // ¡ESTO ES CRUCIAL! Indica que el componente acepta elementos hijos
  allowedRoles?: UserRoleName[]; // Ejemplo: si tu ruta protegida recibe roles permitidos
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth(); // Asegúrate de que useAuth provee estos estados

  if (isLoading) {
    // Puedes renderizar un spinner o un indicador de carga aquí
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="flex items-center text-gray-700">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Cargando autenticación...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Si no está autenticado, redirige a la página de login
    return <Navigate to="/login" replace />;
  }

  // Verifica si el usuario tiene un rol permitido, si se especificaron
  if (allowedRoles && user?.role?.name && !allowedRoles.includes(user.role.name)) {
    // Si no tiene el rol permitido, redirige a la página de no autorizado
    return <Navigate to="/unauthorized" replace />;
  }

  // Si todo está bien, renderiza los componentes hijos
  return <>{children}</>;
};

export default ProtectedRoute;
