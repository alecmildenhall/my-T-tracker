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
  The default mode. Entries stay on the current device and nothing is uploaded. The tradeoff is that deleting the app, clearing browser data, or losing the device may delete entries unless the user exports a backup.

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

### Short-Term (MVP → v0.2)

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
- [ ] _Engineering (lands first):_ **branded `CivilDate` type** — its own small, behavior-preserving PR *before* the History & Charts epic below (cheapest to do before more date logic piles on). `YYYY-MM-DD` values are produced only by the shared civil-date parser at each trust boundary (import, form input, storage read) and consumed by all date logic (milestones, greeting, shot-day, filters, charts). Makes invalid dates unrepresentable downstream (no re-validation) and retires string-typed date handling in `ShotEntry.date` / `Profile.startDate`.
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
  - [ ] **B — Navigation + Home restructure + History view (browse + edit).** View state grows to `home | history | settings` (typed state, **no router dependency**; History-API/back-button deferred to the PWA phase), surfaced as the **3-tab bottom bar** above. Home = greeting + log form + recent teaser (last N, **read-only**) keeping *Log a shot* the primary action. History = full list + **filters** (date range, site, position, pain, ester) + **text search** + a **"Load more"** control (pagination chosen over infinite-scroll/virtualization — accessible and right-sized for hundreds–low-thousands of entries; windowing can drop in later if measurement demands). **Edit lives here** (tapping a shot opens the existing form in edit mode) — "read-only" in this epic means *no destructive delete yet*, which lands with undo in slice C, not a regression of today's edit. No segmented control yet: it arrives in D when there's a Patterns view to switch to.

    Decided before implementation:

    - **Home is glanceable**: the form collapses behind a prominent **"Log a shot"** button that opens it as a **full-screen sheet**, so greeting + button + teaser all fit above the fold (the pattern Daylio/Clue/Medisafe use). An always-open inline form would push the teaser ~2 screens down on a phone, making "recent shots" effectively invisible.
    - **Editing from History** opens the same **full-screen sheet** over the list, preserving scroll position and active filters underneath.
    - **Filters are collapsible** behind a `Filters · N` toggle whose badge counts active facets (so a filter is never silently on); the **search field stays visible**. Search filters live with a **~200ms debounce** — everything is in-memory, so instant feedback is free — and result counts announce via `aria-live`.
    - **Teaser = last 3**; **"Load more" page = 20**. Single constants, easy to tune.
    - **Filters/search persist in memory for the session but are never written to storage** — returning from Home keeps your filter, a fresh launch never opens into a stale filtered state (also a mild safety win).
    - **The app always opens on Home**, never "last tab used": logging is the primary action, it's predictable, and reopening never lands on charts/bleeding data in public — which compounds with the planned disguise mode and app lock.
    - **The header slims to a per-view title**; the tagline and privacy note move out of the repeated chrome (~100px of phone screen reclaimed on every view), and the gear button retires into the Settings tab.
  - [ ] **B½ — Logging model** (data model + log form; no charts). Lands *between* B and D because the roadmap's own rule is to stabilize the data model before building charts on it. Adopts: the **5-point ordinal mood** with per-interval framing, the **interval/cadence** concept + **frozen lateness** fields stored on the shot, **symptom tags**, the **None/Mild/Moderate/Severe pain chips**, and the **opt-in "Bleeding" category** with the full safety model above. Absorbs three previously mid-term items (improved mood encoding, symptom tagging, friendlier pain scale). Import/export schema and the DTO allowlist grow with it; all fields stay optional and PII-free.

    Decided before implementation:

    - **The first shot has no lateness.** With `expected = previous shot + interval` there is no predecessor for shot #1, so lateness is `undefined` and renders as "first shot" — never "0 days late", which would state a fact we don't have.
    - **Changing your interval applies going forward only**; frozen values never move. Otherwise switching weekly → biweekly would retroactively repaint clean history with fabricated "7 days late" events.
    - **Ordinal mood replaces free-text mood outright — no migration.** The project is pre-GA with no real users to protect, so the free-text `mood` field is retired rather than carried alongside the scale forever. Cheaper model, one way to log a mood, no dual-read code path. Old free-text values are dropped (and `formatVersion` bumps so a stale backup fails loudly at import instead of silently half-loading).
  - [ ] **C — Undo-able delete (accessible snackbar), History view only.** Soft-delete via in-memory tombstones — the real `deleteShot` fires on **commit** (timer end / navigate / unmount); Undo just drops the tombstone, so ordering is preserved. `UndoSnackbar`: `role="status"` + `aria-live="polite"`, **~7s**, **pause on hover/focus and never auto-dismiss while focused**, manual dismiss (commits), Undo (restores). Rapid multi-delete → one accumulating toast ("N deleted · Undo"), timer resets per delete, Undo restores the batch, flush commits all. Undo-over-confirm; WCAG 2.2.1 timing. **Delete lives only in History** — the Home teaser is read-only.
  - [ ] **D — Charts (the `Patterns` segment).** Aggregation selectors (adherence/on-time rate + streaks, mood trend/distribution, bleeding pattern, shot cadence, dose/ester overlays) built on slice A; introduces the **`Patterns` / `History` segmented control** and a compact summary chart on Home. Ships **tier 1 + tier 2** of the charts strategy (curated set + show/hide via the "What you see" surface); pin/reorder is a clean fast-follow, the guided builder stays deferred. Chart-rendering approach (lightweight hand-rolled SVG vs. a bundled lib) is decided *at* this slice — leaning lightweight SVG for the first simple charts to avoid a dependency and own the warm visual direction; semantic colors kept distinct from the accent. Insights need dozens of shots to mean anything, so **adherence is the early hero** and every chart has a graceful "not enough data yet" state.

    Decided before implementation — **show insights immediately, carry the uncertainty visibly.** Charts render from the very first shots rather than hiding behind a "not enough data yet" gate: a new user who sees nothing for three months has no reason to keep logging, and retention *is* the precondition for ever having good data. Honesty is preserved by **communicating confidence instead of withholding the view**:

    - Every chart shows **what it's based on** ("from 4 shots") plus a plain-language caveat while the sample is small ("patterns get more reliable after ~12 shots").
    - Wording scales with the sample: early on, insights are phrased as observations to notice, never as findings — and correlation-style statements stay **descriptive, never causal or medical**, at any N.
    - Sparse charts look sparse (visible points, no smoothing that invents a trend); we never draw a confident-looking line through three points.

    This follows the data-visualization principle of *showing uncertainty rather than suppressing data* — the failure mode to avoid is a confident-looking claim, not a small one.
- [ ] Improve UI layout and styling
- [ ] Add a **developer data viewer** (raw JSON, export panel)
- [ ] Strengthen accessibility (labels, keyboard navigation)

### Mid-Term (v0.3 → v0.5)

- Add **PWA support** (installable, offline-first)
- Add **encrypted backup files** with clear restore instructions
- Add **app disguise mode**: change app icon and name for discretion (presets: clock, calculator, football, weather). This is a _cover_ (hides that the app is a T tracker), not encryption — it does not make the stored data unreadable.
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

- Optional **encrypted sync** for recovery and cross-device use
- Native mobile packaging with Capacitor if app-store distribution is needed
- App Store / Google Play distribution if native packaging is justified
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
