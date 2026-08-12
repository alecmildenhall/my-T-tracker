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
- **Ask the real question, not a cheaper one that resembles it.** When you need to know whether something will work, **do it and check the result** — never run a proxy and infer. It has cost two defect *classes* so far — the second recurring three times across four review rounds — and every time the proxy differed from the real thing in a dimension nobody had thought about:
  - A **one-byte probe write to a throwaway key** was used to predict whether saving a shot would succeed. Quota depends on the *size of the value*, so the probe sailed through while the shot was rejected — the sheet closed, the draft cleared, and the app reported success for data it had not stored.
  - The Modal's Tab trap decided **"focus is on the last control"** by comparing against the last element of a `querySelectorAll` list, which matched disabled buttons that cannot hold focus. Wrong in both directions, on separate occasions, each letting focus leave the page.

  The shape that works is always the same: **perform, then verify.** `handOffFocus` (`src/utils/focus.ts`) does not enumerate the reasons an element might refuse focus — disabled, hidden, disconnected, no tabindex, inert ancestor — it calls `focus()` and then checks `document.activeElement`. `useLocalStorage`'s `persist` does the real write and returns whether it landed. Both have survived every review round unchanged, while the predicting code around them has been rewritten repeatedly.

  Where the real operation genuinely cannot be performed first, **say so in a comment, bound what is left over explicitly, and prefer the check that fails safe** — and treat any list of "reasons X can't happen" as a smell, because the list is never complete.
- `ShotEntry` (`src/types/shot.ts`) optional fields must never be stored as empty strings — coerce empty form values to `undefined` before storing.
- **Optional numbers are checked with `typeof x === "number"`, never truthiness** — `0` is a valid `painScore` (and a valid days-late), so `x && …` silently drops it. See `ShotListItem.tsx`.
- **Focus is never left on `<body>`.** Any control that removes itself, or removes the element that had focus, must hand focus somewhere sensible first (WAI-ARIA APG). Nine defects in slice B came from this, several introduced by the previous fix. **Use `handOffFocus(...candidates)` (`src/utils/focus.ts`) — never a bare `.focus()`.** It skips `<body>` and anything that can't take focus, and *verifies* the result, because `focus()` fails silently. Guard new flows with `withFocusGuard` / `expectFocusSomewhereUseful` (`src/test/focus.ts`); jsdom sees neither `inert` nor CSS, so trap-escape and ring-visibility stay Playwright checks.
- **A new `Profile` field must be added to `pickProfileFields`** (`src/utils/backupDto.ts`) or it silently will not survive export and restore — the DTO is an allowlist, and `replaceProfile` swaps the whole profile on import, so the value reverts to its default on the user's own backup. Slice B½'s opt-in "Bleeding" toggle is the next field this will apply to, and it is the one where a silent revert would matter most.
- IDs: use `newId()` (`src/utils/id.ts`) — `crypto.randomUUID()` with a timestamp-plus-random fallback for non-secure contexts.
- `verbatimModuleSyntax` is on — use `import type` for type-only imports.

# Testing
- Tests live in `__tests__/` next to the code they cover (`*.test.ts(x)`).
- `beforeEach(() => localStorage.clear())` in every test file that touches storage.
- **Focus restoration is asynchronous relative to the DOM.** `Modal` restores focus from a *passive* effect cleanup, which runs after React has removed the dialog — so there is a real window where the element that held focus is gone and nothing has claimed it. Waiting for the dialog to disappear does **not** mean focus has landed. After anything that unmounts a dialog, use `await expectFocusSettled(...)` (`src/test/focus.ts`), never the synchronous `expectFocusSomewhereUseful`. Getting this wrong makes the suite red about one run in fifteen, on a different test each time, which reads as an unrelated flake.
- **A test that fails intermittently is a finding, not noise.** Measure it — a handful of green runs cannot clear a 5–10% failure rate, and "I couldn't reproduce it" has twice been wrong here. Loop the full suite 15+ times, and compare against `main` in a worktree before assuming the branch caused it.

# Privacy (non-negotiable)
- No network layer (fetch/API calls), analytics, telemetry, or third-party SDKs — everything stays in `localStorage`. Stop and confirm with the user before adding any of these.
- No CDN-loaded fonts/scripts/styles — local or inline only.
- `ShotEntry` must stay free of PII (name, email, location, device ID).
