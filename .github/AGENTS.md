# AGENTS.md

This file guides GitHub Copilot agents working on the HRT Shot Tracker. It is read automatically by Copilot CLI and used to provide context for code generation, review, and refactoring.

---

## Project Overview

**HRT Shot Tracker** — A privacy-first, local-only web app for logging testosterone injections and contextual data (pain, mood, notes).

- **Privacy model**: All data stays in the browser's `localStorage`. No backend, no analytics, no PII collection.
- **Tech stack**: React + TypeScript, Vite, Vitest, Testing Library.
- **User focus**: Trans and gender-diverse users. Safety and privacy are non-negotiable.

See `README.md` for the full project context, roadmap, and design philosophy.

---

## Build & Test Commands

```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run dev:host     # Network URL for testing on phone
npm run build        # Type-check + Vite production build
npm run preview      # Preview production build
npm run lint         # ESLint check
npm test             # Vitest in watch mode (interactive)
npm test -- --run    # Run tests once (CI mode)
npm test -- --run [path]  # Run single test file
npm test -- --coverage    # Generate coverage report
```

**Verification guidelines**:
- Always run `npm test -- --run` before proposing or committing changes.
- Always run `npm run build` to catch type errors.
- Do not introduce linting errors: run `npm run lint` if making style changes.

---

## Core Architecture

### Data Model

**`ShotEntry`** (`src/types/shot.ts`) is the only persistent data structure:

```typescript
interface ShotEntry {
  id: string;                    // Generated with crypto.randomUUID()
  date: string;                  // ISO 8601 date (YYYY-MM-DD)
  time?: string;                 // HH:MM format (optional)
  doseMg?: number;               // Dose in mg (optional)
  injectionSite?: string;        // Site name, e.g., "thigh", "abdomen" (optional)
  painScore?: number;            // 0–10 or undefined
  mood?: string;                 // Emoji, mood name, or sentiment (optional)
  notes?: string;                // Free text (optional)
}
```

**Critical constraint**: Empty strings must **never** be stored. Coerce empty form values to `undefined` before storing:
```typescript
doseMg: doseMg ? Number(doseMg) : undefined
```

### Data Flow

```
ShotEntry[]
  ↓ stored in localStorage at key "hrt-shot-tracker:v1:shots"
  ↓
useLocalStorage<ShotEntry[]>  (hooks/useLocalStorage.ts)
  ↓ syncs state ↔ localStorage via useEffect (SSR-safe)
  ↓
useShots  (hooks/useShots.ts)
  ↓ exposes CRUD API: addShot, updateShot, deleteShot
  ↓ all callbacks are memoized with useCallback
  ↓
App.tsx
  ↓ manages editingShot state (add/edit toggle)
  ↓
ShotForm + ShotList  (views)
```

### Key Hooks

- **`useLocalStorage<T>`**: Generic hook syncing React state to `localStorage`. Gracefully handles SSR, JSON parse failures (falls back to initial value with console warning). Prevents hydration mismatches.
- **`useShots`**: Wraps `useLocalStorage` at a stable key. Exports `{ shots, addShot, updateShot, deleteShot }`. All callbacks are memoized.
- **`useApp`** (if it exists): Application-level state management (e.g., editing state, notifications).

---

## TypeScript & Code Style

### Compiler Settings

- **Strict mode enabled**: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`.
- **Target**: ES2022.
- **Module syntax**: `verbatimModuleSyntax` (required for proper ESM imports/exports).

### Naming Conventions

- **Components**: PascalCase (`ShotForm.tsx`, `ShotList.tsx`).
- **Hooks**: camelCase starting with "use" (`useShots`, `useLocalStorage`).
- **Types**: PascalCase (`ShotEntry`, `AppState`).
- **Variables**: camelCase.
- **Constants**: UPPER_SNAKE_CASE (only if truly constant across sessions).
- **IDs**: Generated with `crypto.randomUUID()`, fallback `shot-${Date.now()}`.

### Optional Field Handling

- Empty form values → `undefined` (never empty strings).
- Discriminated unions for optional nested objects (if applicable).
- Always provide sensible defaults in component props.

### Comments & Documentation

- Comment only when logic is non-obvious. Avoid obvious comments.
- Use JSDoc for exported functions, hooks, and types (especially privacy-related code).
- Document any security or privacy decision inline if it is not obvious why a choice was made.

---

## Privacy & Security Rules (Non-Negotiable)

### What NOT to Do

- **Do not** add analytics, telemetry, crash reporters, or any external SDK.
- **Do not** collect or store PII: no names, emails, locations, or device identifiers.
- **Do not** introduce a network layer (API, fetch, axios) without explicit discussion and user consent in the app.
- **Do not** use external fonts, stylesheets, or assets loaded from CDNs—keep all assets local or inline.
- **Do not** use third-party tracking, heatmaps, or user behavior monitoring.
- **Do not** embed AI or LLM services without explicit user opt-in and transparency.

### Privacy-Focused Practices

- Store data only in `localStorage` (or IndexedDB if needed for large datasets).
- Use content-security-policy headers if a server is ever added.
- Clear `localStorage` on tests: `beforeEach(() => localStorage.clear())`.
- Test that exported data does not leak PII or device info.
- Document what data is collected and why in the UI and README.

---

## Testing & Quality

### Test Structure

Tests live in `__tests__/` directories next to source files:
- `src/hooks/__tests__/` — Hook tests (e.g., `useShots.test.ts`)
- `src/components/__tests__/` — Component tests (e.g., `ShotForm.test.tsx`)
- `src/types/__tests__/` — Type validation tests (e.g., `shot.test.ts`)

### Test Conventions

- **File extensions**: `.test.ts` or `.test.tsx`.
- **Discovery**: Vitest auto-discovers `*.test.ts(x)` files.
- **Setup**: Clear `localStorage` in `beforeEach`:
  ```typescript
  beforeEach(() => {
    localStorage.clear();
  });
  ```
- **Hooks**: Use `renderHook` + `act` from `@testing-library/react`.
- **Components**: Use `render` from `@testing-library/react`, avoid implementation details.
- **Assertions**: Use matchers from `@testing-library/jest-dom`.

### Coverage Targets

- Aim for >80% coverage on core hooks and utilities.
- Test happy path, edge cases, and error states.
- Focus on privacy: verify no PII is logged or stored unintentionally.

---

## File Organization

```
src/
├── components/
│   ├── ShotForm.tsx
│   ├── ShotList.tsx
│   ├── ShotEntry.tsx
│   └── __tests__/
│       ├── ShotForm.test.tsx
│       ├── ShotList.test.tsx
│       └── ShotEntry.test.tsx
├── hooks/
│   ├── useShots.ts
│   ├── useLocalStorage.ts
│   ├── useApp.ts (if needed)
│   └── __tests__/
│       ├── useShots.test.ts
│       ├── useLocalStorage.test.ts
│       └── useApp.test.ts
├── types/
│   ├── shot.ts
│   └── __tests__/
│       └── shot.test.ts
├── utils/
│   ├── dateUtils.ts
│   ├── formatters.ts
│   └── __tests__/
│       └── [tests]
├── styles/
│   └── [local CSS or Tailwind config]
├── App.tsx
├── App.test.tsx
└── main.tsx (entry point)
```

---

## Contributing & Collaboration

### Before Opening a PR

1. Run `npm test -- --run` — all tests must pass.
2. Run `npm run build` — no TypeScript errors.
3. Run `npm run lint` — no linting errors.
4. Test on mobile-sized viewports (320px–430px) and desktop (1024px+).
5. Test on a real phone if making UI changes.

### PR Requirements

- Reference `CONTRIBUTING.md`, `CLA.md`, and `CODE_OF_CONDUCT.md`.
- Only approved contributors may open PRs modifying app logic or data flows.
- Include a clear description of what was changed and why.
- Explain any privacy or security implications.

---

## Code Review Checklist for Agents

When reviewing changes, prioritize:

1. **Privacy**: No PII, no external SDKs, no analytics.
2. **Correctness**: Tests pass, types are strict, no unused variables.
3. **Performance**: No unnecessary re-renders, efficient localStorage access, sensible memoization.
4. **Accessibility**: ARIA labels, keyboard navigation, screen reader support.
5. **Mobile-first design**: Layout works on 320px; enhance for desktop.
6. **Documentation**: Changes to public APIs are documented; non-obvious logic has comments.

---

## Known Limitations & Assumptions

- **No backend**: All data is local to the browser. Sync/export is future work.
- **No routing**: Single-page view (no React Router). If multiple pages are needed, design carefully to keep privacy surface small.
- **localStorage only**: No IndexedDB or service worker yet (PWA support is future work).
- **No animations by default**: Keep animations minimal and optional.
- **Mobile-first UI**: Desktop is secondary; test real phones early.

---

## Useful Links

- **GitHub Copilot CLI docs**: https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli
- **React Testing Library**: https://testing-library.com/react
- **Vitest docs**: https://vitest.dev/
- **TypeScript strict mode**: https://www.typescriptlang.org/tsconfig#strict

---

## Questions or Issues?

If you are an agent working on this repo and need clarification:

- Check `README.md` for the full project philosophy and roadmap.
- Review `CONTRIBUTING.md` and `LICENSE` for collaboration constraints.
- Ask the human contributor for context if instructions are unclear.
- Err on the side of privacy: assume "no external network" unless explicitly told otherwise.

---

**Last updated**: 2026-07-12  
**Version**: 1.0  
**Scope**: HRT Shot Tracker MVP (local-only, no analytics, privacy-first)
