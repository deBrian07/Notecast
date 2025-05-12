import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },

  // 1) For dep pre-bundling (import-analysis) ensure .jsx is parsed:
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js':   'jsx',
        '.jsx':  'jsx'
      }
    }
  },

  // 2) For the dev server and build transforms (plugin-react handles .jsx/.tsx):
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: ['notecast.infinia.chat']
  }
})