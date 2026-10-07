import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Flask API runs on port 5000. In development Vite forwards these paths to it,
// so the frontend can call /predict the same way whether it's served by Vite or by Flask.
const API = 'http://127.0.0.1:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/predict': API,
      '/stats': API,
      '/health': API,
    },
  },
})
