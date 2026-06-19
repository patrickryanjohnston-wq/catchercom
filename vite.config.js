import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host:true so you can open the dev server from a phone on the same Wi-Fi
// and test real Bluetooth audio routing.
export default defineConfig({
  plugins: [react()],
  server: { host: true },
})
