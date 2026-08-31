import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* VITE_BASE est renseigné par le workflow GitHub Pages (/nom-du-repo/).
   En local il reste vide, donc la racine. */
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
