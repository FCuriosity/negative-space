import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({ base: './', root: fileURLToPath(new URL('.', import.meta.url)), plugins: [react()], server: { port: 1420, strictPort: true }, build: { outDir: '../../dist/desktop', emptyOutDir: true } });
