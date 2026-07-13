See @README.md for product context, privacy model, and roadmap.

# Commands
- `npm run dev` / `npm run dev:host` (LAN, for phone testing)
- `npm run build` — typecheck (`tsc -b`) + Vite build
- `npm run lint`
- `npm test -- --run` — run the suite once (use this, not watch mode, to verify a change)
- `npm test -- --run <path>` — single test file
- `npm test -- --coverage`

Run `npm test -- --run` and `npm run build` before considering a change done.

# Code style
- `ShotEntry` (`src/types/shot.ts`) optional fields must never be stored as empty strings — coerce empty form values to `undefined` before storing.
- IDs: `crypto.randomUUID()`, fallback `` `shot-${Date.now()}` ``.
- `verbatimModuleSyntax` is on — use `import type` for type-only imports.

# Testing
- Tests live in `__tests__/` next to the code they cover (`*.test.ts(x)`).
- `beforeEach(() => localStorage.clear())` in every test file that touches storage.

# Privacy (non-negotiable)
- No network layer (fetch/API calls), analytics, telemetry, or third-party SDKs — everything stays in `localStorage`. Stop and confirm with the user before adding any of these.
- No CDN-loaded fonts/scripts/styles — local or inline only.
- `ShotEntry` must stay free of PII (name, email, location, device ID).
