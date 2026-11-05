import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // The muscle map is only reached through a lazy import, so the dev server
  // would otherwise discover it mid-session, re-bundle, and briefly serve two
  // copies of React. Pre-bundling it up front avoids that reload.
  optimizeDeps: {
    include: ['react-muscle-highlighter'],
  },
})
