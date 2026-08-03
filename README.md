# T-Shot Tracker

A privacy-focused web app for logging testosterone (HRT) injections and how they *feel* — pain, mood, and notes — designed with trans and gender-diverse users’ safety in mind.

> **Status:** Early MVP. UI and functionality are limited and will evolve over time.

---

## Purpose

- Track when you take your testosterone shots.
- Capture context around each shot: pain, mood, notes.
- Over time, support visualizations (StoryGraph-style) to help you see patterns and talk with your healthcare providers.

This project is explicitly designed around **trans user safety and privacy**.

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

- [ ] **NEXT PR — surface storage write failures.** `useLocalStorage` catches a failed `setItem` and drops it into `console.warn`, so the in-memory state updates, the UI shows the shot saved, and nothing persists. This is not hypothetical: Safari private browsing throws on `setItem`, and a full device hits quota. With no server copy the entry is simply gone, and the only report of it went to a console the user will never open — the exact silent-failure class that every severe bug in slice B turned out to be. The platform guidance says the same thing ([web.dev](https://web.dev/articles/persistent-storage)): wrap storage writes and handle the failure.

  Its own small PR rather than riding along with feature work, and worth doing **before** slice B½ starts adding fields, since every new field is another thing that can silently fail to save. Phase-proof too: `useLocalStorage` is the single write boundary, so this survives the PWA, the Capacitor swap to native storage, and encrypted sync — only the call behind it changes.

- [x] _Engineering:_ **stop overloading `""` in `ShotDraft.date`** — _done, but not the way this item proposed._ The draft used `""` for both "untouched, follow today" and "the user cleared the field", written in one place and read in another, with only a hand-kept mode check holding the two readers in step. Twice they fell out of step and silently re-dated a logged shot: once by a day, and then — after a first fix closed only the write side — by **months**, moving a shot logged in May to today.

  This item proposed giving "follow today" its own carrier (`CivilDate | null`, or a `followToday` flag). That was built, and then **deleted**, because the better question turned out to be whether follow-today should exist at all. It shouldn't: a draft only exists once something has been typed, so every draft is deliberate work about a particular shot — and you log a shot *after* taking it, so an entry started yesterday is about yesterday. Re-deriving slid today's date under anyone finishing an interrupted entry, and today looks plausible enough that nothing catches the eye.

  **The date is now frozen like every other field**, and `ShotDraft.date` is a plain `string` with one meaning. Deleting the behaviour removed the bug class outright rather than carrying a carrier to manage it — worth remembering as a pattern: the cheapest fix for an ambiguous encoding is sometimes to stop needing the encoding.

  Freezing exposed a second question that took **six review rounds** to answer: **"has the user entered a date?"** Every other field answers it with "is it empty?", but a date is required and always populated, so it has no such tell.

  Every attempt to *derive* the answer failed, each in its own way, and each fix caused the next bug. Compared against today's default: a draft carried past midnight can never match again, so an emptied draft stays dirty forever. Against the restored draft's own date: a draft whose only content *is* a backdate reads as clean, and the next dismissal discards it. As a boolean "was it touched": nudging the date and putting it back leaves the form dirty forever. As a boolean measured against today: correcting a mis-dated shot **to** today reads as no change, and dismissal throws the correction away.

  What finally worked was storing the **reference** rather than an answer derived from it. `ShotDraft.dateBaseline` holds the value the field would still show untouched — today for a fresh form, the shot's own date when editing, today again after "Clear form" — and the date counts as input exactly when it differs. One reference, travelling with the draft, that nothing else can disagree with.

  **The lesson is the one worth carrying into B½,** which adds cadence and frozen lateness — more fields whose meaning depends on when they were computed: a boolean is an answer computed against a baseline at one moment and read against another later; if either can move, they will eventually disagree. Store the baseline, not the conclusion.

  Two limits are accepted rather than fixed, both needing a sheet held open across midnight, neither able to write a wrong date to a saved shot: re-picking the date already displayed reads as no change, and a draft whose chosen date has since become today still reports unsaved input (its "Clear form" link is suppressed so it cannot invite a pointless tap). Fixing either reintroduces one of the bugs above — verified, not assumed.

- [ ] _Engineering:_ **one owner for focus hand-off, plus a test guard.** Focus is currently moved by hand at five separate sites — `Modal`'s restore/fallback, `HistoryView`'s `focusRowAt` and its Clear-all hand-off, `App`'s title fallback, and `ShotForm`'s reset — and that seam produced **nine** defects in slice B: focus dropped to `<body>` from three different controls, the hand-offs were invisible (no CSS rule covered programmatically focused elements, so focus moved with nothing on screen changing), the trap was escapable by clicking the dialog's padding, and the skip link's URL fragment poisoned focus restoration for the entire session.

  The pattern worth recording: **several were introduced by the previous round's fix.** Each fix adds another hand-rolled site, and every new site can collide with the shared machinery — the Tab trap, `inert`, the restore order. That is what turns a fix into the next bug, and it is why consolidating beats another round of patching.

  Pair it with a shared assertion that **focus is never left on `<body>` after an interaction**, applied across flows rather than case by case. That single check would have caught four of the nine before review. Note jsdom can't see `inert` and doesn't process CSS, so the ring visibility half stays a browser check.

- [x] Add optional testosterone start date for HRT milestones — _Settings → Your journey; future start dates allowed (planning ahead reads as "not started yet")_
- [x] Add optional display name / preferred name for affirming milestone messages
- [x] Add milestone logic for three-month intervals during year one, then six-month intervals after that — _labels read "1 year 3 months", never months-only_
- [ ] Add a gentle post-log celebration, such as confetti or another feel-good animation
- [x] Add an **everyday greeting** at the top of the log screen using the preferred name ("Hi, Lou"). Name-optional: with no name it falls back warmly ("Welcome back") and never renders a dangling "Hi, ". Local-weekday/civil-date based, log-view only (not Settings or the milestone banner).
- [x] Add an optional **"shot day"** setting + a celebratory **"Happy shot day, Lou!"** greeting on that day. Weekday-based to start (a one-line local-weekday compare), **pre-filled from the user's most common logged weekday** so most users never touch it. Genuinely optional: a "No shot day" choice means **no shot-day greeting at all** — no fallback guessing. Seeds the later "shot due soon" reminder; interval/every-N-day scheduling is deferred to that feature. Lives in Settings → "Your journey" for now.
- [x] Ensure greetings and milestones are **name-optional** end to end: with only a shot day set, still show "Happy shot day!"; with only a start date set, still show "Congrats on 1 year on T!" — the preferred name only personalizes the message, it's never required to receive one.
- [x] Add saved custom injection site/position options for faster repeated logging — _reuse chips on the log form plus a Settings → Manage saved values panel to rename/remove them_
- [ ] Redesign the UI around a phone-first, warm, readable, non-corporate visual direction
- [x] Add **CSV export** for clinical conversations — _Settings → Your data, formula-injection-safe, RFC 4180 quoted_
- [x] Add **JSON backup export/import** so users can move or restore local data — _versioned envelope (shots + optional profile); import validates against a strict schema and downloads a safety backup before replacing_
- [x] _Engineering (landed first, PR #25):_ **branded `CivilDate` type** — `YYYY-MM-DD` values are minted only through `toCivilDate` (the smart constructor) and consumed by the date logic (milestones, greeting, shot-day, filters), so an untrusted string is parsed **once**, at the trust boundary, instead of re-checked everywhere downstream.

  **A boundary brand, deliberately not a model brand.** `ShotEntry.date` and `Profile.startDate` stay `string` on purpose: consumers compile unchanged, serialization is untouched, and there's no `{ date: "..." }` construction churn. Worth stating plainly, because this item's original wording promised the opposite ("retires string-typed date handling in `ShotEntry.date` / `Profile.startDate`") and stayed unticked after it shipped — which later got it cited as still-pending work, and as a fix for a bug it does not address.

  **The limit it leaves.** The brand stops at the boundary and never reaches *form* state. `ShotDraft.date` is a raw input string by necessity — a half-typed date isn't a valid date — and that is exactly where both of slice B's date defects lived. Branding the model would not have prevented either. See the (now closed) draft-sentinel item in Short-Term for how they were actually fixed.
- [ ] **History & Charts epic** (local-first, phone-first) — progressive-disclosure information architecture: Home shows a *recent-shots teaser* + "See all"; a dedicated **History** tab holds the full, filterable, searchable list **and** the charts; charts summarize trends. The unbounded list is never the main view. Built as thin slices, in order, after the CivilDate PR:

  **Shape of the whole epic (decided up front, so each slice builds toward it):**

  - **Navigation: a 3-tab bottom bar** — Home (house), History (**graph icon**, StoryGraph-style), Settings (gear). Three is the sweet spot both Material (3–5 destinations) and Apple's HIG endorse; a 4th tab would be worse, not better. Icons are hand-rolled inline SVG — no icon library, no CDN (privacy rule).
  - **Charts and the list share the History tab**, split by a **segmented control** rather than stacked in one long scroll (the Apple Health *Summary / Browse* pattern). Stacking rich charts above a long list is what actually creates clutter on a phone; a toggle keeps each sub-view clean while holding the tab count at three.
  - **Segment naming: `Patterns` / `History`**, with **Patterns first and selected by default.** "Patterns" comes from this project's own stated goal — helping you *see patterns* — and reads warm and insight-led rather than clinical ("Charts") or cool ("Browse").
  - **Home teaser is read-only.** Tapping through to edit happens in the History tab.

  **What we actually track (the signals the charts are built on).** Deliberately *not* pain-as-headline: pain is the easiest thing to log and the least interesting thing to chart. Industry pattern across the apps worth emulating (Daylio, Clue, Medisafe, Apple Health) is **fast ordinal scales + categorical tags**, with correlation — not raw numbers — as the payoff.

  - **Adherence & lateness** — the objective early hero (meaningful by ~shot 3, while trend charts still say "not enough data yet"). Needs a lightweight **interval/cadence** concept (expected = previous shot's date + interval), defaulted from the user's most common gap the way shot-day is defaulted from their most common weekday. **Lateness is frozen at log time**: the expected date and days-late are computed at the boundary and **stored on the shot**, never recomputed from a later-changed schedule — so adjusting your cadence going forward never rewrites history. Both stay **editable in the History tab** to correct genuine mistakes.
  - **Mood — ordinal, per-interval.** Replace free-text mood with a **5-point scale** (awful → great, emoji/color, one tap; Daylio's proven model) framed as *"how the week since your last shot felt."* That framing resolves the daily-logging tension: no new logging cadence, a naturally shot-spaced series, and it lines up with lateness for correlation. A shot tracker should not become a daily mood journal.
  - **Bleeding & cramps — optional, opt-in, neutrally named** (see the safety model below).
  - **Pain — demoted to a secondary filter/facet.** Still logged (useful per-shot and for a *site-rotation* view: "does my left glute always hurt more?"), but not a headline trend. With the planned None/Mild/Moderate/Severe chips, **pain filtering is by ordinal category, not a 0–10 numeric range.**
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
    - **No in-app back button anywhere** — tabs are the navigation, the way StoryGraph works. Settings' old "← Back" retires with the gear.
    - **The Android system Back gesture closes an open sheet, and nothing more.** Back is an OS affordance that fires whether or not the app handles it, and its default is to leave the page — which, with the log sheet open, silently discards a half-filled form. One throwaway `pushState` entry while a sheet is open fixes exactly that. **Back from a tab still exits the app** (deliberately: tabs, not history, move you between destinations), and no URLs or router are involved, so real deep-link routing stays a PWA-phase decision this doesn't pre-empt. `Escape` stays too — the WAI-ARIA dialog requirement, and already how every other dialog here behaves.
  - [ ] **B½ — Logging model** (data model + log form; no charts). Lands *between* B and D because the roadmap's own rule is to stabilize the data model before building charts on it. Adopts: the **5-point ordinal mood** with per-interval framing, the **interval/cadence** concept + **frozen lateness** fields stored on the shot, **symptom tags**, the **None/Mild/Moderate/Severe pain chips**, and the **opt-in "Bleeding" category** with the full safety model above. Absorbs three previously mid-term items (improved mood encoding, symptom tagging, friendlier pain scale). Import/export schema and the DTO allowlist grow with it; all fields stay optional and PII-free.

    Decided before implementation:

    - **The first shot has no lateness.** With `expected = previous shot + interval` there is no predecessor for shot #1, so lateness is `undefined` and renders as "first shot" — never "0 days late", which would state a fact we don't have.
    - **Changing your interval applies going forward only**; frozen values never move. Otherwise switching weekly → biweekly would retroactively repaint clean history with fabricated "7 days late" events.
    - **Pain is stored as an ordinal enum** (`none | mild | moderate | severe`), not a number a chip happens to write. It matches the mood scale, makes charts categorical rather than pretending to a precision nobody entered, and stops the schema claiming a 0–10 range no input can produce. **No `formatVersion` bump** — see the pre-GA rule below; an old backup failing to import is acceptable, and it fails with a field-level error rather than a clean "wrong version" message, which is the accepted cost.
    - **Intensity chips are text + colour, with emoji as a later enhancement.** Emoji render as a missing-glyph box on systems without an emoji font — the same reason `greeting.ts` stays plain text — so the accessible, always-legible version ships first and emoji get added only once checked on a real device. Colour alone is never the signal (WCAG 1.4.1); the label carries it.
    - **The pain chips replace the numeric input, they don't sit beside it.** The `0–10` number field goes, and so does the interim validation slice B deliberately added around it (a whole-number 0–10 check with an inline message, there only because the native `step`/`max` constraints were silently killing the submit). Don't invest further in the numeric field — the chips are the model. `PAIN_BANDS` in `historyQuery.ts` was already written as None/Mild/Moderate/Severe for exactly this reason, so the History filter vocabulary does **not** change when the input does; only the mapping from chip to stored value needs deciding. The stored shape is the **ordinal enum** (decided above), not a 0–10 number a chip happens to write.
    - **Ordinal mood replaces free-text mood outright — no migration.** The project is pre-GA with no real users to protect, so the free-text `mood` field is retired rather than carried alongside the scale forever. Cheaper model, one way to log a mood, no dual-read code path. Old free-text values are dropped — no bump, per the pre-GA rule below.
  - [ ] **C — Undo-able delete (accessible snackbar), History view only.** Soft-delete via in-memory tombstones — the real `deleteShot` fires on **commit** (timer end / navigate / unmount); Undo just drops the tombstone, so ordering is preserved. `UndoSnackbar`: `role="status"` + `aria-live="polite"`, **~7s**, **pause on hover/focus and never auto-dismiss while focused**, manual dismiss (commits), Undo (restores). Rapid multi-delete → one accumulating toast ("N deleted · Undo"), timer resets per delete, Undo restores the batch, flush commits all. Undo-over-confirm; WCAG 2.2.1 timing. **Delete lives only in History** — the Home teaser is read-only.
  - [ ] **D — Charts (the `Patterns` segment).** Aggregation selectors (adherence/on-time rate + streaks, mood trend/distribution, bleeding pattern, shot cadence, dose/ester overlays) built on slice A; introduces the **`Patterns` / `History` segmented control** and a compact summary chart on Home. Ships **tier 1 + tier 2** of the charts strategy (curated set + show/hide via the "What you see" surface); pin/reorder is a clean fast-follow, the guided builder stays deferred. Chart-rendering approach (lightweight hand-rolled SVG vs. a bundled lib) is decided *at* this slice — leaning lightweight SVG for the first simple charts to avoid a dependency and own the warm visual direction; semantic colors kept distinct from the accent. Insights need dozens of shots to mean anything, so **adherence is the early hero** and every chart has a graceful "not enough data yet" state.

    Decided before implementation — **show insights immediately, carry the uncertainty visibly.** Charts render from the very first shots rather than hiding behind a "not enough data yet" gate: a new user who sees nothing for three months has no reason to keep logging, and retention *is* the precondition for ever having good data. Honesty is preserved by **communicating confidence instead of withholding the view**:

    - Every chart shows **what it's based on** ("from 4 shots") plus a plain-language caveat while the sample is small ("patterns get more reliable after ~12 shots").
    - Wording scales with the sample: early on, insights are phrased as observations to notice, never as findings — and correlation-style statements stay **descriptive, never causal or medical**, at any N.
    - Sparse charts look sparse (visible points, no smoothing that invents a trend); we never draw a confident-looking line through three points.

    This follows the data-visualization principle of *showing uncertainty rather than suppressing data* — the failure mode to avoid is a confident-looking claim, not a small one.

    **Known before you start: a single mistyped year can blow out every time axis, and the fix does not belong in the chart.** The date field has no sanity bound on the year, and browsers actively invite the mistake — Chromium auto-fills the segments you have not typed yet, so typing `08` into a cleared field yields `0008-08-05`, reading `08` as the *year*. That particular value happens to be rejected on save, but only by accident: `civilDateParts` round-trips through `Date.UTC`, which maps years 0–99 into the 1900s, so the check fails and the user sees the inline error. **A four-digit year like `0999` passes cleanly** and would sit in storage until a chart tried to plot it, at which point one entry stretches the axis across a millennium and flattens every real trend to a single pixel.

    The tempting fix at this slice is to clamp the axis or drop outliers when drawing. Don't — that hides a wrong date rather than preventing one, and the entry is still wrong in export, in CSV, and in any doctor-facing summary. Add the bound at the parse boundary instead (`toCivilDate`, so every consumer inherits it), with a plausible range for a human HRT log. Cheap to do at any point before D; it is filed here because this is where the consequence finally shows up.
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
- Add the **storage-at-risk defences**: an install offer that explains *why*, a `storage.persist()` request, a dismissible banner while `storage.persisted()` is false, and a backup nudge when the last export is stale — _eviction is silent and undetectable after the fact, so these are the only protection there is (see **Data Durability**)_
- Add **encrypted backup files** with clear restore instructions — _the durability answer, not a convenience: manual export is the stopgap. Worth a gentle periodic reminder to export, since eviction is silent. Design the key-loss path up front (see **Data Durability**) — a key nobody can reset trades one kind of permanent loss for another._
- Add **app disguise mode**: change app icon and name for discretion (presets: clock, calculator, football, weather). This is a _cover_ (hides that the app is a T tracker), not encryption — it does not make the stored data unreadable. _Platform limit: iOS supports alternate app icons but not renaming an installed app, so the name half of this only works on Android and on a home-screen PWA (where the user names the shortcut themselves)._
- Add an **optional app lock**, off by default: gate opening the app behind the device biometric / passcode rather than a custom in-app password (nothing new for the user to forget, no recovery flow to build). Best implemented on the Capacitor build, where native biometric APIs exist; complements disguise mode (cover) and encrypted backups (secrecy).
- Add a short, skippable **first-run overview** pointing to what lives in Settings (journey/milestones, saved values, export/backup, and — once built — app lock), so privacy options are discoverable without a setup wall.
- ~~Add optional **symptom tagging** (fatigue, anxiety, headache)~~ — _pulled earlier into **slice B½ (Logging model)**; charts need the model first_
- Add a local-only **“shot due soon”** reminder — _builds on the interval/cadence concept introduced in slice B½_
- ~~Add improved **mood encoding** (emoji scale or fixed categories)~~ — _pulled earlier into **slice B½**: a 5-point ordinal scale, framed per-interval_
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
