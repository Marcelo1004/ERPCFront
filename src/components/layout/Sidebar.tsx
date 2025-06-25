import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { 
  User, 
  Calendar, 
  Grid2X2, 
  ClipboardCheck,
  ClipboardPlus,
  ListCheck,
  LogOut,
  BrainCircuit,
  GraduationCap,
  BookOpen,
  BarChart, 
  BookOpenCheck, 
  Server, 
  Briefcase, 
  MapPin, 
  Warehouse, 
  Tag, 
  Package, 
  Users, 
  Menu, 
  ChevronLeft, 
  ChevronRight,
  Palette,
  ReceiptText // <--- NUEVA IMPORTACIÓN: Icono para Ventas
} from 'lucide-react';
import { Button } from '../../components/ui/button';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const getRoleInSpanish = (role: string) => {
    switch (role) {
      case 'CLIENTE': return 'Cliente';
      case 'SUPERUSER': return 'Super Usuario';
      case 'ADMINISTRATIVO': return 'Administrativo';
      case 'EMPLEADO': return 'Empleado';
      default: return role;
    }
  };

  // Definir ítems de navegación comunes para todos los usuarios autenticados
  const commonNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Grid2X2 },
    { path: '/perfil', label: 'Mi Perfil', icon: User },
    { path: '/personalizacion', label: 'Personalización', icon: Palette },
  ];

  const clienteNavItems = [
    ...commonNavItems,
  ];

  const empleadoNavItems = [
    ...commonNavItems,
    { path: '/almacenes', label: 'Almacenes', icon: Warehouse },
    { path: '/categorias', label: 'Categorías', icon: Tag },
    { path: '/productos', label: 'Productos', icon: Package },
    { path: '/ventas', label: 'Ventas', icon: ReceiptText }, // <--- NUEVO ÍTEM DE MENÚ PARA VENTAS
  ];

  const administrativoNavItems = [
    ...commonNavItems,
    { path: '/gestionar-usuarios', label: 'Gestionar Usuarios', icon: Users },
    { path: '/sucursales', label: 'Sucursales', icon: MapPin },
    { path: '/almacenes', label: 'Almacenes', icon: Warehouse },
    { path: '/categorias', label: 'Categorías', icon: Tag },
    { path: '/productos', label: 'Productos', icon: Package },
    { path: '/ventas', label: 'Ventas', icon: ReceiptText }, // <--- NUEVO ÍTEM DE MENÚ PARA VENTAS
  ];

  const superUserNavItems = [
    ...commonNavItems,
    { path: '/empresas', label: 'Gestión de Empresas', icon: Briefcase },
    { path: '/suscripciones', label: 'Planes Suscripción', icon: Server },
    { path: '/gestionar-usuarios', label: 'Gestionar Usuarios', icon: Users },
    { path: '/sucursales', label: 'Sucursales', icon: MapPin },
    { path: '/almacenes', label: 'Almacenes', icon: Warehouse },
    { path: '/categorias', label: 'Categorías', icon: Tag },
    { path: '/productos', label: 'Productos', icon: Package },
    { path: '/ventas', label: 'Ventas', icon: ReceiptText }, // <--- NUEVO ÍTEM DE MENÚ PARA VENTAS
  ].filter((item, index, self) => 
    index === self.findIndex((t) => t.path === item.path)
  );


  let navItems = [];
  if (user?.role === 'SUPERUSER') {
    navItems = superUserNavItems;
  } else if (user?.role === 'ADMINISTRATIVO') {
    navItems = administrativoNavItems;
  } else if (user?.role === 'EMPLEADO') {
    navItems = empleadoNavItems;
  } else {
    navItems = clienteNavItems;
  }

  return (
    <div className={cn(
      "bg-gray-800 text-white border-r border-gray-700 transition-all duration-300 flex flex-col h-full shadow-lg rounded-r-xl",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">ERP</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">ERP Cloud</h1>
              <p className="text-gray-400 text-xs">Gestión Empresarial</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "text-gray-400 hover:bg-gray-700 rounded-md",
            isCollapsed ? "w-full" : "ml-auto"
          )}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      {!isCollapsed && user && (
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center shadow-sm">
              <User className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-gray-400 text-xs truncate">
                {getRoleInSpanish(user.role)}
              </p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path) && item.path !== '/'; // Usar startsWith para rutas anidadas como /ventas/:id
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors duration-200",
                isActive 
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white",
                isCollapsed && "justify-center"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <Button
          variant="ghost"
          onClick={logout}
          className={cn(
            "w-full text-gray-300 hover:bg-gray-700 hover:text-white justify-start rounded-md",
            isCollapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="ml-3">Cerrar Sesión</span>}
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
