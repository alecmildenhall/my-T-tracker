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
    // Enforce isolation via config rather than per-file cleanup: restore any
    // vi.stubGlobal (e.g. a stubbed `crypto`) to its original before each test,
    // so a stub can't leak across tests or make the suite order-dependent.
    unstubGlobals: true,
  },
})
