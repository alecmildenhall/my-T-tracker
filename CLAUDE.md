See @README.md for product context, privacy model, and roadmap.

# Commands
- `npm run dev` / `npm run dev:host` (LAN, for phone testing)
- `npm run build` — typecheck (`tsc -b`) + Vite build
- `npm run lint`
- `npm test -- --run` — run the suite once (use this, not watch mode, to verify a change)
- `npm test -- --run <path>` — single test file
- `npm test -- --coverage`

Run `npm test -- --run` and `npm run build` before considering a change done.

# Project status: pre-GA (standing instruction)
The app has no users. **Breaking changes are fine, and neither version number is
ever bumped** — until the user says the project is no longer pre-GA.
- `FORMAT_VERSION` (`src/appMeta.ts`) stays `1`; `STORAGE_SCHEMA_VERSION` (`src/storageKeys.ts`) stays `1`; `package.json` stays `0.0.0`.
- A breaking model change therefore needs **no** migrate-on-read and **no** version bump. Old local data may be dropped or read leniently. Don't raise migration as a blocker, and don't bump a version unprompted.

# Code style
- **One value, one meaning.** Never overload a value to carry a second meaning (a sentinel). This is the single most expensive bug class in this codebase: `ShotDraft.date` used `""` for both "untouched, follow today" and "the user emptied the field", and twice silently re-dated a logged shot — once by a day, once by months. Give the second meaning its own carrier (`T | null`, or a separate flag). Applies to **every** layer, not just stored models — the draft/form layer is where it broke.
- `ShotEntry` (`src/types/shot.ts`) optional fields must never be stored as empty strings — coerce empty form values to `undefined` before storing.
- **Optional numbers are checked with `typeof x === "number"`, never truthiness** — `0` is a valid `painScore` (and a valid days-late), so `x && …` silently drops it. See `ShotListItem.tsx`.
- **Focus is never left on `<body>`.** Any control that removes itself, or removes the element that had focus, must hand focus somewhere sensible first (WAI-ARIA APG). Nine defects in slice B came from this, several introduced by the previous fix. Prefer extending the existing hand-off rather than adding a new bespoke `.focus()` site.
- IDs: use `newId()` (`src/utils/id.ts`) — `crypto.randomUUID()` with a timestamp-plus-random fallback for non-secure contexts.
- `verbatimModuleSyntax` is on — use `import type` for type-only imports.

# Testing
- Tests live in `__tests__/` next to the code they cover (`*.test.ts(x)`).
- `beforeEach(() => localStorage.clear())` in every test file that touches storage.

# Privacy (non-negotiable)
- No network layer (fetch/API calls), analytics, telemetry, or third-party SDKs — everything stays in `localStorage`. Stop and confirm with the user before adding any of these.
- No CDN-loaded fonts/scripts/styles — local or inline only.
- `ShotEntry` must stay free of PII (name, email, location, device ID).
