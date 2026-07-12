# HRT Shot Tracker

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
- `CLA.md`  
- `CONTRIBUTING.md`  
- `CODE_OF_CONDUCT.md`  

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
  - Pain score (optional)  
  - Mood (optional)  
  - Notes (optional)  

- View a list of past entries (sorted newest-first)
- Edit existing entries
- Delete entries
- All data is stored locally on your device

---

# Next Steps / Upcoming Features

The HRT Shot Tracker is currently in an early MVP state. The roadmap below outlines the planned evolution of the project, designed to uphold trans-focused privacy, local-first data ownership, and long-term maintainability.

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

Practically, this means doing the overhaul after the important data features are in place: testosterone prep / carrier oil, optional T start date, optional display name, basic milestones, and export/import.

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

- Add support for selecting different testosterone preparations and carrier oils, and save the last-used selection for faster logging
- Add optional testosterone start date for HRT milestones
- Add optional display name / preferred name for affirming milestone messages
- Add milestone logic for three-month intervals during year one, then six-month intervals after that
- Add a gentle post-log celebration, such as confetti or another feel-good animation
- Redesign the UI around a phone-first, warm, readable, non-corporate visual direction
- Add **CSV export** for clinical conversations
- Add **JSON backup export/import** so users can move or restore local data
- Add **filters** (e.g., last 30 days, only high-pain days, only thigh injections)
- Add **simple charts** (pain over time, mood trends)
- Improve UI layout and styling
- Add a **developer data viewer** (raw JSON, export panel)
- Strengthen accessibility (labels, keyboard navigation)

### Mid-Term (v0.3 → v0.5)

- Add **PWA support** (installable, offline-first)
- Add **encrypted backup files** with clear restore instructions
- Add **app disguise mode**: change app icon and name for discretion (presets: clock, calculator, football, weather)
- Add optional **symptom tagging** (fatigue, anxiety, headache)
- Add a local-only **“shot due soon”** reminder
- Add improved **mood encoding** (emoji scale or fixed categories)
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

- `CONTRIBUTING.md`
- `CLA.md`
- `CODE_OF_CONDUCT.md`
- `LICENSE`

Unapproved contributors should not open PRs modifying app logic or data flows.

---

## License

This project uses a **proprietary license** with restrictions specific to trans-safety, data privacy, and controlled collaboration.  
See `LICENSE` for full terms.
