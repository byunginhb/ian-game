import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Pre-bundle the 3D engine at startup so the first visit never triggers a dev re-optimize reload.
  optimizeDeps: { include: ['three', 'three/addons/utils/BufferGeometryUtils.js'] },
})
