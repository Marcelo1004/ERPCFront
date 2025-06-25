// src/components/SettingsPanel.tsx

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";

// Definir los colores primarios predefinidos para la selección
const PREDEFINED_PRIMARY_COLORS = [
  { name: 'Indigo (Default)', value: '#4f46e5' }, // Default Light Mode Indigo-600
  { name: 'Blue', value: '#3b82f6' },   // Blue-500
  { name: 'Green', value: '#22c55e' },  // Green-500
  { name: 'Red', value: '#ef4444' },    // Red-500
  { name: 'Purple', value: '#a855f7' }, // Purple-500
  { name: 'Pink', value: '#ec4899' },   // Pink-500
  { name: 'Teal', value: '#14b8a6' },   // Teal-500
];

// Definir las fuentes predefinidas
const PREDEFINED_FONTS = [
  { name: 'Inter', value: 'Inter' },
  { name: 'Roboto', value: 'Roboto' },
  { name: 'Open Sans', value: 'Open Sans' },
  { name: 'Montserrat', value: 'Montserrat' },
  { name: 'Lato', value: 'Lato' },
];

// Definir tamaños de fuente predefinidos
const PREDEFINED_FONT_SIZES = [
  { name: 'Pequeño', value: '0.875rem' }, // Corresponde a text-sm
  { name: 'Normal', value: '1rem' },     // Corresponde a text-base
  { name: 'Grande', value: '1.125rem' }, // Corresponde a text-lg
  { name: 'Muy Grande', value: '1.25rem' }, // Corresponde a text-xl
];

// Helper para convertir HEX a HSL (necesario porque el color picker devuelve HEX)
function hexToHsl(hex: string): string | null {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
    return null;
  }

  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  } else {
    return null;
  }

  r /= 255; g /= 255; b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}


const SettingsPanel = () => {
  const [selectedPrimaryColorHex, setSelectedPrimaryColorHex] = useState<string>(
    localStorage.getItem('theme-primary-color-hex') || PREDEFINED_PRIMARY_COLORS[0].value
  );
  const [selectedBodyFont, setSelectedBodyFont] = useState<string>(
    localStorage.getItem('theme-body-font') || PREDEFINED_FONTS[0].name
  );
  // === NUEVO ESTADO PARA EL TAMAÑO DE FUENTE ===
  const [selectedFontSize, setSelectedFontSize] = useState<string>(
    localStorage.getItem('theme-font-size') || PREDEFINED_FONT_SIZES[1].value // 'Normal' como default
  );
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    localStorage.getItem('theme-mode') === 'dark'
  );

  useEffect(() => {
    applyTheme(selectedPrimaryColorHex, selectedBodyFont, selectedFontSize, isDarkMode);
  }, [selectedPrimaryColorHex, selectedBodyFont, selectedFontSize, isDarkMode]);

  // === FUNCIÓN applyTheme AHORA TOMA selectedFontSize ===
  const applyTheme = (primaryColorHex: string, bodyFontName: string, fontSize: string, darkMode: boolean) => {
    const root = document.documentElement;

    const primaryHsl = hexToHsl(primaryColorHex);
    if (primaryHsl) {
        root.style.setProperty('--primary', primaryHsl);
    } else {
        root.style.removeProperty('--primary');
    }

    const fontValue = PREDEFINED_FONTS.find(f => f.name === bodyFontName)?.value || PREDEFINED_FONTS[0].value;
    root.style.setProperty('--font-family-body', fontValue);
    root.style.setProperty('--font-family-heading', fontValue);

    // === APLICAR TAMAÑO DE FUENTE ===
    root.style.setProperty('--font-size-base', fontSize);

    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('theme-primary-color-hex', selectedPrimaryColorHex);
    localStorage.setItem('theme-body-font', selectedBodyFont);
    localStorage.setItem('theme-font-size', selectedFontSize); // Guardar tamaño de fuente
    localStorage.setItem('theme-mode', isDarkMode ? 'dark' : 'light');
    applyTheme(selectedPrimaryColorHex, selectedBodyFont, selectedFontSize, isDarkMode); // Pasar tamaño de fuente
    toast({ title: "Configuración guardada", description: "Tus preferencias de personalización han sido aplicadas." });
  };

  const handleResetSettings = () => {
    localStorage.removeItem('theme-primary-color-hex');
    localStorage.removeItem('theme-body-font');
    localStorage.removeItem('theme-font-size'); // Eliminar tamaño de fuente
    localStorage.removeItem('theme-mode');

    setSelectedPrimaryColorHex(PREDEFINED_PRIMARY_COLORS[0].value);
    setSelectedBodyFont(PREDEFINED_FONTS[0].name);
    setSelectedFontSize(PREDEFINED_FONT_SIZES[1].value); // Restablecer tamaño de fuente
    setIsDarkMode(false);

    toast({ title: "Configuración restablecida", description: "Las preferencias han vuelto a los valores por defecto." });
  };

  return (
    <div className="p-6 space-y-6 bg-card text-card-foreground rounded-lg shadow-2xl border border-border">
      <h2 className="text-2xl font-bold text-foreground">Personalización Básica</h2>
      <p className="text-muted-foreground">Ajusta los colores y tipos de letra de tu interfaz.</p>

      <Separator className="bg-border" />

      {/* Selector de Color Primario */}
      <div className="space-y-2">
        <Label htmlFor="primary-color-picker" className="text-foreground">Color Primario</Label>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Input
              id="primary-color-picker"
              type="color"
              value={selectedPrimaryColorHex}
              onChange={(e) => setSelectedPrimaryColorHex(e.target.value)}
              className="h-10 w-full sm:w-20 p-1 rounded-md border-input bg-background focus:ring-ring focus:border-ring cursor-pointer"
          />
          <Select
              value={selectedPrimaryColorHex}
              onValueChange={setSelectedPrimaryColorHex}
          >
              <SelectTrigger className="w-full sm:w-[200px] bg-input text-foreground border-border focus:ring-ring">
                  <SelectValue placeholder="Selecciona un color" />
              </SelectTrigger>
              <SelectContent>
                  {PREDEFINED_PRIMARY_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center">
                              <div className="h-4 w-4 rounded-full mr-2 border border-border" style={{ backgroundColor: color.value }}></div>
                              {color.name}
                          </div>
                      </SelectItem>
                  ))}
              </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selector de Tipo de Letra */}
      <div className="space-y-2">
        <Label htmlFor="body-font-select" className="text-foreground">Tipo de Letra</Label>
        <Select
          value={selectedBodyFont}
          onValueChange={setSelectedBodyFont}
        >
          <SelectTrigger className="w-full sm:w-[240px] bg-input text-foreground border-border focus:ring-ring">
            <SelectValue placeholder="Selecciona una fuente" />
          </SelectTrigger>
          <SelectContent>
            {PREDEFINED_FONTS.map(font => (
              <SelectItem key={font.name} value={font.name}>
                {font.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* === NUEVO: Selector de Tamaño de Letra === */}
      <div className="space-y-2">
        <Label htmlFor="font-size-select" className="text-foreground">Tamaño de Letra Base</Label>
        <Select
          value={selectedFontSize}
          onValueChange={setSelectedFontSize}
        >
          <SelectTrigger className="w-full sm:w-[240px] bg-input text-foreground border-border focus:ring-ring">
            <SelectValue placeholder="Selecciona un tamaño" />
          </SelectTrigger>
          <SelectContent>
            {PREDEFINED_FONT_SIZES.map(size => (
              <SelectItem key={size.value} value={size.value}>
                {size.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* === FIN NUEVO === */}

      {/* Selector de Modo Oscuro */}
      <div className="flex items-center space-x-2">
        <Input
          id="dark-mode-toggle"
          type="checkbox"
          checked={isDarkMode}
          onChange={(e) => setIsDarkMode(e.target.checked)}
          className="h-4 w-4 text-primary accent-primary border-border rounded focus:ring-ring"
        />
        <Label htmlFor="dark-mode-toggle" className="text-foreground">Habilitar Modo Oscuro</Label>
      </div>

      {/* Botones de Acción */}
      <div className="flex justify-end space-x-4">
        <Button
          variant="outline"
          onClick={handleResetSettings}
          className="px-4 py-2 rounded-md border-border text-foreground hover:bg-background/80"
        >
          Restablecer
        </Button>
        <Button
          onClick={handleSaveSettings}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md shadow-md"
        >
          Guardar Cambios
        </Button>
      </div>
    </div>
  );
};

export default SettingsPanel;