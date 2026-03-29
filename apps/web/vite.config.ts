import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const webPort = Number(process.env.WEB_PORT ?? 5173)
const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:3000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lama-stage/shared-types': path.resolve(__dirname, '../../packages/shared-types/dist/esm'),
    },
  },
  server: {
    port: webPort,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600, // Ustawienie limitu ostrzeżeń na 600 KB
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const parts = id.split('node_modules/');
            const packageName = parts[parts.length - 1].split('/')[0];
            // Group specific large libraries
            if (['react', 'react-dom'].includes(packageName)) {
              return 'vendor_react';
            }
            if (packageName.startsWith('@fullcalendar')) {
              return 'vendor_fullcalendar';
            }
            if (packageName === 'date-fns') {
              return 'vendor_date_fns';
            }
            // Group other node_modules into a general vendor chunk
            return 'vendor_' + packageName.replace(/[^a-zA-Z0-9_]/g, '');
          }
        },
      },
    },
  },
})
