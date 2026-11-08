import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Must match auth.site_url / additional_redirect_urls in supabase/config.toml.
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks that change less often than app code.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          nextui: ['@nextui-org/react', 'framer-motion'],
          supabase: ['@supabase/supabase-js'],
          charts: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
})
