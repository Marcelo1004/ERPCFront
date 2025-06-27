import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import {
  User,
  Grid2X2,
  LogOut,
  Server, // Posible cambio
  Briefcase,
  MapPin,
  Warehouse,
  Tag,
  Package,
  Users,
  KeyRound,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Palette,
  ReceiptText,
  LucideProps,
  // Nuevos iconos importados o alternativas
  CreditCard, // Alternativa para Suscripción
  Repeat, // Alternativa para Suscripción
  Truck, // Propuesta para Proveedores
  ArrowLeftRight, // Propuesta para Movimientos de Stock
  Package2, // Otra propuesta para Movimientos de Stock
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { ForwardRefExoticComponent, RefAttributes } from 'react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
  permission?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle }) => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();

  const userRoleName = user?.role?.name;

  const getRoleInSpanish = (roleName: string | undefined) => {
    switch (roleName) {
      case 'Cliente': return 'Cliente';
      case 'Super Usuario': return 'Super Usuario';
      case 'Administrador': return 'Administrador';
      case 'Empleado': return 'Empleado';
      default: return roleName || 'Desconocido';
    }
  };

  const navSections = [
    {
      title: 'Area Personal',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: Grid2X2 },
        { path: '/perfil', label: 'Mi Perfil', icon: User },
        { path: '/personalizacion', label: 'Personalización', icon: Palette },
      ]
    },
    {
      title: 'Módulo de Ventas',
      items: [
        { path: '/empresas', label: 'Gestionar Empresas', icon: Briefcase, permission: 'view_empresa' },
        { path: '/suscripciones', label: 'Gestionar Suscripción', icon: Repeat, permission: 'view_suscripcion' }, // <-- CAMBIADO: Repeat
        
        
        { path: '/ventas', label: 'Ventas', icon: ReceiptText, permission: 'view_venta' },
      ]
    },
    {
      title: 'Módulo de Inventario',
      items: [
        { path: '/sucursales', label: 'Sucursales', icon: MapPin, permission: 'view_sucursal' },
        { path: '/almacenes', label: 'Almacenes', icon: Warehouse, permission: 'view_almacen' },
        { path: '/categorias', label: 'Categorías', icon: Tag, permission: 'view_categoria' },
        { path: '/productos', label: 'Productos', icon: Package, permission: 'view_producto' },
        { path: '/proveedores', label: 'Proveedores', icon: Truck, permission: 'view_proveedor' },
        { path: '/movimientos', label: 'Movimientos de Stock', icon: ArrowLeftRight, permission: 'view_movimiento' }, 
      ]
    },
    {
      title: 'Módulo de Control de Acceso',
      items: [
        { path: '/admin/usuarios', label: 'Gestionar Usuarios', icon: Users, permission: 'manage_users' },
        { path: '/admin/roles', label: 'Gestionar Roles', icon: KeyRound, permission: 'manage_roles' },
        { path: '/admin/permissions', label: 'Gestionar Permisos', icon: ShieldCheck, permission: 'manage_permissions' },
      ]
    }
  ];

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
                {getRoleInSpanish(userRoleName)}
              </p>
              {user.empresa_detail && (
                  <p className="text-gray-400 text-xs truncate">
                      Empresa: {user.empresa_detail.nombre}
                  </p>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navSections.map((section, sectionIndex) => (
          <React.Fragment key={sectionIndex}>
            {section.title && !isCollapsed && (
              <div className="pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const canSeeItem = item.permission ? (user ? hasPermission(item.permission) : false) : true;

              if (!canSeeItem) {
                return null;
              }

              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path) &&
                               (location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path + '/')));

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
            {sectionIndex < navSections.length - 1 && !isCollapsed && (
              <hr className="border-t border-gray-700 my-2" />
            )}
          </React.Fragment>
        ))}
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