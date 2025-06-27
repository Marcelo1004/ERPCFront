// src/components/layout/Layout.tsx

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

import Sidebar from '@/components/layout/Sidebar'; 

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
    // Contenedor principal:
    // - 'flex' para colocar el sidebar y el contenido en fila.
    // - 'h-screen' para que ocupe el 100% de la altura de la ventana.
    // Se eliminó 'overflow-hidden' aquí para permitir el scroll en el main content.
    <div className="flex h-screen bg-background text-foreground font-body">
      {/* Sidebar fijo para desktop */}
      {/* - 'flex-shrink-0' previene que el sidebar se encoja.
          - 'fixed inset-y-0' lo fija a los lados de la ventana.
          - 'z-40' lo asegura por encima de otros elementos si hay superposiciones.
      */}
      <aside className={`hidden md:flex flex-col flex-shrink-0 fixed inset-y-0 border-r border-border bg-sidebar-background text-sidebar-foreground transition-all duration-300 z-40
        ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}
      >
        <Sidebar isCollapsed={isSidebarCollapsed} onToggle={handleToggleSidebar} />
      </aside>

      {/* Contenido principal, que abarca el resto de la pantalla */}
      {/* - 'flex-1' para que ocupe todo el ancho restante después del sidebar.
          - 'flex-col' para que el header y el main se apilen verticalmente.
          - 'overflow-hidden' para contener sus propios hijos.
          - Margen izquierdo dinámico para hacer espacio al sidebar.
      */}
      <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-300
        ${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}
      >
        {/* Header: se mantiene pegajoso en la parte superior de esta sección de contenido */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          {/* Botón para abrir el sidebar en móvil */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden bg-input border-input">
                {/* INICIO DEL CAMBIO: Envolvemos los hijos del botón en un Fragment */}
                <>
                  <PanelLeft className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </>
                {/* FIN DEL CAMBIO */}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="sm:max-w-xs p-0 bg-sidebar-background text-sidebar-foreground border-border">
              {/* Sidebar dentro del Sheet para móvil: siempre no colapsado para mostrar completo */}
              <Sidebar isCollapsed={false} onToggle={handleToggleSidebar} />
            </SheetContent>
          </Sheet>

          {/* Espacio para otros elementos del header (ej. perfil de usuario, notificaciones) */}
          <div className="ml-auto">
            {/* Si tienes algo aquí, como un botón de usuario o notificaciones, iría aquí */}
          </div>
        </header>

        {/* Contenido principal de la aplicación: ¡Esta es la clave para el scroll! */}
        {/* - 'flex-1' para que ocupe TODO el espacio vertical restante después del header.
            - 'overflow-y-auto' para gestionar su propio scroll vertical. 
              ¡Si el contenido dentro del Outlet es más largo, solo esta área se desplazará!
            - 'p-4 sm:px-6 md:gap-8': Mantén tu padding aquí.
        */}
        <main className="flex-1 overflow-y-auto p-4 sm:px-6 md:gap-8"> 
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
