import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Relative asset paths serve the same build from Tauri and from a GitHub Pages project subpath.
    base: './',
    plugins: [react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
