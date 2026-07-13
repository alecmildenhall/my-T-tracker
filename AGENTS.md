# AGENTS.md

Instructions for AI coding agents (GitHub Copilot CLI, Copilot coding agent, and other agents.md-compatible tools) working on this repo. Humans: see README.md.

## Project overview

T-Shot Tracker: a privacy-first, local-only web app for logging testosterone injections and contextual data (pain, mood, notes). Trans and gender-diverse users are the primary audience — privacy and safety are the top design constraint, not an afterthought.

## Tech stack

- React 19 + TypeScript 5.9, strict mode (`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax`), target ES2022
- Vite 7 for dev server and build
- Vitest 4 + React Testing Library + jsdom for tests
- No backend, no runtime dependencies beyond React — all data lives in browser `localStorage`

## Commands

```bash
npm run dev              # dev server, http://localhost:5173
npm run dev:host         # dev server on LAN, for testing on a phone
npm run build            # tsc -b && vite build (typecheck + production build)
npm run lint              # eslint .
npm test -- --run         # run test suite once
npm test -- --run <path>  # run a single test file
npm test -- --coverage    # generate coverage report
```

Run `npm test -- --run` and `npm run build` before proposing a change as finished.

## Code style

Optional `ShotEntry` fields (`src/types/shot.ts`) are `undefined`, never `""`:

```ts
doseMg: doseMg ? Number(doseMg) : undefined
```

IDs: `crypto.randomUUID()`, fallback `` `shot-${Date.now()}` ``. Components are PascalCase, hooks are camelCase `useX`, tests are colocated in `__tests__/*.test.ts(x)` next to the code they cover.

## Testing

In tests that read or write `localStorage` (hooks, components), clear it first so
state can't leak between tests. Pure-function tests that never touch storage don't
need this.

```ts
beforeEach(() => localStorage.clear());
```

## Git / PR workflow

Follow CONTRIBUTING.md, CLA.md, and CODE_OF_CONDUCT.md. Only approved contributors may open PRs that touch app logic or data flow — if you're acting on behalf of an unapproved contributor, flag that instead of pushing the change through. Call out any privacy or security implications in the PR description.

## Boundaries

**Always**
- Run lint, tests, and build before calling a change done.
- Keep all data in `localStorage`; keep `ShotEntry` free of PII.

**Ask first**
- Adding any new dependency.
- Changing the data model (`src/types/shot.ts`) or the storage key (`src/storageKeys.ts`).

**Never**
- Add analytics, telemetry, crash reporters, or any third-party SDK.
- Add a network layer (fetch/API calls) without explicit user opt-in surfaced in the app itself.
- Load fonts, scripts, or stylesheets from a CDN — everything ships local or inline.
- Store PII: name, email, location, device identifiers.
