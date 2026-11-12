// vite.config.mjs
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    devSourcemap: true,   // F12 muestra el .scss y la línea de cada regla
  },
  // server: { watch: { usePolling: true } },  // solo si al guardar no se actualiza (Docker Desktop en Windows)
});
