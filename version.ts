import { readFileSync } from 'node:fs'

// Single source of truth for the app version at build/test time. Both
// vite.config.ts and vitest.config.ts read it from here so the __APP_VERSION__
// they inject can never drift apart. package.json remains the origin of the value.
export const appVersion = (
  JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
  ) as { version: string }
).version
