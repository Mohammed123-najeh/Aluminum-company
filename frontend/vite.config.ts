import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
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

