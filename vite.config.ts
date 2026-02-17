import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/IGA_v2/', // Ensure 'IGA' is uppercase if your repo is 'IGA_v2'
  plugins: [react()],
});
