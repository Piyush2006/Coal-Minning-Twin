import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['.iocompute.ai'],
    // The UNS namespace-browser service sends no Access-Control-Allow-Origin for our
    // origin, so a direct browser fetch fails CORS ("Network error"). Proxy it
    // same-origin: the browser calls /uns-api/* and Vite forwards it server-side
    // (no CORS). unsBrowse.js uses /uns-api in dev. (Prod needs the server to allow
    // the deployed origin, or an equivalent reverse proxy.)
    proxy: {
      '/uns-api': {
        target: 'https://uns-backend-server.iosense.io',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/uns-api/, ''),
      },
      // (Bruce agents platform is called DIRECTLY — it sends permissive CORS,
      // and a dev-only proxy path would 404 on production builds.)
    },
  },
  optimizeDeps: {
    // Pre-bundle the full heavy dep set up front, so adding an import mid-session
    // doesn't trigger a re-optimize + reload (the main cause of the stale-module
    // blank screen). Keep roughly in sync with package.json dependencies.
    include: [
      'three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing',
      '@xyflow/react', 'framer-motion', 'highcharts', 'highcharts-react-official',
      'zustand', 'zustand/middleware', 'immer', 'nanoid',
    ],
  },
})
