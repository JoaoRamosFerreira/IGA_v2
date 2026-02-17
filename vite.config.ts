import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Ensure the slashes are there and the name matches your repo exactly
  base: '/IGA_v2/', 
  plugins: [react()],
});
