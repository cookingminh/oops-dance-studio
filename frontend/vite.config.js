import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The About page reads the crew's newest YouTube videos through this site, because YouTube's feed sends
// no CORS headers (src/services/youtubeFeed.js). vercel.json does the same once deployed.
const youtubeFeed = {
  '/youtube-feed': {
    target: 'https://www.youtube.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/youtube-feed\/([\w-]+).*$/, '/feeds/videos.xml?playlist_id=$1'),
  },
}

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
    proxy: youtubeFeed,
  },
  preview: {
    proxy: youtubeFeed,
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
