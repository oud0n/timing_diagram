import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// GoatCounter is added only when GOATCOUNTER_URL is set (the GitHub Pages workflow); desktop and local builds stay untracked.
function goatCounter(endpoint: string | undefined): Plugin {
  return {
    name: 'goatcounter',
    transformIndexHtml() {
      if (!endpoint) return [];
      return [{ tag: 'script', attrs: { 'data-goatcounter': endpoint, async: true, src: 'https://gc.zgo.at/count.js' }, injectTo: 'body' }];
    },
  };
}

export default defineConfig(() => {
  return {
    // Relative asset paths serve the same build from Tauri and from a GitHub Pages project subpath.
    base: './',
    plugins: [react(), tailwindcss(), goatCounter(process.env.GOATCOUNTER_URL)],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
