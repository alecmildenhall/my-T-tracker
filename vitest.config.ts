import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { appVersion } from './version'

// Mirror vite.config.ts's __APP_VERSION__ inject (shared via version.ts) so
// appMeta.ts resolves under test too.
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
})
