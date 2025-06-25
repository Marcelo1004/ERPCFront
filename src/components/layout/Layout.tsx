// src/components/layout/Layout.tsx

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PanelLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Ya NO importamos SettingsPanel aquí, porque se renderiza en su propia ruta
// import SettingsPanel from '@/components/SettingsPanel';

// Asumo que tienes un componente Sidebar (ej. en '@/components/layout/Sidebar')
import Sidebar from '@/components/layout/Sidebar'; // Ejemplo: tu componente de navegación lateral

const Layout = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground font-body">
      {/* Sidebar fijo para desktop */}
      <aside className={`hidden md:flex flex-col fixed inset-y-0 border-r border-border bg-sidebar-background text-sidebar-foreground transition-all duration-300
        ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}
      >
        <Sidebar isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} />
      </aside>

      {/* Contenido principal, con margen para el sidebar en desktop */}
      <div className={`flex flex-col flex-1 transition-all duration-300
        ${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}
      >
        {/* Header para móviles y desktop */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          {/* Botón para abrir el sidebar en móvil */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden bg-input border-input">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs p-0 bg-sidebar-background text-sidebar-foreground border-border">
              {/* Sidebar dentro del Sheet para móvil */}
              <Sidebar isCollapsed={false} onToggle={handleToggleSidebar} />
            </SheetContent>
          </Sheet>

          {/* Barra de búsqueda (si tienes una) */}
          <div className="relative ml-auto flex-1 md:grow-0">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="w-full rounded-lg bg-input pl-9 md:w-[200px] lg:w-[336px] border-input text-foreground"
            />
          </div>

          {/* Aquí puedes añadir otros elementos del header, como el botón de perfil o notificaciones */}
        </header>

        {/* Contenido principal de la aplicación */}
        <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          {/* El SettingsPanel YA NO se renderiza aquí directamente.
              Ahora se accede a él a través de su ruta '/personalizacion'. */}
          <Outlet /> {/* Outlet renderiza el contenido de la ruta anidada (ej. Dashboard, Productos, SettingsPanel, etc.) */}
        </main>
      </div>
    </div>
  );
};

export default Layout;