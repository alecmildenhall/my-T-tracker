# T-Shot Tracker

A privacy-focused web app for logging testosterone (HRT) injections and how they *feel* — pain, mood, and notes — designed with trans and gender-diverse users’ safety in mind.

> **Status:** Early MVP. UI and functionality are limited and will evolve over time.

---

## Purpose

- Track when you take your testosterone shots.
- Capture context around each shot: pain, mood, notes.
- Over time, support visualizations (StoryGraph-style) to help you see patterns and talk with your healthcare providers.
- **Acknowledge each shot as something you did for yourself**, not as a box ticked.

This project is explicitly designed around **trans user safety and privacy**.

### A shot is not a chore

This is the design premise the rest of the tone follows from, so it belongs here rather than buried in the roadmap.

General health apps treat logging as recording something that happened *to* you — a period, a blood-pressure reading — so they say nothing when you save. Medication apps treat it as compliance, so they stay neutral. Habit apps treat it as something you'd skip without a nudge, so they manufacture rewards: coins, streaks, characters.

**None of those is what this is.** Taking T is something you decided, and keep deciding, often in a world that says you shouldn't have. Logging it is worth a moment of warmth — not to make you log more, but because *the thing itself is worth acknowledging* and very little else in a person's day says so.

That gives the app one line, used every time a shot is saved:

> **Logged for you.**

Deliberately the same words every time. Rotating copy is what you do when a phrase is trying to entertain; a constant one becomes the app's voice and reads as sincere rather than performed. It sits in the greeting slot — the app's existing warm register, alongside "Hi, Lou~" and "Happy shot day" — for a few seconds, while the new entry arrives beneath it and its highlight fades back to normal.

Rules it follows, all of which rule out most copy that sounds appealing at first:

- **It has to work on a bad day.** Some shots hurt; some land when you feel dysphoric rather than affirmed. Nothing may assume you feel good, and nothing may exclaim.
- **It affirms the act, never the schedule.** No streaks, no "on track", no implication you were late. Shots shift and skip and that is normal — the milestone system already tracks *time on T*, not shot count, for the same reason.
- **Understated reads as sincere.** Trans people get plenty of performative affirmation. "Great job staying on track!", "5 weeks in a row!", and "You must be feeling great 💪" are each rejected by one of the rules above.
- **Name-optional, like everything else.** It never depends on having set a preferred name.
- **No off switch, deliberately.** The obvious instinct is to make it optional, and the earlier draft of this section said so. Run it through the test the bleeding category uses and the answer flips: that one is opt-in because the harm is asymmetric — wrongly *showing* it risks dysphoria and cannot be undone, wrongly *hiding* it costs one toggle. Here the asymmetry runs the other way. Wrongly showing "Logged for you." costs mild irritation someone can tell us about; wrongly hiding it costs the whole feature. That argues for on by default, which it is, and not for a switch.

  The line is also just not aggressive enough to need an escape hatch: one sentence and a colour that fades, no interruption, nothing to dismiss. And a setting labelled something like *"Acknowledge when I log a shot"* invites a question most people would never otherwise ask — deciding how you would like to be treated emotionally is strange furniture for a Settings screen.

  `prefers-reduced-motion` still applies and is **not** part of this decision: that is a WCAG obligation, not a preference, and it removes the movement while keeping the words.

  **What would bring a switch back is discretion, not sentiment.** A green flash and a warm sentence are more legible over a shoulder than a column of dates — the same threat model as disguise mode and the app lock. If it returns it belongs with those, framed as visibility, not as opting out of encouragement. Cheap to add whenever: the default is already on, so a switch added later changes nothing for anyone who never touches it.

It does not compete with the milestone messages; it feeds them. A quiet line each week and a real moment at "Congrats on 1 year on T" are different registers, and having the small one is what lets the big one land.

---

## Tech Stack (MVP)

- React + TypeScript  
- Vite (bundler & dev server)  
- Browser `localStorage` for local-only persistence  
- No backend, no analytics, no third-party tracking

Future phases may add:

- PWA support  
- Charts (e.g., Recharts)  
- Anonymous encrypted backend  
- Secure sync using user-held keys

---

## Privacy & Safety

This project follows strict privacy requirements:

- **No PII collected by default.**  
  No name, email, account, or location.

- **Local-only storage (current phase).**  
  All data stays in the browser’s `localStorage`.  
  There is **no server** and no network sync.

- **No analytics or telemetry.**  
  No Google Analytics, crash reporters, or tracking SDKs.

- **Safety-first for trans users.**  
  Features are designed to avoid exposing sensitive health data.

- **A narrow scope is itself a privacy property.**  
  The app tracks shots in detail — date, time, dose, site, position, ester, carrier oil, how it felt — rather than trying to manage a whole transition. It cannot leak what it never collected, and some of the things a broader tool would want are far more sensitive than a list of dates: body photos, a location-derived provider directory, anything tied to an identity. Declining those is the same decision as the PII rule above, applied to the product rather than the schema — so "we don't do that" is a deliberate answer, not a gap waiting to be filled.

### Future Storage Choices

The long-term product goal is to give users a clear, friendly choice about where their data lives. Privacy should be visible in the app experience, not hidden in policy text.

Planned storage modes:

- **Local only**  
  The default mode. Entries stay on the current device and nothing is uploaded. The tradeoff is that deleting the app, clearing browser data, or losing the device may delete entries unless the user exports a backup — and, on iOS Safari, so can *simply not opening the app for a week*, because the browser evicts an uninstalled site's storage on its own. Local-only is a promise about privacy, never about permanence; see **Data Durability** in the roadmap. Say so plainly in the product rather than implying the data is safe just because it never left the phone.

- **Manual backup**  
  The user can export and later restore their data, ideally as an encrypted backup file. The user chooses where to save it, such as device files, iCloud Drive, Google Drive, external storage, or another private location.

- **Optional encrypted sync**  
  A future opt-in mode for recovery and cross-device use. Entries would be encrypted on the user's device before upload. The server would store only encrypted data and would not receive the key needed to read it.

Important product language:

- Do not claim "none of your data goes anywhere" if encrypted sync is enabled.
- Be precise: "Local only" means nothing is uploaded.
- Be precise: "Encrypted sync" means encrypted data leaves the device, but readable health data does not.
- Make the tradeoffs understandable before the user chooses a mode.
- Make it easy to export data, disable sync, and delete any remote encrypted backup.

See:

- `LICENSE`  
- `.github/CLA.md`  
- `.github/CONTRIBUTING.md`  
- `.github/CODE_OF_CONDUCT.md`  

for legal and ethical collaboration constraints.

---

## Development Setup

```bash
npm install
npm run dev
```

Then open the dev URL shown in the terminal (usually `http://localhost:5173`).

### Testing On A Phone

The product is phone-first, even though development happens on desktop. For day-to-day UI work:

1. Start with desktop browser dev tools in mobile mode.
2. Test real phone-sized widths early, especially `320px`, `375px`, `390px`, `414px`, and `430px`.
3. Test on an actual phone before considering mobile UI work done.

To open the local dev app on a phone:

```bash
npm run dev:host
```

Vite should print a network URL such as:

```text
http://192.168.x.x:5173
```

Open that URL on a phone connected to the same Wi-Fi network as the development computer. If it does not load, check that both devices are on the same network and that the computer firewall is not blocking the dev server.

Mobile development notes:

- Build the phone layout first, then enhance for larger screens.
- Use one-column layouts by default.
- Keep tap targets large and comfortable.
- Avoid hover-only interactions.
- Prefer native date, time, number, and select inputs where they make logging faster.
- Make the primary action easy to reach.
- Use desktop width mainly for charts, review, export, and printable summaries.

To create a production build:

```bash
npm run build
npm run preview
```

---

## Testing

The project uses [Vitest](https://vitest.dev/) for unit testing with React Testing Library.

### Running Tests

```bash
# Run tests in watch mode (interactive)
npm test

# Run tests once (CI mode)
npm test -- --run
```

### Test Structure

Tests are located next to the code they test in `__tests__` directories:

- `src/hooks/__tests__/` - Hook tests (e.g., `useLocalStorage.test.ts`)
- `src/types/__tests__/` - Type validation tests (e.g., `shot.test.ts`)

### Writing Tests

Test files use the `.test.ts` or `.test.tsx` extension and are automatically discovered by Vitest. The test environment is configured with:

- **jsdom** for DOM simulation
- **@testing-library/react** for component testing
- **@testing-library/jest-dom** for enhanced matchers

### Test Coverage

```bash
npm test -- --coverage
```

Generates a `coverage/` directory with an interactive HTML report. The directory is gitignored and regenerated on each run.

To view the report, open `coverage/index.html` in your browser (alternatively use Live Server in VS Code) or navigate to http://localhost:5500/coverage/index.html. Your port may differ.

---

## Current Features (MVP)

- Log a shot with:
  - Date  
  - Time (optional)  
  - Dose (optional)  
  - Injection site (optional)  
  - Injection position, such as left/right (optional)  
  - Type of testosterone / ester (optional)  
  - Carrier oil (optional)  
  - Pain score (optional)  
  - Mood (optional)  
  - Notes (optional)  

- View a list of past entries (sorted newest-first)
- Edit existing entries
- Delete entries
- Reuse values from past entries (injection site, position, testosterone type, carrier oil) with one tap
- All data is stored locally on your device

---

# Next Steps / Upcoming Features

The T-Shot Tracker is currently in an early MVP state. The roadmap below outlines the planned evolution of the project, designed to uphold trans-focused privacy, local-first data ownership, and long-term maintainability.

---

## High-Level Roadmap

### Recommended Product Path

The product should be designed for phone use first. Desktop/browser support is mainly for development, testing, and users who prefer it, not the primary long-term experience.

The preferred path is to keep one React app as the core product and avoid building separate native versions until they solve a real distribution or retention problem.

1. **Mobile-friendly web MVP, local-first**  
   Keep the current browser app simple and useful, but design and test the interface primarily for phones. Focus on trustworthy logging, editing, export, import, accessibility, and privacy language.

2. **PWA**  
   Make the same app installable and offline-friendly on phones. This gives an app-like mobile experience without maintaining separate native code. It is the best next step before app stores.

3. **Capacitor mobile wrapper, only when needed**  
   Use Capacitor later if App Store / Google Play distribution, native reminders, or more reliable device storage become important enough to justify the added maintenance. Avoid a separate desktop app unless a specific desktop-only need appears.

   **A native app does genuinely fix durability.** App-sandbox storage is not subject to browser eviction — no ITP, no 7-day timer — so it survives until the user deletes the app. Capacitor gets there by wrapping this same React app rather than forking a second codebase, so it is packaging work, not a rewrite.

   **But store distribution carries a privacy cost a PWA does not.** An App Store / Play install is tied to the user's Apple or Google account: visible in purchase history, in family sharing, and restorable across their devices. For an app that already plans disguise mode and an app lock, "there is a permanent record on my Apple ID that I installed a testosterone tracker" is a real exposure — and a home-screen PWA creates no such trail. Durability and leaving-no-trace pull in opposite directions here; neither option wins outright, and the choice should be made deliberately rather than by drift.

   Other costs worth knowing before committing: Apple Developer is **$99/year ongoing** even for a free app (Google Play is $25 once); review adds release latency and health apps draw extra scrutiny; and **disguise mode is only partly achievable on iOS** — alternate app *icons* are supported, renaming the app is not, so that feature is weaker on an App Store build than the concept suggests.

   **What should actually trigger the move:** not durability, which an installed PWA plus `navigator.storage.persist()` plus easy backup export largely covers at zero cost. The real reasons are **reliable local notifications** (the "shot due soon" reminder is unreliable as a PWA, especially on iOS), **biometric app lock**, and **discoverability** for people who look for apps in a store rather than a browser. If none of those are pressing, the wrapper is maintenance without payoff.

4. **Ship both, from one repo.**  
   The PWA and the store apps are two distributions of the *same* app, not two products — offer both and let people pick the trade-off that suits them: the store build is more durable and gets real notifications, the PWA leaves no account trail. Neither is the "real" version.

   **One repository, one React source.** Capacitor adds `ios/` and `android/` folders alongside the existing app and wraps the same web build; it does not fork the codebase. Two repos (or a duplicated `web/` and `native/` tree) would be a mistake — every fix would need doing twice and the two would drift, which is exactly the failure mode this project avoids elsewhere by keeping one source of truth.

   What legitimately differs between targets is narrow and belongs behind the seams that already exist: **storage** (localStorage vs a native store), **notifications** (Web Notifications vs a native scheduler), and **biometrics** (nothing vs a native API). Each is a small adapter chosen at runtime, not a parallel implementation. The selector layer added in slice A is the same idea and the same seam.

   Practical notes for whoever picks this up: keep one version number across both, since a user comparing them will assume they match; the store build still needs the PWA's install/export flows because people move between them; and test the *web* build first, since it is the one that can ship the same day.

### UI Timing And Responsiveness

The major UI overhaul should happen after the core logging data model is stable, but before PWA/app-store work. The goal is to avoid polishing screens that may change, while still making the app feel trustworthy before it reaches real users.

Practically, this means doing the overhaul after the important data features are in place: testosterone type / carrier oil, optional T start date, optional display name, basic milestones, and export/import.

The interface should be designed mobile-first and tested across common phone sizes from the beginning. Desktop web can remain available as a secondary experience, especially for larger charts, data review, exports, and printable doctor-facing summaries.

Sync between phone and desktop should not be assumed in the MVP. Cross-device use should wait for the optional encrypted sync work, because otherwise the app may imply a recovery promise it cannot keep.

### Design Direction

The UI needs a major overhaul before this feels like the real product. The visual direction should be warm, local, friendly, plain to read, and a little homemade without feeling messy. It should not feel corporate, clinical, venture-backed, or generic wellness-app polished.

Useful reference vibe: StoryGraph-style calmness and personality. Prioritize clear reading, soft structure, gentle color, approachable language, and phone ergonomics.

### Milestones And Encouragement

The app should support HRT-specific milestones, not just generic medication tracking. This is part of what can make the product feel meaningfully different from ordinary tracker apps.

Milestone ideas:

- Let users optionally enter their testosterone start date, including if they started before installing the app.
- Let users optionally enter a name or preferred form of address for milestone messages.
- Track time on T as the primary milestone basis, not shot count, because skipped or shifted shots are normal.
- Still show useful logged-shot stats separately, such as total logged shots, recent consistency, or last logged shot.
- Use three-month milestones during the first year on T.
- After one year, use six-month milestones.
- Show milestone congratulations for a short window, such as two weeks after the milestone date, instead of only on the exact day.
- Keep the tone celebratory and gentle, with optional feel-good animation after logging a shot.
- Consider optional sound only when appropriate and allowed by the device.

Example tone:

> Congrats on 1 year on T, Lou.

Milestones should be configurable eventually, but the first version should avoid making users answer too many setup questions. Good defaults matter.

### Pre-GA: breaking changes are free (standing rule)

**The app has no users, so nothing needs protecting and no version is ever bumped** — until this section says otherwise.

- `FORMAT_VERSION` stays `1`, `STORAGE_SCHEMA_VERSION` stays `1`, `package.json` stays `0.0.0`.
- A breaking model change — slice B½ turning free-text mood into an ordinal and the 0–10 pain number into an enum is exactly one — needs **no** migrate-on-read and **no** bump. Old local data may be dropped, or read leniently and ignored.
- This is the rule the B½ decisions below defer to. It is deliberately a *standing* rule and not a per-decision judgement, because it kept being re-litigated one field at a time and the answers drifted apart.

Worth knowing what this rule is suspending, since it stops being free the day someone else installs the app. There are **two independent version numbers**, and it is easy to think there is one:

- `FORMAT_VERSION` (`src/appMeta.ts`) — the **backup file** envelope. Guards import of a file from another install or an older build.
- `STORAGE_SCHEMA_VERSION` (`src/storageKeys.ts`) — the **localStorage key namespace**. Bumping it repoints every key to a fresh, empty store, so post-GA a bump must ship with a migrate-on-read or every user's history is orphaned — and with no server copy, orphaned means gone.

`sanitizeShots` is deliberately lenient (it requires only a non-blank `id` and `date` and passes unknown fields through) so that *additive* change never discards data. That leniency does not cover a breaking **type** change: an old `mood: "good day"` would flow into a field the compiler believes is an ordinal. Free to ignore now; a real migration once there are users. Industry practice is to version the stored schema and treat migration as a product capability rather than a side task ([DB migration guide](https://www.rapidnative.com/blogs/what-is-db-migration)).

### Short-Term (MVP → v0.2)

- [x] **Surface storage write failures.** `useLocalStorage` catches a failed `setItem` and drops it into `console.warn`, so the in-memory state updates, the UI shows the shot saved, and nothing persists. This is not hypothetical: Safari private browsing throws on `setItem`, and a full device hits quota. With no server copy the entry is simply gone, and the only report of it went to a console the user will never open — the exact silent-failure class that every severe bug in slice B turned out to be. The platform guidance says the same thing ([web.dev](https://web.dev/articles/persistent-storage)): wrap storage writes and handle the failure.

  Its own small PR rather than riding along with feature work, and worth doing **before** slice B½ starts adding fields, since every new field is another thing that can silently fail to save. Phase-proof too: `useLocalStorage` is the single write boundary, so this survives the PWA, the Capacitor swap to native storage, and encrypted sync — only the call behind it changes.

  Decided from a prototype, then corrected by building it:

  - **A persistent banner**, below the header, as the single surface for every failed write. Writes fail from at least four places — logging, editing, deleting, Settings — and an in-sheet message would leave three of them silent.
  - **Dismissible, and it re-raises on every new failure.** A device that is genuinely full will never succeed on retry, and a banner that cannot be dismissed leaves the app permanently degraded with no way to say "I know". Acknowledging one failure must not silence the next.
  - **It clears only on a real success** — never on a timer.
  - **No count**, despite the prototype specifying one. Writes fire per store and on mount, so a single failed save reported *five*; and they are not five losses, since the in-memory state holds everything and a run of failures is one unsaved state. “Your changes aren’t being saved” is the fact we actually have.
  - **The sheet does not close when a save fails.** It closes on save today, so a failed write loses the typed entry as well as saying nothing. Holding it open leaves the data on screen and one tap from saved, which matters more than any wording.
  - **"Export a backup" sits beside "Try again."** A failing device is exactly when a copy off it is worth most, and export is the only recovery that survives eviction, quota and a cleared browser.
  - **Not a snackbar** — transient, and Material is explicit that snackbars are not for critical or persistent errors; timing out is precisely wrong when nothing else recorded the failure. **Not a dialog** — nothing here is a decision, retry is the only move, and a repeating failure becomes a modal you cannot escape mid-log.

- [x] _Engineering:_ **stop overloading `""` in `ShotDraft.date`** — _done, but not the way this item proposed._ The draft used `""` for both "untouched, follow today" and "the user cleared the field", written in one place and read in another, with only a hand-kept mode check holding the two readers in step. Twice they fell out of step and silently re-dated a logged shot: once by a day, and then — after a first fix closed only the write side — by **months**, moving a shot logged in May to today.

  This item proposed giving "follow today" its own carrier (`CivilDate | null`, or a `followToday` flag). That was built, and then **deleted**, because the better question turned out to be whether follow-today should exist at all. It shouldn't: a draft only exists once something has been typed, so every draft is deliberate work about a particular shot — and you log a shot *after* taking it, so an entry started yesterday is about yesterday. Re-deriving slid today's date under anyone finishing an interrupted entry, and today looks plausible enough that nothing catches the eye.

  **The date is now frozen like every other field**, and `ShotDraft.date` is a plain `string` with one meaning. Deleting the behaviour removed the bug class outright rather than carrying a carrier to manage it — worth remembering as a pattern: the cheapest fix for an ambiguous encoding is sometimes to stop needing the encoding.

  Freezing exposed a second question that took **six review rounds** to answer: **"has the user entered a date?"** Every other field answers it with "is it empty?", but a date is required and always populated, so it has no such tell.

  Every attempt to *derive* the answer failed, each in its own way, and each fix caused the next bug. Compared against today's default: a draft carried past midnight can never match again, so an emptied draft stays dirty forever. Against the restored draft's own date: a draft whose only content *is* a backdate reads as clean, and the next dismissal discards it. As a boolean "was it touched": nudging the date and putting it back leaves the form dirty forever. As a boolean measured against today: correcting a mis-dated shot **to** today reads as no change, and dismissal throws the correction away.

  What finally worked was storing the **reference** rather than an answer derived from it. `ShotDraft.dateBaseline` holds the value the field would still show untouched — today for a fresh form, the shot's own date when editing, today again after "Clear form" — and the date counts as input exactly when it differs. One reference, travelling with the draft, that nothing else can disagree with.

  **The lesson is the one worth carrying into B½,** which adds cadence and frozen lateness — more fields whose meaning depends on when they were computed: a boolean is an answer computed against a baseline at one moment and read against another later; if either can move, they will eventually disagree. Store the baseline, not the conclusion.

  Two limits are accepted rather than fixed, both needing a sheet held open across midnight, neither able to write a wrong date to a saved shot: re-picking the date already displayed reads as no change, and a draft whose chosen date has since become today still reports unsaved input (its "Clear form" link is suppressed so it cannot invite a pointless tap). Fixing either reintroduces one of the bugs above — verified, not assumed.

- [x] _Engineering:_ **one owner for focus hand-off, plus a test guard.** Focus was moved by hand at eight sites — `Modal`'s open/restore/fallback and its Tab trap, `HistoryView`'s `focusRowAt` and Clear-all, `App`'s title fallback and skip link, `ShotForm`'s reset, `ManageValues`' mode switch, `StorageBanner`'s dismiss — and that seam produced **nine** defects in slice B: focus dropped to `<body>` from three different controls, the hand-offs were invisible (no CSS rule covered programmatically focused elements), the trap was escapable by clicking the dialog's padding, and the skip link's URL fragment poisoned focus restoration for the entire session.

  The pattern worth recording: **several were introduced by the previous round's fix.** Each fix added another hand-rolled site, and every new site could collide with the shared machinery — the Tab trap, `inert`, the restore order.

  **`handOffFocus(...candidates)` (`src/utils/focus.ts`) is now the only way focus moves.** Callers pass candidates most-specific first and inherit all three rules the sites kept re-deriving and getting differently wrong: `<body>` is never an answer (it is *connected*, so an `isConnected` check waves it through — and it is the common case, since Safari doesn't focus a `<button>` on tap); `focus()` fails silently on a disconnected, hidden, disabled or untabbable element, so the result is **verified** rather than assumed; and there is always more than one candidate, so the fallback chain is the argument list.

  **The guard is `expectFocusSomewhereUseful` / `withFocusGuard` (`src/test/focus.ts`)**, applied across flows rather than case by case. `withFocusGuard` passes when focus was *already* nowhere before the interaction — jsdom's `fireEvent.click` doesn't focus what it clicks (nor does Safari), so the distinction between "this interaction stranded focus" and "focus was never held" is the difference between a real signal and a vacuous one.

  Two things this cannot see, both verified in a browser instead: jsdom implements neither `inert` nor CSS, so **the escapable trap and the invisible ring stay Playwright checks**. That mattered — the browser pass found the trap escape *live on desktop*, still present: clicking the sheet's dead padding drops focus to `<body>`, and the trap was the dialog's own `onKeyDown`, which only fires for keys pressed while focus is already inside. **The trap now lives on the window listener that already owned Escape**, which is what focus-trap, Radix and Reach UI all do and for exactly this reason. Wrapping also walks inward from the far end, because `FOCUSABLE` matches a *disabled* button and wrapping onto one made Tab a dead key.

- [x] _Engineering:_ **the Modal's Tab trap wants its own owner** — _done: `useFocusTrap` (`src/hooks/useFocusTrap.ts`) owns Tab and Escape, `tabbablesIn` (`src/utils/tabbing.ts`) wraps `tabbable`._ The focus-hand-off PR consolidated eight `.focus()` sites into `handOffFocus`, and in doing so rewrote the trap twice — each rewrite fixing the previous one's escape and introducing the next defect. Four review rounds on that one file: the wrap target ignored disabled controls; then edge detection ignored them too; then owning every Tab conflated "inside on a `tabIndex={-1}` element" with "outside the dialog"; then owning every Tab cancelled `input[type=date]`'s own segment stepping. Every one was invisible to jsdom and found either in a browser or by review.

  **What is left, knowingly.** `FOCUSABLE` now excludes `[disabled]`, and excludes `tabindex="-1"` from *every* clause rather than only the last — that guard was written as one string, so it bound to `[tabindex]` alone and a `tabindex="-1"` button sailed through `button:not([disabled])`. Between them that removes the reachable half of this — a disabled control no longer sits in the list making every index-based question about it wrong. What remains is that the list still cannot express `display: none`, `visibility: hidden`, or a collapsed `<details>`, and the segmented-input escape hatch reasons about **list indices**:
    - A date/time input followed only by a control that is unfocusable in a way no selector can express — `display: none`, `visibility: hidden`, or a descendant of a `<fieldset disabled>`, which carries no `disabled` attribute of its own — would still let Tab leave the page. **B½ adds grouped fields to this sheet, and a disabled fieldset is exactly how one would be grouped**, so this is the residual most likely to stop being theoretical.
    - A segmented input at either **end** of the list loses in-field stepping in that direction — unfixable this way, since nothing in the DOM says which segment you are on. Safe now only because `.shot-form__close` happens to render before the date input, so the sheet's date sits at index ≥ 1.

  **B½ adds fields to that sheet**, which is what turns "not reachable" into "not reachable yet".

  **The fix, stated carefully — an earlier draft of this item got it wrong.** It said to stop predicting and observe instead: let the default run and correct focus on `focusout`. That is half right and would ship a worse bug. With `#root` inert there is nothing after the last dialog control, so Tab moves focus to **browser chrome**, and clawing it back from there is jarring where it works at all. Production traps (focus-trap, Radix) do **both**: they predict with a *real* tabbability check — the `tabbable` library tests disabled, `display: none`, `visibility`, collapsed `<details>`, and more — and keep a `focusin` listener as a net for whatever the prediction missed. So the lesson is not "never predict"; it is **never predict from a proxy that is cheaper than the question** (see the rule in CLAUDE.md). A real tabbability check is the question, asked properly.

  Either write that check, or take the dependency. Either way it is a rewrite with its own browser pass, not a patch.

  **Took `tabbable`** — what focus-trap and Radix both use, no dependencies of its own, `npm audit --omit=dev` still zero, +2.2 kB gzip. Writing the check ourselves meant reimplementing a known-hard thing and owning it forever, and the failure mode of doing so is a case nobody thought of, which is how this got rewritten four times.

  **Two things the browser pass measured that no amount of reading would have found**, both of which would otherwise have shipped as silent test/production divergence:

  - **jsdom implements no layout**, so `tabbable`'s default `displayCheck` reports every element hidden and a dialog reads as empty. Resolved by probing whether the environment reports layout at all, rather than sniffing `MODE === "test"` — the env is a *proxy* for the capability, and the capability is what is actually depended on. The cost is that `display: none` / `visibility: hidden` are enforced in browsers only, which is the same standing limit already recorded for `inert` and CSS. It costs nothing on the case that gated B½: disabled fieldsets, closed `<details>`, radio groups and `inert` are evaluated **independently of `displayCheck`**, so they are covered by unit tests.
  - **`tabbable`'s returned order is not document order under jsdom.** Every clause of its selector carries a complex `:not([inert] *)`, which jsdom's engine cannot match in one pass — it goes clause by clause and concatenates, so results come back grouped by *selector*. Measured: `input,a[href],button` returns "abc" while the same list with the `:not()` returns "bca". The trap's whole job is rotating through that order, so `tabbablesIn` sorts by real document position — a no-op in a browser, and the repair that stops the unit tests exercising an order production never sees.

  **The residual this item was written about is closed, and that was proved rather than reasoned.** With a `display: none` control as the only thing after the date input, the real build keeps Tab inside the sheet; the same build with `displayCheck: "none"` lets focus escape to `<body>` on the fourth Tab.

  **Stacking is now fixed for modality too** — done, and it is what unblocked step 6. The registry moved out of `useFocusTrap` into `src/utils/dialogStack.ts` and grew the rest of the question: `inert` on `#root`, `inert` on the dialog underneath, and the `--sheet-h` viewport track are **derived** from the list of open dialogs by one `syncModality()`, recomputed whenever anything joins or leaves, rather than applied and unapplied in per-instance pairs.

  **Not a refcount in `Modal`**, which is the fix that suggests itself. A count kept there would be a second answer to "how many dialogs are open", free to disagree with the list that already knows — the overloaded-value failure this codebase has paid for twice, rebuilt one level up. Deriving has no running total to fall out of step.

  **An earlier draft of this section said the body scroll lock "was fine by accident" and safe to leave per-instance.** It was not, and a review caught it. Capturing and restoring the *previous* value looks like the composable shape — each instance puts back exactly what it found — and it holds only while dialogs close one at a time. The outer captured `""` and the inner captured `"hidden"`; **React runs an unmounting parent's cleanup BEFORE its child's**, so `""` went back first and `"hidden"` second, leaving the body scroll-locked with no dialog open. Every later dialog then captured `"hidden"` and restored `"hidden"`, so the page never scrolled again for the rest of the session. It is derived from the stack now, like the rest.

  **That cleanup order is the thing worth carrying forward**, because it is the opposite of the rule everyone remembers. On MOUNT a child's effects run before its parent's — which is why dialog registration is a layout effect, recorded above. On UNMOUNT it inverts: the parent's cleanup runs first. Measured, after a comment in `useBackToClose.ts` asserted the opposite and two defects were built on it. **Any per-instance capture/restore pair in a component that can nest is suspect for this reason**, and the fix is always the same — derive the state from one owner instead of accumulating promises to undo.

  The four defects, each measured on the old build with a real confirm wired into the log sheet, then measured again on the new one:
    - **`inert` on `#root` was dropped too early** — present with the outer sheet open, present with both, and **gone once the inner closed**. Now it survives until the last dialog leaves.
    - **`inert` never reached the dialog underneath**, so the sheet's own controls stayed live behind a confirm. The **overlay** is what goes inert, not the dialog inside it — `role="dialog"`, `aria-modal="true"` and `aria-labelledby` all live on the overlay, so inerting only the inner element left assistive tech seeing two modal dialogs at once, the background one first in document order and computing as *unnamed*, because its label had just gone inert. (An earlier draft of this line said the opposite of the code; a review caught it.)
    - **`--sheet-h` had the same shape** — measured gone the moment the inner dialog closed, putting the sheet's pinned Save button back under the iOS keyboard. Now one listener serves the whole stack.
    - **Back was worse than "does nothing".** `{ overlay: true }` was one flag every dialog read as its own, and it was wrong in **both** directions: the first press landed on the outer's entry, still an overlay, so both handlers returned early and **the confirm did not close**; the second landed on a non-overlay entry, so both fired and one press discarded the confirm *and* the half-filled sheet. Measured on the old build: after Back, still two dialogs; after the second, zero. Entries now carry their **depth**, so a dialog acts only when its own entry went away — and the same depth fixes the deferred cleanup traversal, which used to pop the outer sheet's entry when Back had already consumed the inner's.

  **A second review round found one more, and it was the worst of them.** `popstate` can outrun React: two Back presses delivered before the first one's dialog has unmounted consume two entries while only one dialog goes, leaving the stack **short** — and reconciliation only ever trimmed a *surplus*, so nothing repaired it. Measured: the sheet then owned no entry, so the next Back left the app with a half-filled form; and the deficit was permanent, because the next push stamped a depth claiming entries that were not there, and dismissing *that* dialog with **Escape** trimmed a surplus that did not exist and closed the sheet on its own, discarding the draft with no undo. The reconciliation now repairs drift in **both** directions, so the stack and the open dialogs converge however far an event burst drove them apart.

  Worth knowing that the burst behaves differently in a browser than in jsdom, and that both are fine: with real timing React unmounts between the two presses, so the second finds the sheet topmost and closes it — two presses, two dialogs, which is what the user asked for. In jsdom the presses land in one batch, the second is absorbed, and the deficit repair puts the sheet's entry back. **The invariant the tests pin is that neither path corrupts the stack**, not which of the two outcomes you get.

  **Two bounded residuals, measured and left in place deliberately.** `go()` is asynchronous and its `popstate` is what reports the traversal landed, so a traversal that never reports leaves the in-flight marker high and strands **one** entry — costing a single Back press. It is not permanent: two ordinary open/close cycles drain it back to zero. Not "fixed" by clearing the marker on a timer, because that trades a stranded entry for the chance of clearing while a slow traversal is still in flight, which over-traverses and closes a dialog nobody dismissed — the exact failure this file has twice been repaired for. One absorbed Back press is the cheaper side of that trade. The second: the repair only runs when something schedules a reconciliation, and only an unmount does, so a deficit created by an `onClose` that *declines* to close would wait for the next unmount. No caller here declines.

  **A correction to what this section used to claim, found by measuring rather than reasoning.** It said the missing `inert` left the page "clickable and screen-reader-reachable" underneath. The clickable half was wrong: a real pointer never reaches `#root` either way, because the dialog overlay covers the viewport. The exposure was **assistive technology and programmatic reach**, which is the half `inert` uniquely provides — and that is also the half no browser automation here can observe, since Playwright's role locators resolve against the DOM rather than the platform accessibility tree, and a scripted `element.click()` is not blocked by `inert` at all. Both were tried, and both reported *no difference between the broken and fixed builds*. So the `inert` placement is pinned by unit test and by a browser check of the attribute at the exact moment it used to be wrong; its effect on the accessibility tree is the attribute's platform contract, taken as read. Worth knowing before someone writes a browser assertion for it and reads a vacuous pass as proof.

  **What the browser pass confirmed functionally**, at 390px and 1200px, with a confirm opened from inside the log sheet: Tab stayed inside the confirm (0 escapes in 10), Escape closed only the confirm, the sheet's Save became hit-testable again the moment it did, `--sheet-h` survived and kept tracking, and Back closed **one dialog per press** in order. The pre-existing sweep is unchanged — 0 escapes in 60 tab presses through the sheet at both widths, segmented inputs keeping their four internal stops each way.

  **One pre-existing escape is confirmed pre-existing, not a regression**: clicking the sheet's dead backdrop padding still drops focus to `<body>`. Measured identically on `main` in a worktree. The sheet stays open and Tab and Escape still work, since the trap lives on the window listener.

  Also still open, and unfixable this way: a segmented input at either **end** of the tab order loses in-field stepping in that direction, since nothing in the DOM says which segment you are on.

  That residual used to be much larger than the sentence above admitted, and a browser pass caught it. `handOffFocus` moves focus with `focus()`, which enters a date or time field at its **first** segment — right going forwards, exactly wrong going backwards, where the browser enters at the **last**. So every Shift+Tab *into* a segmented field landed on the hour and the next one left the field: **minutes and AM/PM could not be reached backwards at all**, on the log sheet, in the primary flow. Measured against the same control outside a dialog: one backward stop against four. The trap now stands aside for that one move whenever a control precedes the field, which is exactly when the browser's own move cannot leave the dialog — so the residual really is only the ends now, and it is four stops again.

  **Browser-pass checklist for B½,** since B½ adds fields to the very sheet this is bounded by, and none of it is visible to jsdom:
    - Tab and Shift+Tab through the whole log sheet, both directions, and confirm focus never leaves it.
    - Tab *within* the date and time inputs and confirm the segments still step (this broke once already).
    - Confirm no new field lands a segmented input first or last in the sheet's tab order, which is the ordering the escape hatch is silently relying on.
    - Confirm the focus ring is actually painted on every new hand-off target, at 390px — the ring guard proves a rule exists, not that it is on screen.
    - **Sweep a DESKTOP width too, not only phone widths.** Added after the off-days field shipped a broken layout that every phone width was structurally unable to see: `.form-row` is a flex row only above 560px, and the whole sweep was 320–430px. A field added without its `.field-cell` wrapper took the row and left the pain group 8px wide, its chips stacked and overprinting the next column — the state every sheet opened in, which repaired itself the moment a chip was tapped. 390 and 1200 at minimum; the breakpoint is where this class of bug lives, so a checklist that never crosses one cannot find it.

  **Added by the cadence PR — done, and it found one thing.** Each was structurally invisible to jsdom, so the suite being green said nothing about any of them:
    - ✅ **The disabled shot-day select, in both the first-run card and Settings.** Tab out of the interval box on the card, and *tap* the select directly in Settings — the pointer path, which fires the box's blur first and disables the select before the tap can land. Focus went to the notice both times, never `<body>`.
    - ✅ **Landing on "Your data"** from the card's restore link: heading focused, "Import backup (JSON)" fully on screen, and the ring painted as the app's own `2px solid var(--accent)`.
    - ✅ **The row wash on a renamed saved value** — rounded and inset as intended, only on the renamed row. Screenshotted rather than measured, because computed style has lied about this exact thing before.
    - ✅ **The whole log sheet's tab order** with "Planned for" in it. 26 tabs forward and 26 back: **zero escapes** in either direction, both wrapping correctly. All three segmented inputs — shot date, time, and the new planned date — still get their four internal stops going *both* ways, so the Shift+Tab defect that once made minutes and AM/PM unreachable has not come back. No segmented input sits at either end of the order.
    - ⚠️ **Found: the new hand-off target had no ring of the app's own.** Focus landed on the notice correctly, and the element fell through to the UA's default outline — visible in Chromium, so a screenshot alone would have passed it, and *not* this app's ring. A `<p tabindex="-1">` is exactly the sort of target other engines decline to outline at all. Added to the hand-off ring list in `styles.css` and guarded by `expectVisibleFocusRing` in the card's tests.

    Worth recording how that last one nearly slipped: the computed style read `outline-style: auto`, `outline-color: rgb(16, 16, 16)` — near-black on a near-black card — which looked like a defect, and the screenshot then showed a perfectly visible ring, which looked like a false alarm. Both readings were wrong about the thing that mattered. `outline: auto` means *the browser draws its own*, so the colour value is not used and the question "is a ring painted" was never the question. The real one was "is it **ours**", and only reading the stylesheet answered it.

- [x] Add optional testosterone start date for HRT milestones — _Settings → Your journey; future start dates allowed (planning ahead reads as "not started yet")_
- [x] Add optional display name / preferred name for affirming milestone messages
- [x] Add milestone logic for three-month intervals during year one, then six-month intervals after that — _labels read "1 year 3 months", never months-only_
- [x] Add the post-log acknowledgement — **"Logged for you."** See *A shot is not a chore* at the top for why it exists and the rules the copy follows. Values below are settled, from a prototype rather than from taste:

  - **The line** appears in the greeting slot, in the success green, and **outranks whatever that slot would otherwise show — including a milestone.** `greeting.ts` already ranks milestone above shot-day above returning, on the reasoning that the rarer, bigger landmark wins. The acknowledgement sits above all of them, but only while it is still a response to something you just did.
  - **It clears on the next deliberate action, never on a timer.** Closing the log form without logging, leaving Home for another tab, or reopening the app each bring the greeting or milestone back; nothing snatches it away mid-read. That is what stops it *competing* with the milestone rather than replacing it — log a shot on your one-year day and you get "Logged for you." until you touch anything else, and "Congrats on 1 year on T" is still there waiting when you do. `navigate()` is the single route between views, so that is one place to clear it, not three.

    **The greeting slot only ever changes while nothing is covering it**, which is a timing rule and not a wording one. Retiring the line when the form *opened* was the obvious reading of "the next deliberate action", and it was visibly wrong: the slot flipped from "Logged for you." back to the greeting behind a sheet that was still sliding up, so the app appeared to undo itself while you watched. It is retired when the sheet has finished **leaving** instead. Opening changes nothing; dismissing brings the greeting back once the sheet is gone; and logging again replaces one acknowledgement with the next at that same moment, so it never blinks through the greeting on the way.
  - **The same words whether or not a name is set** — never "Logged for you, Lou."
  - **Save confirms in green with a ✓** for 100–300ms, then the sheet leaves. **No spring, no overshoot** — anything that bounces reads as the screen acting under its own power rather than answering you.
  - **The new entry arrives with a wash of colour that holds at full tint for the first fifth, then decays over 2.2s.** Painted by an **overlay** (`::after` with animated opacity), not by animating the row's `background-color`: the row already carries an opaque `background: radial-gradient(...)`, and a background *image* always paints over background-color — so the first build animated a tint that was invisible for the whole 2.2s while `getComputedStyle().backgroundColor` reported it changing perfectly. Only a screenshot can answer "can you see it". The hold is what makes it read as a flash rather than a brief tint; fading from the first frame does not land. This is the [Yellow Fade Technique](https://www.oreilly.com/library/view/agile-web-development/9781680502985/f_0070.xhtml).
  - **Drive the wash off the entry's identity, not a render.** A class reapplied by a re-render restarts the animation — in the prototype, merely opening the form replayed the wash on the previous entry. Keying it to the shot's id is enough on its own: React leaves an unchanged `className` alone, so nothing re-triggers.
  - **The wash starts when the row becomes visible, not when the shot is saved.** Measured in a browser: the ✓ plus the slide cover the screen for ~440ms, which is almost exactly the 20% the wash spends at full tint — so arming it at save time spent the entire hold behind the sheet and what you actually saw was a tint already fading. Armed instead when the sheet finishes leaving.
  - **The wash and the line are separate state with separate lifetimes.** The line waits for your next deliberate action; the wash retires when it finishes. Retire it on the row's own `animationend` rather than a `setTimeout` — otherwise the 2.2s lives in both CSS and JS and they drift, which is the same trap as `SHEET_EXIT_MS` and its two stylesheet values. Guard on `animationName`: React's `onAnimationEnd` bubbles, so "an animation ended" is not "the wash ended". Under `prefers-reduced-motion` the tint holds for the same 2.2s with `step-end` instead of fading — still an animation, so it still ends, so there is one retirement path and not two.
  - **Home unmounts when you leave it**, so a wash still armed would replay on every return — the same nuisance the milestone item below avoids by firing once on the crossing. Clearing both pieces of state in `navigate()` handles it.
  - **Nothing is said when a save fails, or when the sheet is dismissed with ✕.** There is nothing to affirm, and a warm line after an abandoned entry would be false.
  - **But a save that succeeds on a retry gets the full acknowledgement** — same wash, same words, same duration as one that worked first time. The shot was still taken, and the person who just fought their phone for it has *more* claim on the moment, not less. The natural implementation gets this right by accident (the wash hangs off a successful save, and a retry is one) — it is written down because the natural *mistake* is to treat "this save had an error earlier" as a reason to stay quiet, or to leave the failure message on screen underneath the celebration. Clear the error state, then affirm exactly as normal.

    Worth knowing while building it: the storage banner may still be up at that moment. A failed save leaves the shots key marked failing, and the successful retry clears it — but another store can still be failing, so the banner and the "Logged for you." line can legitimately share the screen. That is correct and should not be special-cased: one says this shot is safe, the other says something else isn't.

- [x] Slow the sheet exit from **200ms to 240ms** (`SHEET_EXIT_MS` in `Modal.tsx`, plus the two matching `200ms` values in `styles.css` — they are a set and must move together, or the sheet unmounts mid-slide). The easing is already right: emphasized accelerate is correct for something leaving. The problem is that 200ms across a full-screen surface means it is travelling fastest at the instant it vanishes, which reads as dropped rather than dismissed. 240 keeps exits quick — Material's reasoning is that they are "less of a priority for the user's attention than the next task" — while giving the surface enough time to look like it left on purpose.

  **A commit gets the ✓ beat; a cancel goes straight out. The axis is reversibility, not which surface it is** — written down because it has now been derived twice from scratch, once for the sheet and once for the first-run card, and step 6 adds two more surfaces that will need a dismiss control. Measured on the real build: card **Done 460ms**, sheet **Save 449ms**, sheet **✕ 244ms**. The two commits match each other; the cancel is deliberately the odd one out.

  Dismissing the sheet is fully reversible — the draft is preserved and reopening restores it — so there is nothing to acknowledge and the beat would only be a delay. `Done` is irreversible: the card never returns and no Settings control brings it back. Acknowledging an act you cannot undo is exactly when a confirm beat earns its place.

  Both numbers sit where the guidance wants them (244ms inside the 200–300ms standard band, 449/460 inside the 300–500ms band for larger transitions), and Material is explicit that timing should match the complexity of the change rather than be uniform — so the difference is the point, not an inconsistency. **460ms is the app's longest anything and sits near the 500ms line where motion starts reading as sluggish**; it was checked on a phone and does not, so it stays. If that ever changes, the fix is a separate exit constant for the card at ~150ms, keeping `CONFIRM_MS` shared — and the guard that pins every CSS copy of `SHEET_EXIT_MS` has to grow a second value rather than lose the card.

  **Not confetti.** It is seen ~52 times a year and has to survive every one of them, including the weeks when the shot hurt. Confetti is also the wrong register for a routine act of self-care, and spends the good feeling that belongs to the milestones.

  Sound and haptic wait for the Capacitor build (iOS Safari has no Vibration API), and plenty of people will keep both off — in public, a T tracker making a noise is an outing risk rather than a preference — so the visual and the words must carry it alone. Under `prefers-reduced-motion` the movement goes and the message stays: still green, still ✓, the row still tinted.

- [ ] Fire the **milestone** celebration once, on the crossing — the first launch after passing the date — then let the banner sit quietly for the rest of its two-week window. Tying it to the banner being *visible* would mean celebrating on every launch for a fortnight, which turns the moment into a nuisance. Costs one stored "already celebrated" flag.
- [x] Add an **everyday greeting** at the top of the log screen using the preferred name ("Hi, Lou"). Name-optional: with no name it falls back warmly ("Welcome back") and never renders a dangling "Hi, ". Local-weekday/civil-date based, log-view only (not Settings or the milestone banner).
- [x] Add an optional **"shot day"** setting + a celebratory **"Happy shot day, Lou!"** greeting on that day. Weekday-based to start (a one-line local-weekday compare), **pre-filled from the user's most common logged weekday** so most users never touch it. Genuinely optional: a "No shot day" choice means **no shot-day greeting at all** — no fallback guessing. Seeds the later "shot due soon" reminder; interval/every-N-day scheduling is deferred to that feature. Lives in Settings → "Your journey" for now.
- [x] Ensure greetings and milestones are **name-optional** end to end: with only a shot day set, still show "Happy shot day!"; with only a start date set, still show "Congrats on 1 year on T!" — the preferred name only personalizes the message, it's never required to receive one.
- [x] Add saved custom injection site/position options for faster repeated logging — _reuse chips on the log form plus a Settings → Manage saved values panel to rename/remove them_
- [ ] Redesign the UI around a phone-first, warm, readable, non-corporate visual direction

  **Pick the app icon here.** It is currently a placeholder (`public/icon.svg`, the History tab's chart mark, standing in for Vite's logo), and it is the visual identity's most public surface, so it belongs with this work rather than with the PWA bullet that consumes it. Two constraints come from elsewhere and are not stylistic: it must **not announce what the app tracks** (the disguise-mode threat model — a home screen is visible to whoever is nearby), and it must **survive Android's adaptive-icon crop**, which cuts to a centred circle at 80% of the width. Deciding both while drawing is one judgement; discovering the crop afterwards is two. Everything raster follows from this choice in one mechanical pass — see **PWA support** in Mid-Term.

  **Do the sheet's close path here, not before.** `closeSheet` ends the exit on a `setTimeout(SHEET_EXIT_MS)`, and that timer is a *proxy* for "the transition ended" — the shape CLAUDE.md warns about, which has cost this project two defect classes already. Deferred rather than fixed on its own, deliberately, and the reasoning is worth keeping because the obvious framing of it is wrong:

  - **The constant does not go away.** `transitionend` is not guaranteed to fire — not for a `0s` duration, not when the transition never starts (property unchanged, element not rendered, `display: none`), and not when a browser, extension or OS setting disables transitions outright. A missed event means the sheet **never unmounts**: a stuck modal over an inert `#root`. So a timeout stays as the net, and `SHEET_EXIT_MS` survives, demoted. The win is precision, not simplification.
  - **Precision buys almost nothing today.** Under `prefers-reduced-motion` the CSS exit is 150ms against the JS 240ms, so the sheet lingers mounted-but-invisible for ~90ms — on the safe side of the rule that the greeting only changes once nothing is covering it, and invisible either way. The real payoff arrives with an **interruptible or velocity-based dismiss** (swipe-to-dismiss), where there is no fixed duration to hang a timer on at all.
  - **And `closeSheet` is the highest-defect function on the branch** — the ✓ beat, `skipConfirm`, `openCount`, dismissal-during-confirm and the acknowledgement arming all live in it, and five review rounds found bugs there, several introduced by the previous round's fix. Rewriting its completion trigger surgically, to buy 90ms in one motion mode, is the worst risk-to-payoff trade available. Doing it while these surfaces are being reworked anyway is the cheap moment.

  **The shape, so it is decided rather than rediscovered:** listen on the **overlay** (outermost, always present), guard on `propertyName` *and* `e.target === e.currentTarget` — `transitionend` bubbles, which is exactly the trap the row wash hit with `animationName` — handle `transitioncancel` as well, and keep the timer as a whichever-comes-first net with a little slack. jsdom fires none of these events, so it needs its own browser pass.
- [x] Add **CSV export** for clinical conversations — _Settings → Your data, formula-injection-safe, RFC 4180 quoted_
- [x] Add **JSON backup export/import** so users can move or restore local data — _versioned envelope (shots + optional profile); downloads a safety backup before replacing_

  **Import is strict at the file level and lenient at the row level**, and the split is deliberate. A wrong `app`, a wrong `formatVersion`, unparseable JSON or a prototype-pollution key all mean "this is not your backup", so the file is refused. One entry with a date nothing can read means "this entry is unusable": it is skipped, the rest still restores, and the report says how many and why — *"Restored 43 of 44 entries"*, then the entry named by the date the user typed.

  It used to refuse the whole file for either. That was found by exporting a backup containing a legacy out-of-range date and importing it straight back: the app produced a file it then refused to read, advising *"make sure you picked a backup file exported from this app"* — which is exactly what had happened. Backup export is the only recovery path in this product's durability model, so a file that cannot be restored is the worst outcome it can produce, and the pre-import safety copy went through the same unvalidated path.

  **The rule generalises**: refuse when accepting would write something wrong or the payload's identity is in doubt; degrade when refusing would withhold data the user already owns and the bad part is isolatable. That is the call `sanitizeShots` already makes on storage read, five files away, on identical data — import was the only boundary answering it differently. Industry practice splits the same way: CSV/data-onboarding tools skip and report, while Bitwarden and Signal refuse whole files because a *partially* restored vault or message chain misleads. A shot log has no such property — entries are independent and a missing one is visibly missing.

  **Two conditions make the leniency safe, and neither is optional.** Silence would make it strictly worse than refusing, so the count and reasons are always shown, and the confirm dialog says what will be skipped *before* the destructive step, not only in the report after it. And a file where **every** row is unusable is refused rather than "restored" as nothing — with its own wording, since telling someone to go and find a file they already have is a dead end.

  **The profile stays atomic**: it is one object, not a list, so there is no "43 of 44" to salvage. An unreadable one leaves the device's own name and shot day alone rather than clearing them, and says so.
- [x] _Engineering (landed first, PR #25):_ **branded `CivilDate` type** — `YYYY-MM-DD` values are minted only through `toCivilDate` (the smart constructor) and consumed by the date logic (milestones, greeting, shot-day, filters), so an untrusted string is parsed **once**, at the trust boundary, instead of re-checked everywhere downstream.

  **A boundary brand, deliberately not a model brand.** `ShotEntry.date` and `Profile.startDate` stay `string` on purpose: consumers compile unchanged, serialization is untouched, and there's no `{ date: "..." }` construction churn. Worth stating plainly, because this item's original wording promised the opposite ("retires string-typed date handling in `ShotEntry.date` / `Profile.startDate`") and stayed unticked after it shipped — which later got it cited as still-pending work, and as a fix for a bug it does not address.

  **The limit it leaves.** The brand stops at the boundary and never reaches *form* state. `ShotDraft.date` is a raw input string by necessity — a half-typed date isn't a valid date — and that is exactly where both of slice B's date defects lived. Branding the model would not have prevented either. See the (now closed) draft-sentinel item in Short-Term for how they were actually fixed.
- [ ] **History & Charts epic** (local-first, phone-first) — progressive-disclosure information architecture: Home shows a *recent-shots teaser* + "See all"; a dedicated **History** tab holds the full, filterable, searchable list **and** the charts; charts summarize trends. The unbounded list is never the main view. Built as thin slices, in order, after the CivilDate PR:

  **Shape of the whole epic (decided up front, so each slice builds toward it):**

  - **Navigation: a 3-tab bottom bar** — Home (house), History (**graph icon**, StoryGraph-style), Settings (gear). Three is the sweet spot both Material (3–5 destinations) and Apple's HIG endorse; a 4th tab would be worse, not better. Icons are hand-rolled inline SVG — no icon library, no CDN (privacy rule).
  - **Charts and the list share the History tab**, split by a **segmented control** rather than stacked in one long scroll (the Apple Health *Summary / Browse* pattern). Stacking rich charts above a long list is what actually creates clutter on a phone; a toggle keeps each sub-view clean while holding the tab count at three.
  - **Segment naming: `Patterns` / `History`**, with **Patterns first and selected by default.** "Patterns" comes from this project's own stated goal — helping you *see patterns* — and reads warm and insight-led rather than clinical ("Charts") or cool ("Browse").
  - **Home teaser mirrors History's actions.** Tapping through to edit happens in the History tab — _built: each row carries an **Edit** button that takes you to History with that shot's editor already open._

    _An explicit button, not the whole row. The first build made the entire card activate, which put a card-sized target a thumb's width from "Log a shot" and opened a modal **editor** rather than a page — tapping a row to reach a destination is ordinary, tapping one into an editor by accident is not. It also announced the row's whole text as the control's name, where "Edit" names the action. _**Delete is here too, behind the same confirm.** It was held back because a mis-tap on the screen you touch most could lose an entry — but the confirm already makes that two deliberate acts, and a row offering Edit and not Delete beside an identical row a tab away offering both is a difference with no reason a user can see. **One dialog serves both lists** (`useDeleteShotConfirm`), so a refused write behaves the same wherever you delete from, and slice C has one call site to replace when the confirm becomes an undo snackbar. **Revisit at slice C:** undo-over-confirm is the end state, and Home relying on a snackbar alone is a different risk from Home behind a confirm — decide it then rather than inheriting it._

  **What we actually track (the signals the charts are built on).** Deliberately *not* pain-as-headline: pain is the easiest thing to log and the least interesting thing to chart. Industry pattern across the apps worth emulating (Daylio, Clue, Medisafe, Apple Health) is **fast ordinal scales + categorical tags**, with correlation — not raw numbers — as the payoff.

  - **Adherence & lateness** — the objective early hero (meaningful by ~shot 3, while trend charts still say "not enough data yet"). Needs a lightweight **interval/cadence** concept. This bullet used to specify `expected = previous shot's date + interval, defaulted from the user's most common gap`, and **both halves of that were wrong** — the implementation rejects them by name:

    - **Chaining on the previous shot cascades.** One early shot drags the schedule with it and every correct shot afterwards reads late, forever and frozen. Chaining on the previous *planned* date fails the mirror way: a skipped shot leaves the grid permanently one slot behind. What works is a **fixed grid** — an anchor plus the interval — with each shot claiming its nearest slot, so no shot's planned date depends on any other shot's behaviour.
    - **Nothing is defaulted.** A default interval of 7 is uniquely harmful precisely because the value is frozen: a fortnightly user who never opened Settings would accumulate months of shots measured against a schedule they were never on, and correcting the setting afterwards repairs none of them. No interval, or no shot day, means no planned date at all.

    **Shot day is what anchors the grid**, which is a second job for a setting that previously only drove the greeting. Without it the anchor is "wherever the first shot landed", and that fails in *both* directions — measured: someone late every single week reads as perfect, because their first late shot silently became the schedule; and one accidental early first shot marks every correct shot late forever. (An earlier draft said "the way shot-day is defaulted from their most common weekday" — **shot day is not defaulted that way and never was**; the select simply starts on "No shot day". Deriving a default from logged history is therefore new work here, not a pattern to copy. Worth writing so it can be pointed at shot day afterwards.) **Lateness is frozen at log time**: the *planned date* is computed at the boundary and **stored on the shot**, never recomputed from a later-changed schedule — so adjusting your cadence going forward never rewrites history. Days-late is **derived** from it rather than stored, deliberately: it follows from two facts already on the shot, and a third value would be free to disagree with them. (An earlier draft of this bullet said both were stored.)

    **The anchor is the most recent date the app knows about — not the first shot, which is what it used to be and what this bullet used to say.** An anchor is re-derived whenever the cadence or shot day changes, and the earliest shot is *the same date before and after such a change* — so clearing the stored anchor accomplished nothing and the new cadence silently inherited the old grid's phase. Because lateness is frozen at log time, every shot logged afterwards kept a fixed offset forever: −7 days on a fortnightly cadence, −14 on 28 days, −21 on the 12-week chip. Freezing does not protect against this; it is what makes it permanent, since each new shot is born wrong and then guarded from correction.

    **Found by sweeping, not by thinking, and the obvious fix was worse than the bug.** Across 2250 combinations of before/after interval, prior-shot count, gap length and weekday — asking only *"does perfect adherence read 0?"* — anchoring on the earliest shot was wrong in **1317**. Re-anchoring on the latest *existing* shot, which is the fix that suggests itself, was wrong in **1350**: no past shot is a whole number of *new* intervals away, so a 12-week switch went from −21 to −35. Anchoring on the most recent date known is wrong in **none**.

    The "most recent date *known*" rather than "the shot being saved" is load-bearing too, and also measured: those differ only when a backdated entry is the first save after a settings change, and hanging the whole future grid off a forgotten shot from months ago reintroduces the same permanent offset by another door.

    It is worth noticing that the anchoring rule was wrong for **59% of cadence changes** while every scenario test passed, because all six of them keep one cadence throughout. The sweep is now `scheduleAdherence.test.ts` and is the guard for this class.

    **Two rhythms, not one — the mistake that took several rounds to see.** "I inject on Wednesdays" is a **calendar grid**, where drift is a problem because the weekday *is* the intent. "I inject every 10 days" is a **rolling gap** from the last dose, where drift is not drift, it is the definition — you count from your last injection, which is also what your levels respond to. Forcing either model onto the other produced a different permanent-lateness bug each time. So the app picks by cadence: a whole number of weeks *plus* a shot day gets the grid; anything else gets the gap. A whole number of weeks with **no** shot day deliberately gets neither — rolling would work mechanically and would under-report, since someone consistently injecting on Fridays who meant Wednesdays reads "on time" every week, which is true and useless. **This matches the category**: every comparable injection tracker schedules by interval, and [Regimen](https://play.google.com/store/apps/details?id=com.regimen.app) offers both shapes side by side ("every X days" *and* "specific days like Mon/Wed/Fri").

    **The app measures the gap and never grades it — and the grammar is what does that, not a euphemism.** English separates the adjective from the comparative: *"2 days late"* is a **status** against an obligation you failed, *"2 days later"* is a **distance** from a reference, and only the second is something the app knows. So a row reads `Planned for 26 Aug · 2 days later`. This follows the **#LanguageMatters** practice — the [Diabetes Australia](https://www.sciencedirect.com/science/article/abs/pii/S0168822721000085), [NHS England](https://www.england.nhs.uk/long-read/language-matters-language-and-diabetes/) and [English Advisory Group](https://pubmed.ncbi.nlm.nih.gov/29888553/) position statements — whose finding is that language which blames and shames does more harm than it does motivating, and which is why that field moved from "compliance" to "adherence" and now questions "adherence" too. It matters more than usual here because people judge their own timing far more harshly than their clinicians do: in one study 55% of patients counted a six-hour delay as a missed dose, against a single physician who agreed.

    An earlier build avoided **"early" as well as "late"**, saying "taken 2 days after". That was over-applied and worth recording as a correction: "early" carries no fault at all, and the same position statements ask for language that is **clear** as well as non-judgemental — "after" needs the line above it to mean anything, where "later" stands alone. Avoid the verdict, not the direction.

    **Lateness stays in whole civil days, and there is no tolerance band.** Clinical practice defines missed doses with an hours-wide window (±2 hours is typical), but that is for daily orals; a depot injection is a calendar event, the schedule is expressed in days, and `time` on a shot is optional. Either it landed on the expected day or it did not. A band would add a threshold to explain and a second number to argue about, for no gain when the unit is already a day. **Decided, not deferred** — do not reintroduce it with the charts.

    **Known gap: two shots a week cannot be expressed, and it is a real protocol.** Twice-weekly TRT — Monday and Thursday, specifically to flatten peaks and troughs — is *every 3.5 days*, and `intervalDays` is a whole number. That user's only options today are 3 days, 4 days, or nothing, and Mon/Wed/Fri protocols have the same problem. Fractional intervals are the wrong fix; the right one is what the grid mode already almost is — **a set of weekdays rather than one**. That generalises the existing calculation instead of adding a third rhythm, and it is how comparable apps offer it. Held back deliberately, because it turns `shotDay` from a value into a list and therefore touches `Profile`, the DTO allowlist, both schemas and the greeting.

    **Asked for, and confirmed as the direction** — "just do a select days for shots so you can select multiple if you take multiple times a week". Not scheduled yet; recorded so the shape is decided before anyone opens the file. Four things fall out of it that are worth knowing in advance:

    - **`intervalDays` stays, and the change is only `shotDay` → `shotDays`.** The obvious reading of "a set of weekdays" is that it replaces the interval, and it does not: a set alone cannot say *every other* Wednesday, which the app supports today. Keep both and the grid becomes "these weekdays, every N weeks" — `[Mon, Thu]` with 7 is twice-weekly, `[Wed]` with 14 is exactly today's fortnightly behaviour. No new field, and every current profile is already a one-element set.
    - **One stored anchor still suffices.** Each weekday gets its own grid, anchored by snapping the *same* reference date to that weekday — and since snapping moves at most 3 days, they all sit in one week. The planned date is then the nearest slot across the set. `plannedDateFor` grows a loop; nothing else about the anchor lifecycle changes.
    - **It shrinks the sign-inversion window**, which is a real bonus rather than a side effect. Lateness is bounded by half an interval, so a lone weekly shot day inverts past 3.5 days — the documented "4 days late reads as 3 days early". With Mon/Thu the nearest slot is never more than ~1.75 days away, so the vocabulary stays honest over a much wider range of real behaviour.
    - **It removes the fractional-interval problem entirely**, which is the other reason to prefer it: the twice-weekly user stops needing a number the model cannot hold. That also softens — though does not remove — the open question of what to say when someone types `3.5` into the interval box today.

    **The shape, decided: ask which rhythm first.** Three named choices rather than two fields that switch each other off:

    > **How do you time your shots?**
    > ( ) On certain days — `[S][M][T][W][T][F][S]`, every `[1]` week(s)
    > ( ) Every so many days — every `[10]` days
    > ( ) I'd rather not track this

    `scheduleMode` already returns `grid | rolling | none`; this shows the three states instead of inferring them from which fields happen to be blank. That is the "one value, one meaning" rule applied to controls rather than to data, and **every state becomes something the user picked** — including not tracking, which today is a real "No shot day" option and would otherwise decay into seven unselected toggles that look identical to a form nobody filled in.

    It is also the pattern the whole category uses. Google Calendar, Apple Calendar, Outlook and the recurrence-picker component libraries all ask **frequency first, then the details for that frequency**; a mode-less pair of interacting fields does not appear in the wild.

    **Two alternatives were prototyped and rejected**, and the reasoning is worth keeping because the first is the one that suggests itself:

    - **Two controls that disable each other** — pick two days and the interval locks to 7; type a non-weekly number and the days grey out. Rejected because it is the only shape that *loses a real protocol* (Mon and Thu every other week, which RRULE expresses as `INTERVAL=2;BYDAY=MO,TH`), and it spends two disabled states and two notices to do it. Building UI in order to remove a capability the standard supports is the wrong direction of effort. It also leaves "not tracking" as an absence rather than a choice, and deadlocks in both directions: getting from Mon+Thu to a 10-day cadence requires deselecting days first, because the control you want is disabled by the state you are leaving.
    - **Same two controls, but the unit follows the mode** — weeks while days are selected, days when none are. This fixes the "how often?" ambiguity for a label change and keeps every protocol, so it is a reasonable smallest-diff answer. Rejected because one field then silently means two different units, which is the overloaded value this codebase has paid for twice, and it still cannot say "not tracking" out loud.

    **The model this stores is RFC 5545's, which is worth knowing before opening the file.** `shotDays` is `BYDAY`, `intervalDays / 7` is `INTERVAL`, under `FREQ=WEEKLY`. A model reached from injection protocols landing on the same decomposition the calendar standard uses is reassuring rather than coincidental, and it means a future calendar export is a translation instead of a redesign.

    **Two implementation notes that apply regardless of shape:**

    - **The day toggles must NOT copy the existing chip pattern.** The interval chips use `aria-current`, which means "the current item in a set" — wrong for independent multi-select. Days are state: `aria-pressed` on buttons, or checkboxes in a fieldset. The `role="group"` + `aria-label` wrapper does transfer. Copying the markup already sitting there is the obvious move and would ship a real screen-reader bug.
    - **Seven toggles do not fit one row at the app's own standard.** Measured: the chip row is 227.8px at 320px with a 5.6px gap, so seven days get **27.7px each**, and 37.7px at 390px. That passes WCAG 2.2 AA (2.5.8, 24x24) and fails the 44x44 Apple HIG minimum `.chip` cites in its own comment. Accept it — still conformant, and what Google Clock does — or use two rows. Decide before building; it changes the layout.

    **Only cadences a weekday can describe get a planned date** — a whole number of weeks. The grid is anchored by snapping a reference date to the user's shot day, and that only aligns anything when the interval is a multiple of 7; on a 10-day cadence the grid walks across the week, so snapping injects a fixed offset every shot then carries. Measured: a user injecting *exactly* every 10 days read "3 days before" on every shot, forever. There is no honest anchor for those cadences, so they get none — the same answer the app gives to a missing shot day. Both stay **editable in the History tab** to correct genuine mistakes.
  - **Mood — one question, and the answers carry a pattern rather than a rating.** Free-text mood is replaced, but *not* by the 5-point intensity scale this item used to specify (awful → great, Daylio's model). The framing survives and the anchors don't; both changes came from asking what the question is actually for.

    **The question is "Any days you felt off?"**, asked once a shot, answered with one tap:

    > `Not really` · `Early on` · `Here and there` · `Right before` · `Most days`

    **Why "off" rather than "how was it".** More answerable, because it is more memorable — you notice feeling off, you don't notice feeling normal, so counting good days is counting non-events. It is also vague in the useful direction: it covers flat, irritable, tearful, foggy and dysphoric without making anyone pick which, and without the app deciding any of them is a symptom. This overrides the obvious precedent — WHO-5 is deliberately worded toward wellbeing rather than symptoms — because that instrument is answered under supervision and this one is tapped one-handed next to a sharps bin.

    **Why the answers name a pattern, not an amount.** The pre-shot trough is the one insight this app can produce and a daily mood tracker structurally cannot, because only this app knows where in the interval you were when you felt it. A pure count cannot see it: three off days scattered and three stacked before your shot answer identically. Naming the pattern gets both in a single tap, and produces the sentence that leads somewhere — *"the days right before my shot were the off ones, four cycles running"* is a conversation about a shorter interval or a split dose, where *"I feel rough sometimes"* is not.

    **The peak side is one of the five, and that was not the original plan.** This bullet used to list four answers and record the after-the-shot pattern as an accepted loss — "has nowhere true to put them and will pick 'Here and there'" — with a fifth value noted as free to add later. It was added, because the loss turned out to be bigger than the note implied. Testosterone peaks **24–48h after** the injection with estradiol rising alongside it (reported as weepy, emotional, irritable); the trough is the mirror, the last 1–2 days before the next dose on a swing that reaches 2.5–3:1. Both are documented, and the trans-specific guidance makes **cyclic symptoms the trigger** for measuring peak and trough levels and, if the swing is wide, shortening the interval or moving to a transdermal. A four-answer version could not produce the sentence that starts that conversation.

    **Accepted costs, still real.** It is **not a clean ordinal** — "Here and there" is not more or less than "Right before", so there is no line to plot and no average to take; charts count how often each pattern appears. And "off days both early *and* late" still has no home, so it stays a **best-fit** question. Multi-select is not the fix: two answers lit is a tally again, and the tally is what this design exists to beat.

    **Wording rules that outlast the options.** Never *"this week"* — cadence may be 3 days or 14, so the span line names the real window ("Since your previous shot · 13 days"). And "before this shot" alone is ambiguous, since the *entire* window is before this shot, so only **"right before"** says near it.

    **The anchor is always shown; only the length is conditional.** It used to vanish when the length was unknown, which is the one shot where it was needed most — a first entry has no predecessor to measure from, so the only surface naming the window disappeared for the person with least context, and the question itself never says "since when". "Since your previous shot" is true even when the app cannot compute it, because someone logging their first shot here may have been injecting for years.

    **"Previous", never "last", in every label set.** "Your last shot" means the most recent one, so on an entry from months ago it names a different shot from the one actually measured. The rule was once applied to two of the three sets and missed on the spoken labels, where only a screen-reader user would have met the contradiction — so it is stated here as covering all of them, and a test holds every set to it.

    **The anchor-on-a-shot rule was relaxed, deliberately, and only where a picture replaced it.** It used to say every answer must name a shot rather than a position, and it rejected "Early on" by name for mixing the two frames. That rule existed because the WORDS alone had to carry the anchor. In the log sheet they no longer do — each row draws where the days sat — so the short labels are "Early on" and "Right before" and the strip supplies the frame. It still holds everywhere the answer stands **alone**: the History facet and the row pill use the long forms, which is why `offDaysLabel` and `offDaysShortLabel` are two functions and not one.

    **Short labels moved the meaning into a picture, so it had to be put back in words for anyone who cannot see it.** The strip is `aria-hidden`, so each row's accessible name carries the full phrasing — "Early on — the days right after your last shot" — starting with the visible text, which is what WCAG 2.5.3 asks and what keeps voice control matching. Without that the position would exist only where assistive tech cannot reach it (1.3.1).

    **Deferred out of the B½ spine, deliberately** — see the slice B½ item below for why.
  - **Bleeding & cramps — optional, opt-in, neutrally named** (see the safety model below).
  - **Pain — demoted to a secondary filter/facet.** Still logged (useful per-shot and for a *site-rotation* view: "does my left glute always hurt more?"), but not a headline trend. With the planned None/Mild/Moderate/Severe chips, **pain filtering is by ordinal category, not a 0–10 numeric range.**
  - **How the site settled — soreness duration + an unabsorbed lump.** A different thing from the pain of the injection: an oil depot that hasn't absorbed leaves a palpable lump, and the site can stay tender to touch for days. This is the half of the experience the current model has no room for, and the half worth showing a provider — "sore to touch for most of a week, mostly on the left" is a sentence you cannot currently produce from the data.

    **The design constraint is that this information does not exist at log time.** You find out over the following days. An earlier version of this section answered that with a card on **Home**, asked on day 3, with the log sheet as a backstop. **That is reversed: the log form asks it, once the interval closes, and there is no card.** The backstop turned out to be the whole feature.

    **What decided it was answerability.** Asking on day 3 means the only answers that can be offered are ones three days can settle — "a week or more" is not wrong then, it is unanswerable, and an answer that cannot yet be true gets skipped or guessed. Asking at the next shot has the whole interval elapsed, so the full four-answer scale is available again. The card also paid the price of asking early without buying what a prompt buys, because the rules above rightly forbid badges, timers and notifications — it was never a prompt, just a surface you might notice.

    **Event-contingent recording, at its best case.** That approach normally fails because people must notice a reportable event and decide to report it; here the event is logging the next shot, which is the app's primary action. Seven-day recall runs about 0.34–0.50 SD higher than a daily diary — retrospect inflates — but is equivalent at detecting change over time, and peak-end bias pushes the same way across every shot, so the comparisons this app actually makes (left against right, one oil against another) survive. Accepted cost: a fortnightly gap is double the window that evidence covers, and a shot whose successor is never logged is never asked about.

    **The shipped rules:**
      - **Offered answers follow the elapsed gap**, which the form already knows: four at 7 days or more, three at 3–6, the lump question alone below 3, and nothing at all past 28 days, where the recall is not worth the field. The lump question has no floor — "is there one now?" is present tense.
      - **One vocabulary, never reworded.** The same four values mean the same number of days for everyone; a short cadence is offered fewer of them, not different ones. An answer whose meaning depended on the asker's cadence would be the overloaded-value bug spread across a population instead of a field.
      - **The answers are written onto the PREVIOUS shot**, not the one being logged, so the site and how it settled sit on one row — which is what a rotation chart needs. Saving therefore changes two entries, through a single `persistShots` call so both land or neither does.
      - **Editing a saved shot asks about that shot itself**, and writes the answers back even when the block is not rendered — `updateShot` replaces the entry wholesale, so omitting them would erase an answer given weeks earlier.

    **A short cadence is no longer a special case.** The gap decides which answers are offered, so someone injecting every third day is asked the two that three days can settle, and the one genuinely unresolvable part is honest rather than hidden: soreness outlasting the interval blurs which shot it belongs to, and the chart says so beside the count instead of pretending otherwise.

    **Two questions, two fields**, because they are two things — a lump can sit painlessly for a fortnight, and a site can be tender with nothing palpable. `afterSoreness?: "none" | "day-or-two" | "several-days" | "week-plus"` and `afterLump?: boolean`, independently answerable, neither gating the other. The lump gets no scale on purpose: "was there one" is answerable without hesitating, while "how big" invites a guess, and a guessed number charts as confidently as a real one. **Duration and not severity** for now — severity is a second scale to design and chart, duration is what carries the conversation, and it can be added later without disturbing anything stored.

    **Copy, settled:** the block is headed **"Your previous shot"** over "2026-07-01 · left glute · 7 days ago", or **"How this shot settled"** when editing. Questions are **"How long was it sore?"** (Not sore / A day or two / Several days / A week or more) and "Any lump that hasn't absorbed?" (No / Yes). A History row reads "Sore several days · lump", and "Not sore · no lump" is shown just as explicitly — never asked and not sore are different facts. The question asks *how long* because the answers are durations: a stem and its answers that do not match measurably lower answer quality, and "Tender to touch" with duration answers was exactly that mismatch.

    **"Shot", never "site", in anything the user reads** — the same reason bleeding is never "breakthrough": that is the clinician's word, not theirs.

    Two wording decisions that were argued and should not be re-argued. **"from Tuesday" sits next to "shot", not after "feeling"** — "How's the shot feeling from Tuesday?" is the same length, but you read "How's the shot feeling" as a finished question and then have to re-attach the date, every time. And the title stays **plain present tense**, not "been feeling": the tense-correct version was tried and is stiffer, and the duration framing is already carried one line below by the "Tender to touch" label, so the headline does not need to do it twice. A four-word "How's the shot feeling?" also works and is unambiguous by construction (the card only exists for the open interval), but naming the day is warmer and was preferred.

    **What silence must never be read as.** Unanswered stays `undefined` — never `"none"`, or every skipped shot counts as painless and every chart tilts toward "no problem" (the overloaded-value bug that twice re-dated a logged shot here). But simply *excluding* unanswered shots carries the opposite bias, and it is the subtler one: people answer more readily when something was memorable, and what is memorable is discomfort, so a sparse set of answers probably reads worse than the year actually was. So charts **never impute**, **always show the denominator** ("from 8 of your 12 shots"), and **name the lean while coverage is thin** — the same posture slice D takes for early charts: carry the uncertainty visibly rather than withhold the view.

    **Two kinds of pain, deliberately separated.** Pain *at* the injection and soreness *after* it have different causes — needle gauge, speed and technique drive the first; oil volume, carrier and how the depot absorbs drive the second — and vaccine reactogenicity diaries formalise exactly this split, scoring day-0 reactions apart from the days-after ones. So the log sheet reads "How the injection itself felt" (the pain chips, about this shot) and "Tender to touch" (about the last one). Collapsing them is how you end up unable to tell "that needle hurt" from "that site was angry for a week" — and site rotation is answered by the second, which a blended number would bury.

    **Not opt-in, unlike bleeding**, and worth stating because the reflex once one field is gated is to gate the next. Bleeding is off by default because showing it unasked risks dysphoria and cannot be undone; that reasoning is about the subject matter, not about caution generally. Soreness is a neutral fact about an injection, in the same register as pain and dose, and hiding it would mean most people never find the field that answers the question they actually have.

    **Charts it unlocks:** duration by **site** (the payoff, and directly actionable — it tells you where to rotate; extends the planned site-rotation view from injection-moment pain to lingering soreness), and duration by **carrier oil**, which the app already records and currently charts nothing with. Plain counts, no interpretation, per the no-causal-claims rule below.

    **Deliberately not decided:** the app says nothing about when a lump might warrant medical attention. It does not diagnose, and a warning triggered by a self-reported checkbox would be alarming far more often than it was right; the safety mechanism is making the pattern easy to show someone qualified. Recorded so it is not quietly reversed later.

  - **Dose / ester / carrier oil — overlays and filters, not trends** ("show mood filtered to cypionate"; dose-over-time if a dose changed).

  **Bleeding category — trans-safety model (non-negotiable, like the privacy rules).**

  - **Off by default, opt-in in Settings.** The harm is asymmetric: wrongly *showing* it risks dysphoria on first impression and can't be undone; wrongly *hiding* it costs one toggle. "On by default, removable" makes the person who was just made uncomfortable do the work — opt-in puts the effort on whoever *wants* the feature, for whom enabling is neutral or affirming. Matches how Apple Health treats cycle tracking.
  - **Discoverable, not buried** — surfaced once via the planned skippable first-run overview and a gentle, dismissible pointer, so the people who'd benefit can find it without it being pushed on anyone.
  - **Neutrally named: "Bleeding" — never "breakthrough."** "Breakthrough" presumes no-periods is the baseline and frames any bleeding as a malfunction. **Some people menstruate regularly on T and that is simply their normal, not an aberration.** The schema stores plain intensity (`none / spotting / light / heavy`) plus optional cramps/symptoms; **whether it's "expected" or "notable" lives with the user, not in the data model.** The label is **user-editable** ("period", "spotting", "bleeding", …).
  - **Presented without alarm.** Charts show plain frequency/pattern data, never a "problem count." Any lateness↔bleeding observation is worded gently and interpretively, is dismissible, and never implies that a body that always bleeds on T is a symptom of poor adherence. No causal or medical claims.
  - **Non-destructive off.** Turning it off hides the field and removes it from charts/filters but **never deletes logged entries**; erasing that data is a separate, explicit action.
  - Enabling never obligates: the field stays per-shot optional. It's a *symptom, not identity*, so it stays inside the PII-free model.

  **Charts strategy: curated-first (not a chart builder).** Every comparable app worth emulating is curated — StoryGraph's fixed stats pages, Apple Health's pin-a-favorite, Daylio's fixed frames with one guided correlation. Full metric×grouping builders belong in BI tools; dropped into a consumer health app they cause blank-canvas paralysis, so the "empowerment" is illusory.

  - **Tier 1 — curated charts are the product.** A small, opinionated set (adherence/streaks, mood trend, bleeding pattern, dose/ester overlay). Most users never go past this, and that is a success.
  - **Tier 2 — light personalization: show/hide + pin.** Hide charts that don't matter (or that are dysphoric), pin the ones that do. The bleeding opt-in is already an instance of this, so generalize it into **one "What you see" surface** with a single mental model. Preferences are local profile settings — no new infrastructure.
  - **Tier 3 — deep customization: deferred, and guided if it ever lands.** If demand appears, the first step is Daylio-style "pick a variable to overlay", never an empty canvas.
  - **No "recently viewed."** That earns its keep only with a large library to navigate; here the set is small and fully visible by scrolling. **Pinning is the better answer** — intentional rather than inferred.
  - **"Suggested" means timely surfacing, not another thing to configure**: charts gently unlock as data accrues ("you've logged enough to see your mood trend"), pairing with the graceful "not enough data yet" states.

  ***

  - [x] **A — Data-access / selector layer.** Pure query module (`filterShots`, `searchShotText`, `sortShots`, `takeRecent`, `paginate`, `queryShots`, reusing `compareShotsChrono`) over the `useShots` source of truth; screens consume **selectors**, never raw arrays or storage. This is the client-side "internal API" — **not** a backend (the no-network privacy model stays intact); it's also the ports/adapters seam that makes a future opt-in encrypted sync a store swap, not a screen rewrite. No UI change; fully unit-tested. — _naming rule: you **filter** by structured fields, **search** by text, and a **query** composes both + sort + paginate into `{ items, total, hasMore }`._
  - [x] **B — Navigation + Home restructure + History view (browse + edit).** View state grows to `home | history | settings` (typed state, **no router dependency**; History-API/back-button deferred to the PWA phase), surfaced as the **3-tab bottom bar** above. Home = greeting + log form + recent teaser (last N, **read-only**) keeping *Log a shot* the primary action. History = full list + **filters** (date range, site, position, pain, ester) + **text search** + a **"Load more"** control (pagination chosen over infinite-scroll/virtualization — accessible and right-sized for hundreds–low-thousands of entries; windowing can drop in later if measurement demands). **Edit lives here** (tapping a shot opens the existing form in edit mode). Delete lives here too, rather than being removed and reinstated: it already exists on `main`, so taking it away would be a regression. Because slice C's undo is not built yet and there is no copy of the data anywhere, it is gated behind an **interim confirm** — deliberately the pattern the roadmap rejects for the end state, accepted only while an unguarded mis-tap on a dense phone list would permanently destroy a logged entry. Slice C replaces the confirm with the undo snackbar. No segmented control yet: it arrives in D when there's a Patterns view to switch to.

    Decided before implementation:

    - **Home is glanceable**: the form collapses behind a prominent **"Log a shot"** button that opens it as a **full-screen sheet**, so greeting + button + teaser all fit above the fold (the pattern Daylio/Clue/Medisafe use). An always-open inline form would push the teaser ~2 screens down on a phone, making "recent shots" effectively invisible.
    - **Editing from History** opens the same **full-screen sheet** over the list, preserving scroll position and active filters underneath.
    - **Filters are collapsible** behind a `Filters · N` toggle whose badge counts active facets (so a filter is never silently on); the **search field stays visible**. Search filters live with a **~200ms debounce** — everything is in-memory, so instant feedback is free — and result counts announce via `aria-live`.
    - **Teaser = last 3**; **"Load more" page = 20**. Single constants, easy to tune.
    - **Filters/search persist in memory for the session but are never written to storage** — returning from Home keeps your filter, a fresh launch never opens into a stale filtered state (also a mild safety win).
    - **The app always opens on Home**, never "last tab used": logging is the primary action, it's predictable, and reopening never lands on charts/bleeding data in public — which compounds with the planned disguise mode and app lock.
    - **The header slims to a per-view title**; the tagline and privacy note move out of the repeated chrome (~100px of phone screen reclaimed on every view), and the gear button retires into the Settings tab.
    - **No in-app back button anywhere** — tabs are the navigation, the way StoryGraph works. Settings' old "← Back" retires with the gear — _done, and the prop with it: it was kept "for any caller that opens Settings as a sub-screen", no such caller ever appeared, and it left a branch nobody rendered plus a stylesheet block nothing used._

      _**Amended: a left-to-right swipe goes back to Home**, from any destination, added on request after using the app on a phone. Still no back *button* — that rule holds for chrome — but tapping a teaser row now takes you somewhere, and a screen you were taken to should be one you can leave the way a phone expects._

      _**Home from anywhere, not "one tab left."** The first version stepped the tab order, so Settings swiped to History — a pager, treating three destinations as a sequence. You never arrive at Settings *from* History, so that is sideways being called back. Home is the root and the primary action; one destination is the whole rule and there is no order to memorise._

      _Built as a touch gesture rather than `history.pushState` per tab, deliberately. Pushing history entries is the more native answer — the platform's own back would then work, with muscle memory this code cannot see — but `useBackToClose` already owns an entry for the open sheet, and the close path it hangs off is the most defect-dense function in the codebase; interleaving a second `pushState` owner is the exact shape that has produced repeat bugs here. If tab history is ever wanted for real (deep links, PWA routing), do it there, once, and delete the gesture._

      _**Deliberately the only gesture in the app, and that is a feature.** What matters is that a gesture means one thing everywhere, not that there are several — and this one duplicates a visible control, so it satisfies WCAG 2.5.1 and 2.5.7 by construction, costs nothing if never discovered, and cannot be confused with a second gesture. Note it is Android-shaped rather than iOS-shaped: Material ships swipe-between-tabs, Apple's tab bars are tap-only and reserve swiping-back for drill-downs. Acceptable because the tab bar is right there either way._

      _Two more were considered and declined:_

      - _**Swipe a row to delete** — **rejected, not deferred.** The most idiomatic mobile gesture there is, and too easy to fire by accident on a list you are scrolling. Even paired with slice C's undo, the cost of a mistake is a logged shot gone and a snackbar you have seconds to notice. Deleting stays a deliberate, confirmed act._
      - _**Swipe between `Patterns` / `History`** (slice D) — not now. Idiomatic for a segmented control, but the segments do not exist yet, and a gesture built ahead of its surface is a guess._

      _**Swipe down to dismiss the sheet** is the one worth revisiting, and the direction matters: the sheet slides **up**, so its matching gesture is **down**, never right — a right-swipe would fight the animation it arrived on. Not built now because ✕, Escape and Android Back already cover it three ways, and a dismissal gesture is only worth having if the surface **follows your finger** so you can change your mind halfway. That is the real work — transform tracking, a cancel threshold, an interruptible animation. **The good moment is the UI overhaul**, which already commits to reworking this sheet, or whenever the same follow-the-finger machinery is wanted for the back swipe, which today jumps rather than tracks — the one way it is less than native._
    - **The Android system Back gesture closes an open sheet, and nothing more.** Back is an OS affordance that fires whether or not the app handles it, and its default is to leave the page — which, with the log sheet open, silently discards a half-filled form. One throwaway `pushState` entry while a sheet is open fixes exactly that. **Back from a tab still exits the app** (deliberately: tabs, not history, move you between destinations), and no URLs or router are involved, so real deep-link routing stays a PWA-phase decision this doesn't pre-empt. `Escape` stays too — the WAI-ARIA dialog requirement, and already how every other dialog here behaves.
  - [ ] **B½ — Logging model** (data model + log form; no charts). Lands *between* B and D because the roadmap's own rule is to stabilize the data model before building charts on it. Covers the **interval/cadence** concept + **frozen lateness** fields stored on the shot, the **None/Mild/Moderate/Severe pain chips**, the **"Any days you felt off?"** question, **symptom tags**, **how the site settled** (retrospective soreness duration + unabsorbed lump), and the **opt-in "Bleeding" category** with the full safety model above. Absorbs three previously mid-term items (improved mood encoding, symptom tagging, friendlier pain scale). Import/export schema and the DTO allowlist grow with it; all fields stay optional and PII-free.

    **Ships as several PRs, not one.** Six features in one slice is what turned slice B into a nine-defect epic, and this one touches the same sheet. The order, and what gates what:

    1. ~~**The Modal's Tab trap**~~ — **done** (PR #34), and ~~**Modal stacking**~~ — **done**, the step-6 gate. It went first because it was the only thing here that *blocked*: this slice adds grouped fields to the log sheet, a `fieldset disabled` is how one would be grouped, and that is precisely the case the old selector could not express. It left one constraint on the rest of this slice, which **step 1½ has since lifted**: a dialog opened from inside the sheet was not supported, because `inert` and `--sheet-h` were per-instance and unrefcounted and a second Back closed both dialogs. Modality is now derived from one registry (`src/utils/dialogStack.ts`) and overlay history entries carry their depth, verified in a browser with a real confirm wired into the log sheet — so **the soreness card may open a confirm from the sheet.** See the Tab-trap item in Short-Term for the measurements, and for the one thing that turned out not to be browser-verifiable.
    2. **Cadence** — `intervalDays` on the profile, with the planned date frozen onto each shot. **Landed** (`feat/cadence-planned-date`), pending the browser pass below. Three review rounds each found one HIGH, all in the seam between `schedule.ts` and `ShotForm`; the guard that came out of it is `scheduleAdherence.test.ts`, a 3060-case sweep of "does perfect adherence read 0?" across interval and shot-day changes.
    3. ~~**Pain chips**~~ — **done.** `painScore?: number` became `pain?: PainLevel`, renamed because `painScore: "moderate"` is a category wearing a number's name. Labelled **"Injection pain"**: the roadmap's "How the injection itself felt" contrasts correctly with the after-soreness question but never says *pain*, so the chips had to explain the label. `undefined` stays distinct from `"none"` — nobody answered versus it did not hurt — which is what the **Clear** control exists for, and it appears only once something is set. Native radios in a fieldset, so arrow keys work without hand-rolling them. Colour rises only as pain does, with None neutral rather than green (no pain is an absence, not a success, and green already means "that worked" here). The interim 0–10 validation went with the input: four chips cannot produce a value the schema would refuse.
    4. ~~**The cadence UI: weekday sets, asked rhythm-first**~~ — **done**
       (PR #38). `shotDay` became `shotDays`, the two interacting fields became
       three named rhythms, and one `CadencePicker` serves both surfaces —
       FirstShotCard 743 → 475 lines, JourneySettings 594 → 316.

       **The rhythm is STORED, which this entry did not anticipate.** It assumed
       `scheduleMode` could stay derived; the load path says otherwise. "Every 7
       days, counting from my last shot" and "every Wednesday" store identical
       values, and inference resolves that collision by returning `none` — so
       someone who picked a rhythm would get no planned dates and no
       explanation. It also separates "I'd rather not track this" from "never
       answered", which are the same absence and different facts.

       **The 3.5 message is written**, as this entry said it eventually would
       be: the twice-weekly user now has somewhere to go, so it points there
       rather than only refusing.

       **What the sweep caught that six review rounds did not.** `snapToWeekday`
       moves to the NEAREST match — right for establishing an anchor, wrong for
       locating the other days of a set. Anchored on Monday, Friday is 4 days
       forward, so "nearest" jumped to the PREVIOUS Friday and put that day's
       grid a week out of phase: Mon/Wed/Fri read "2 days later" on every Friday,
       forever, frozen at log time. Invisible at a one-week interval, where every
       Friday is a slot. A second round found the anchor could also snap forward
       PAST the first shot, putting that shot in the next grid week — Sun+Thu
       fortnightly read −3 on every perfectly adhered shot.

       Both came from extending `scheduleAdherence.test.ts`, and the second
       exposed that the sweep itself was blind: it always began the history on
       the week-order-first day, the one arrangement where the snap cannot
       overshoot. **Which day the history starts on is now an axis of it.** A
       sweep that samples one corner of its own space is the vacuous-guard
       pattern with arithmetic in front of it.

       **The two-row question was answered: one row.** Seven toggles at 27.7px
       (320px) and 38.3px (390px), 44px tall throughout — past WCAG 2.5.8,
       under Apple's 44×44, which is the trade Google Clock also makes. Capped at
       56px so they do not stretch into pills on a desktop.

       **`role="radiogroup"` was wrong and is now a `<fieldset>`.** ARIA permits
       a radiogroup only radios as children, and the revealed blocks put seven
       `aria-pressed` buttons, a number input, a chip group and an error inside
       it.

    5. ~~**"Any days you felt off?"**~~ — **done.** `mood?: string` became
       `offDays?: OffDaysPattern`, renamed rather than retyped for the reason
       `painScore` became `pain`: the stored value is a distribution across an
       interval, not a mood rating. Search narrowed to notes and the field
       joined pain as a facet, `mood` left `TextField` (where ManageValues had
       never surfaced it), and the chips get no colour ramp — pain rises
       none → severe so colour rising with it says something true, while these
       four are a pattern and a ramp would assert an order they do not have.

       **The deferral paid off, which is worth recording because deferring
       looked like drift at the time.** This was pulled out of the spine because
       every open question about it was a guess at vocabulary for an interval
       whose length the app did not yet track — the same reasoning the soreness
       card uses for its own buckets. Cadence made that length real, and the
       question it was waiting on had a real answer: the options blur at short
       intervals. Over three days "Most days" and "Right before" converge.
       The fix is NOT to vary the answers by interval, which would make one stored
       value mean different things for different users — the overloaded-value
       bug spread across a population instead of a field. One vocabulary, and
       the span line carries it: "Since your previous shot · 13 days",
       named rather than assumed because cadence runs 3–14 days and "this week"
       would be wrong for most people. The dates are deliberately not spelled
       out; every date this app shows is the stored ISO string.

       **Two limits accepted, both real and both found by checking the research
       rather than by reasoning.** The answers are neither mutually
       exclusive (off days both scattered *and* clustered fit two chips) nor
       collectively exhaustive. The second was closed by **adding the fifth
       answer** (`right-after`) rather than accepting it — see the bullet above
       for the evidence. The first remains: "off both early and late" fits two
       answers, so it stays a best-fit question. Multi-select is **not** the fix:
       two lit is a tally again, and the tally is what this design exists to beat.

       Retrospective recall is the standing trade, taken knowingly: the
       literature says people overestimate symptom **intensity and duration**,
       and this question asks for neither — only where the bad days sat. EMA
       would fix the bias and is rejected by design, since nothing here may
       create a pull toward daily logging.

    6. **Soreness and bleeding** — the two remaining product surfaces, each with its own safety model, each large enough to deserve its own review.

    Decided before implementation:

    - **The first shot has no lateness.** With `expected = previous shot + interval` there is no predecessor for shot #1, so lateness is `undefined` and renders as "first shot" — never "0 days late", which would state a fact we don't have.
    - **Changing your interval applies going forward only**; frozen values never move. Otherwise switching weekly → biweekly would retroactively repaint clean history with fabricated "7 days late" events.
    - **Pain is stored as an ordinal enum** (`none | mild | moderate | severe`), not a number a chip happens to write. It matches the mood scale, makes charts categorical rather than pretending to a precision nobody entered, and stops the schema claiming a 0–10 range no input can produce. **No `formatVersion` bump** — see the pre-GA rule below; an old backup failing to import is acceptable, and it fails with a field-level error rather than a clean "wrong version" message, which is the accepted cost.
    - **Intensity chips are text + colour, with emoji as a later enhancement.** Emoji render as a missing-glyph box on systems without an emoji font — the same reason `greeting.ts` stays plain text — so the accessible, always-legible version ships first and emoji get added only once checked on a real device. Colour alone is never the signal (WCAG 1.4.1); the label carries it.
    - ~~**The pain chips replace the numeric input, they don't sit beside it.**~~ _Done. Worth recording what the browser pass measured, since two of these took measuring rather than looking: all four chips fit one row from 375px up (62.3px of slack at 390px in the real sheet), every chip is at least 44x44 once `min-width` covers "Mild", and the chip row needs a `margin-top` rather than the container's `gap` because a `<legend>` is not a flex item — without it the group ran on 4px where every other field gets 4.8px. Tab and Shift+Tab both sweep the sheet with zero escapes, and the date and time inputs keep their four internal segment stops each way.

      **The group is one tab stop, and getting that right needed a fix I first measured wrongly.** `tabbable` reports EVERY radio as tabbable while none is checked — right about focusability, wrong about tab order — and since the trap owns Tab and rotates through that list, the four chips became four stops in the state every new shot starts in. My first browser pass reported one stop because I had selected a chip with the arrow keys before sweeping, so I measured the checked state and wrote the wrong claim here. `useFocusTrap` now hands Tab back to the browser for a radio in an unchecked group, the same shape as the segmented-input hatch beside it, with `beyond` computed past the whole group rather than past the current radio — the other members are in the list, so measuring from the current index would hand the browser a Tab that walks off an inert page. Measured after: one stop forward, one back, zero escapes._

      **The pain chips replace the numeric input, they don't sit beside it.** The `0–10` number field goes, and so does the interim validation slice B deliberately added around it (a whole-number 0–10 check with an inline message, there only because the native `step`/`max` constraints were silently killing the submit). Don't invest further in the numeric field — the chips are the model. `PAIN_BANDS` in `historyQuery.ts` was already written as None/Mild/Moderate/Severe for exactly this reason, so the History filter vocabulary does **not** change when the input does; only the mapping from chip to stored value needs deciding. The stored shape is the **ordinal enum** (decided above), not a 0–10 number a chip happens to write.
    - **The new mood question replaces free-text mood outright — no migration.** The project is pre-GA with no real users to protect, so the free-text `mood` field is retired rather than carried alongside forever. Cheaper model, one way to answer, no dual-read code path. Old free-text values are dropped — no bump, per the pre-GA rule below.
    - **Mood stops being text-searchable, and becomes a filter facet.** `searchShotText` currently matches notes *and* mood, behind a field labelled "Search notes and mood". Once the answer is one of four fixed values, substring search over it is pointless — so search narrows to notes, its label follows, and mood joins pain as a **facet in Filters**, which is where `PAIN_BANDS` already established that ordinals belong. This is a consequence, not a separate decision.
    - **`intervalDays` must be added to `pickProfileFields`** (`src/utils/backupDto.ts`) or it silently will not survive export and restore, and reverts to its default on the user's own backup. The DTO is an allowlist; this is the trap CLAUDE.md names explicitly, and cadence is the next field it applies to.
  - [ ] **C — Undo-able delete (accessible snackbar), History view only.** Soft-delete via in-memory tombstones — the real `deleteShot` fires on **commit** (timer end / navigate / unmount); Undo just drops the tombstone, so ordering is preserved. `UndoSnackbar`: `role="status"` + `aria-live="polite"`, **~7s**, **pause on hover/focus and never auto-dismiss while focused**, manual dismiss (commits), Undo (restores). Rapid multi-delete → one accumulating toast ("N deleted · Undo"), timer resets per delete, Undo restores the batch, flush commits all. Undo-over-confirm; WCAG 2.2.1 timing. **Delete lives only in History** — the Home teaser is read-only.
  - [ ] **D — Charts (the `Patterns` segment).** Aggregation selectors (adherence/on-time rate + streaks, mood trend/distribution, bleeding pattern, shot cadence, dose/ester overlays) built on slice A; introduces the **`Patterns` / `History` segmented control** and a compact summary chart on Home. Ships **tier 1 + tier 2** of the charts strategy (curated set + show/hide via the "What you see" surface); pin/reorder is a clean fast-follow, the guided builder stays deferred. Chart-rendering approach (lightweight hand-rolled SVG vs. a bundled lib) is decided *at* this slice — leaning lightweight SVG for the first simple charts to avoid a dependency and own the warm visual direction; semantic colors kept distinct from the accent. Insights need dozens of shots to mean anything, so **adherence is the early hero** and every chart has a graceful "not enough data yet" state.

    Decided before implementation — **show insights immediately, carry the uncertainty visibly.** Charts render from the very first shots rather than hiding behind a "not enough data yet" gate: a new user who sees nothing for three months has no reason to keep logging, and retention *is* the precondition for ever having good data. Honesty is preserved by **communicating confidence instead of withholding the view**:

    - Every chart shows **what it's based on** ("from 4 shots") plus a plain-language caveat while the sample is small ("patterns get more reliable after ~12 shots").
    - Wording scales with the sample: early on, insights are phrased as observations to notice, never as findings — and correlation-style statements stay **descriptive, never causal or medical**, at any N.
    - Sparse charts look sparse (visible points, no smoothing that invents a trend); we never draw a confident-looking line through three points.

    This follows the data-visualization principle of *showing uncertainty rather than suppressing data* — the failure mode to avoid is a confident-looking claim, not a small one.

    ~~**Known before you start: a single mistyped year can blow out every time axis.**~~ — _**done, ahead of this slice.** Found in a browser pass: `0999-01-01` and `9999-01-01` were both accepted and stored, then shown in History and written into the CSV a provider reads. Only sub-100 years were refused, and by accident — `civilDateParts` round-trips through `Date.UTC`, which maps years 0–99 into the 1900s, so the round-trip failed rather than any range check. Browsers actively invite the mistake: Chromium auto-fills the segments you have not typed, so `08` into a cleared field yields `0008-08-05`, reading `08` as the year._

        _The bound is **1900 to one year from today**, and it lives in `isPlausibleDate` / `toCivilDate` (`src/utils/civilDate.ts`) — the parse boundary, so the log form, the History filters and the greeting's start date all inherit it. **Import enforces the same rule** (`shotSchema`), because import is the other way into storage and a bound at the form alone is a bound with a door beside it. `civilDateParts` / `isRealDate` stay pure calendar validity, so date *math* on anything already stored keeps working. The date inputs carry matching `min`/`max` so the native picker cannot offer what the form would refuse — a hint, not the check, since the form is `noValidate`._

        _Two properties worth keeping if this is ever revisited: the upper bound only moves **forward**, so nothing already stored can be invalidated by the passage of time (the moving-baseline trap that bit `ShotDraft.date` does not apply); and an out-of-range date gets **its own message** ("Check the year…") rather than "not a real calendar date", which would be both wrong and useless for spotting the year as the slip. Future start dates stay supported — planning ahead is a real case — just bounded to a year out._

        _Post-GA this becomes a migration question: a backup containing an out-of-range date now fails import at field level, whole-file, rather than dropping the row. That is the same trade already recorded for slice B½'s pain enum, and it is free only while the pre-GA rule holds._

    **The tempting fix at this slice is still the wrong one.** Don't clamp the axis or drop outliers when drawing: that hides a wrong date rather than preventing one, and the entry stays wrong in export, in CSV, and in any doctor-facing summary.
- [ ] Improve UI layout and styling
- [ ] Add a **developer data viewer** (raw JSON, export panel)
- [ ] Strengthen accessibility (labels, keyboard navigation)

### Data Durability — the constraint the storage plan has to answer

Local-only storage is a privacy guarantee, not a persistence one, and the browser is allowed to delete it. This is the single biggest threat to the product's actual promise: there is no server copy, so anything the browser evicts is gone. Treat the items below as data-safety work, not polish.

- **On iOS/macOS Safari, an uninstalled site's storage is evicted after roughly 7 days without a first-party visit** (WebKit ITP applies to localStorage, IndexedDB, and friends). It counts days the browser is *used* without visiting, not calendar days. Someone injecting **weekly** sits exactly on that boundary — the worst possible fit for this app. Chrome, Firefox and Android don't do this, though every browser can still evict under storage pressure, and "clear website data" wipes everything anywhere.
- **Installing is what confers durability, not being a PWA.** A PWA still used in a Safari tab gets the same ITP treatment; the exemption comes from adding it to the home screen. So the PWA work below is only protective once the user actually installs, which makes the install prompt a data-safety feature and not a growth one. **Install helps twice over**: as well as the ITP exemption, browsers decide whether to grant persistent storage partly on engagement and on whether the app is installed ([web.dev](https://web.dev/articles/persistent-storage)), so installing also raises the odds `storage.persist()` succeeds. One action, two mechanisms. _Verify the current eviction window against WebKit's documentation before relying on the exact number — the policy has changed before._
- **Nothing is guaranteed even then.** An installed app's storage can still go when the device is low on space, and the user can always clear it. **Backup export is the only real recovery path**, which is why it should be easy to find, easy to repeat, and worth actively reminding people about rather than burying in Settings.
- **Ask for persistent storage** via `navigator.storage.persist()` where it exists (good support in Chrome/Firefox; Safari grants heuristically). Cheap, and it moves the app out of the "evict first" bucket.
- **Once storage is gone, it cannot be detected.** Anything the app might leave as a breadcrumb — a flag, a marker, a cookie — is swept in the same pass, so on the next launch a wiped install is indistinguishable from a brand-new one. There is no "it looks like you lost data" message to write. That is precisely why the defences below have to be preventive and visible *before* anything goes wrong; silent, unrecoverable, undetectable loss is the worst outcome this product can produce, and the user should never be the one who has to know about eviction policies.
- **Defend it in the UI, in this order:**
  1. **Offer to install, and say why** — "keeps your entries from being cleared", not a bare "add to home screen". The reason is the whole point.
  2. **Request `storage.persist()`** on launch where supported.
  3. **Warn while at risk — but contextually, not constantly.** `navigator.storage.persisted()` reports whether storage is durable. No mainstream app appears to surface this, so treat it as an extension rather than a settled pattern: a permanent banner would be alarm fatigue for something most people can only respond to by installing or exporting, which we already prompt. Show it at a moment of investment instead — once there are enough entries to be worth losing — and make it *actionable* (Install / Export) rather than informational.
  4. **Nudge a backup** when the last export is old, since export is the only recovery that survives everything.

- **Treat encrypted backup/sync as the durability answer, not a convenience.** Manual export is the stopgap; every comparable project converges on a synced or backed-up secondary copy for longevity. Ink & Switch's local-first manifesto makes *"the long now"* — your data still works in ten years — one of its seven ideals, and its model keeps the local copy primary **with servers holding secondary copies** ([Ink & Switch](https://www.inkandswitch.com/essay/local-first/)). Signal held out longest, refusing cloud backups on privacy grounds, and users lost their history when a device died; it eventually shipped Secure Backups with a user-held key ([Signal](https://signal.org/blog/introducing-secure-backups/)). The counter-example is [Euki](https://www.mozillafoundation.org/en/nothing-personal/euki-privacy-review/), which deliberately offers no cross-device backup and accepts that deleting the app erases everything — a legitimate stance, and worth noting this project is already more forgiving, since Euki does not appear to offer export at all while [drip](https://dripapp.org/privacy-policy.html) (local-only, with import/export) is closest to where we are.
- **A user-held key moves the loss risk, it does not remove it.** Signal's recovery key cannot be reset by Signal; Apple keeps E2EE backup opt-in specifically to limit permanent loss, because a provider that cannot read your data also cannot restore it ([EFF](https://www.eff.org/deeplinks/2025/05/back-it-back-it-let-us-begin-explain-encrypted-chat-backups)). So encrypted backup converts *"the browser ate my data"* into *"I lost my key"* — design for that from the start: make the key impossible to skip past, explain in plain words that nobody can recover it, and prefer a recoverable local export alongside rather than making the key the only path back.
- **Surface failed writes** — _queued as the **next PR** after the History slice; see Short-Term._ `useLocalStorage` currently swallows a write error to `console.warn` — so a save can appear to succeed, update the UI, and never persist. That happens for real: Safari private browsing throws on `setItem`, and quota-exceeded hits on a full device. With no server copy this is unrecoverable, and a console warning is a message to a developer who will never read it. Tell the user instead.
- **Capacitor moves storage off the webview** (Preferences/SQLite) precisely because the OS can clear webview storage. That swaps *which* fallible call sits behind `useLocalStorage`; it does not remove the need to handle failure, and the error-surfacing above is reused unchanged.

**On observability generally:** the usual tooling — crash reporters, metrics, session replay, tracing — is permanently out of scope here, not deferred. All of it means shipping facts about the user off the device, which the privacy model forbids and the product's whole pitch depends on refusing. The underlying need doesn't disappear, it relocates: **the user is the only observer**, so "how would anyone know this broke?" becomes "does the app say so, in the moment, in words the person can act on?" That is why silent failures rank as severe in this codebase — a save that quietly does nothing is this app's version of an outage. The developer-facing half is the planned **raw-JSON data viewer**: with no logs to inspect, the user's own export *is* the diagnostic artifact (and it carries health data plus a possible preferred name, so a redacted, structure-only variant is worth considering before asking anyone to send one).

### Mid-Term (v0.3 → v0.5)

- Add **PWA support** (installable, offline-first) — _also the durability fix for iOS: see **Data Durability** above. Pair it with an install prompt and `navigator.storage.persist()`, and treat install as the point at which the data becomes reasonably safe._

  **The install icons are listed here, but the PWA is not what gates them — the icon choice is.** Worth separating, because an earlier draft of this item filed them all under "PWA work" and that would send someone looking for a blocker that isn't there:

  - **`apple-touch-icon` needs no manifest and no service worker** — one `<link>` and one PNG. It could ship the day the artwork exists.
  - **The manifest's `icons` genuinely wait for the manifest**, since nothing reads them until one exists.

  Both are **deliberately deferred to a single pass after the icon is chosen** (see below). `public/icon.svg` is enough for a browser tab and nothing else, and each target fails *silently* without a raster — the app looks fine right up until someone installs it:

  - **iOS ignores SVG favicons and needs `<link rel="apple-touch-icon">` as a PNG (180×180).** With none, adding to the home screen has historically used **a screenshot of the page** as the icon — which here means a thumbnail of Home, greeting and recent shots included, sitting on the springboard. That is a discretion bug rather than a cosmetic one, and it would land on exactly the install this project otherwise pushes people toward for durability. _Verify the current behaviour against WebKit's documentation before relying on the screenshot detail — the fallback has changed before, and the fix (ship the PNG) is the same either way._
  - **Android/Chrome read the manifest's `icons`** — 192 and 512 PNGs — and apply an **adaptive-icon mask**, so a `purpose: "maskable"` variant is needed as well, with its content inside the safe zone (a centred circle of 80% diameter). The current mark runs close to its own edges and would be clipped, so the maskable copy needs **more padding**, not the same drawing at another size.
  - **`theme_color` / `background_color` in the manifest duplicate `<meta name="theme-color">` in `index.html`** (`#020617`, also the canvas gradient's first stop in `styles.css`). That is a set that must move together — the same trap as `SHEET_EXIT_MS` and its two stylesheet copies — so pin them with a test rather than hand-syncing three files.
  - **`name` / `short_name` are a discretion decision, not branding.** They are what the OS suggests when someone adds the app, and on iOS the user can edit that name as they add it — the one place the name half of disguise mode already works today. Decide the default deliberately, alongside that feature rather than apart from it.

  **What is settled here is the constraint, not the artwork — an earlier draft of this item said the icon was "already decided", and that was wrong.** The mark shipped today (`public/icon.svg`, the History tab's chart) is a **placeholder chosen to be safe rather than final**; the actual icon has not been picked. What holds regardless of what replaces it: the icon must not announce what the app tracks. Install is the moment that starts mattering — a tab is glanced at by its owner, a home screen is visible to whoever is nearby — so it belongs with the app-lock and disguise-mode items rather than with visual design.

  **Do the raster work in one pass, after the icon is chosen, not before.** The padding a maskable icon needs inside Android's safe circle is a property of the drawing, so exporting sizes from a placeholder means making that judgement twice. Nothing is lost by waiting: the icon has **no bearing on durability**, which comes from being installed, not from being pretty. Keeping a single source SVG until then is what makes the eventual export one mechanical step.
- Add the **storage-at-risk defences**: an install offer that explains *why*, a `storage.persist()` request, a dismissible banner while `storage.persisted()` is false, and a backup nudge when the last export is stale — _eviction is silent and undetectable after the fact, so these are the only protection there is (see **Data Durability**)_
- Add **encrypted backup files** with clear restore instructions — _the durability answer, not a convenience: manual export is the stopgap. Worth a gentle periodic reminder to export, since eviction is silent. Design the key-loss path up front (see **Data Durability**) — a key nobody can reset trades one kind of permanent loss for another._
- Add **app disguise mode**: change app icon and name for discretion (presets: clock, calculator, football, weather). This is a _cover_ (hides that the app is a T tracker), not encryption — it does not make the stored data unreadable. _Platform limit: iOS supports alternate app icons but not renaming an installed app, so the name half of this only works on Android and on a home-screen PWA (where the user names the shortcut themselves)._
- Add an **optional app lock**, off by default: gate opening the app behind the device biometric / passcode rather than a custom in-app password (nothing new for the user to forget, no recovery flow to build). Best implemented on the Capacitor build, where native biometric APIs exist; complements disguise mode (cover) and encrypted backups (secrecy).
- Add a short, skippable **first-run overview** pointing to what lives in Settings (journey/milestones, saved values, export/backup, and — once built — app lock), so privacy options are discoverable without a setup wall.

  **The cadence card is now genuinely skippable, which it was not** — added with the pain chips, and worth recording because it reverses a decision that had been argued the other way. The card carried no dismiss control on derive-don't-store reasoning: it goes when a shot exists, so there is nothing to remember. Sound, and about the wrong situation — someone who does not want to set a cadence has no shot to create either, so it sat on Home indefinitely with no way to say *not for me*, and a screen you cannot dismiss is not a skippable pointer. **`Done` stores `firstRunDone`** (in `pickProfileFields`, per the allowlist rule), and the shot-exists route survives beside it rather than being replaced, so an import still clears the card for free.

  Three things fell out of building it, all of which apply to whatever this overview becomes:

  - **It gets the app's confirm beat, not its words.** ✓ in green for `CONFIRM_MS`, then the card leaves over `SHEET_EXIT_MS` — the same pair a saved shot gets, because a surface that goes on the frame you pressed it reads as dropped rather than dismissed. **"Logged for you." is not borrowed**: a constant phrase is what makes it read as the app's voice, and spending it on a setup card is how it stops meaning anything.
  - **The dismissal is committed on the card's way out, not when the beat ends.** Leaving Home inside those 440ms — a tab tap, a back swipe — unmounts the card, and writing the flag from the timer meant the press was silently lost after the ✓ had already been shown. Pressing Done is the decision; the beat only owns what the card looks like.
  - **Focus is handed on only when the card was holding it.** The same commit path runs the hand-off, so an unconditional one pulled focus off the tab the user had just tapped. `firstRunDone` is not derivable from anything else, which is what separates it from the soreness card's open/closed state — that one really does follow from whether a later shot exists.
- ~~Add optional **symptom tagging** (fatigue, anxiety, headache)~~ — _pulled earlier into **slice B½ (Logging model)**; charts need the model first_
- Add a local-only **“shot due soon”** reminder — _builds on the interval/cadence concept introduced in slice B½_
- ~~Add improved **mood encoding** (emoji scale or fixed categories)~~ — _pulled earlier into **slice B½**, and it landed as neither: one question ("Any days you felt off?") whose five answers name a **pattern** rather than rating an intensity, so a single tap surfaces the pre-shot trough — or the peak-side one, which a rating could not distinguish from it at all_
- ~~Replace the raw 0–10 pain number with a friendlier **pain scale**: tappable None / Mild / Moderate / Severe chips~~ — _pulled earlier into **slice B½**; pain also demotes to a filter facet rather than a headline chart_
- Add PDF export with charts and summary information for healthcare conversations
- Improve desktop web layout for charts, review, exporting, and printing
- Add **theme support** (dark, light, high-contrast)

### Long-Term (Post-MVP)

- Optional **encrypted sync** for recovery and cross-device use — _the first time a lost device or an evicted browser store stops meaning lost data, and the point at which the project meets the local-first "long now" ideal of a secondary copy. Until it exists, backup export carries that entire burden alone (see **Data Durability**)._
- Native mobile packaging with Capacitor if app-store distribution is needed — _also the point at which storage stops being evictable at all (see the Capacitor note under Recommended Product Path); weigh that against the account trail a store install leaves_
- **Offer PWA and store builds side by side** as two distributions of one app, from one repo — _the store build is more durable and gets real notifications; the PWA leaves no account trail. Let people choose; don't retire either._
- App Store / Google Play distribution if native packaging is justified — _decide deliberately: a store listing ties the app to the user's Apple/Google account, which a home-screen PWA never does. Also check whether the OS's automatic cloud backup (iCloud / Google Drive) is on for app data, since that would quietly move health data off the device and contradict the local-only promise; both can be disabled per-app, at the cost of losing free device-restore._
- Native reminder support if PWA reminders are not reliable enough
- Cross-device sync using private keys
- StoryGraph-style **trend analytics** and correlations
- Optional **user-defined custom fields**
- Smarter visualizations (moving averages, streaks, clusters)

### Very Long-Term Outreach

If the app becomes stable enough for broader use, consider local, community-centered outreach rather than corporate-style marketing.

Ideas:

- Friendly posters with a QR code.
- Emphasize that the app is privacy-first, local-first, and does not use AI or sell data.
- Plain-language messaging about exports, backups, and user control.
- Possible line: "Made by a trans guy who loves charts."
- Invite trusted community feedback and help.
- Ask trans femmes to reach out if they want to help make an equivalent tracker for their needs.

---

## Contributing

Contributions must follow:

- `.github/CONTRIBUTING.md`
- `.github/CLA.md`
- `.github/CODE_OF_CONDUCT.md`
- `LICENSE`

Unapproved contributors should not open PRs modifying app logic or data flows.

---

## License

This project uses a **proprietary license** with restrictions specific to trans-safety, data privacy, and controlled collaboration.  
See `LICENSE` for full terms.
