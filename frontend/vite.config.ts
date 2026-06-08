import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing, large deps into their own long-lived chunks so a
        // code change to app logic doesn't invalidate them in the browser cache.
        // Vite 8 (Rolldown) requires manualChunks as a function, not a map.
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
            return 'react-vendor';
          }
          // 3.6k-line translation tables — large and change independently of UI code.
          if (id.includes('/src/i18n/translations')) {
            return 'i18n';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev: browser calls same-origin /api/* → forwarded to Laravel (avoids wrong host / double /api in VITE_API_BASE_URL).
      '/api': {
        // Default 8001: port 8000 often has multiple listeners on Windows and returns wrong 404s.
        target: process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
});

