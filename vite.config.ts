import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { appVersion } from './version'

// Expose the app version (from package.json, see version.ts) as __APP_VERSION__
// so it can be stamped into data exports without hand-syncing a second copy.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
})
