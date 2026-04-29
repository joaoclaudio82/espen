import { defineConfig } from 'vite';

// Configuração mínima — porta 5173 alinha com o `cors_origins` do backend.
// Em prod o build estático sai em `dist/`; sirva por trás do nginx ou afins.
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    chunkSizeWarningLimit: 2000, // legacy.js ainda é grande até a próxima fase de split
  },
});
