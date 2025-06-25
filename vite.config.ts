import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    strictPort: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      // Asegúrate de que esta ruta sea correcta para la raíz de tu código fuente
      // Si App.tsx está en 'src/', y 'contexts', 'components', 'pages' están también en 'src/', entonces path.resolve(__dirname, './src') es lo que necesitas.
      '@': path.resolve(__dirname, './src'), 
    },
  },
}));
