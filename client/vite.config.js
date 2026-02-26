import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // bind to 0.0.0.0 — accessible from any device on the LAN
    port: 5173,
  }
})
