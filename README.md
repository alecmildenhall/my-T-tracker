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
  - Testosterone prep / carrier oil (optional)  
  - Pain score (optional)  
  - Mood (optional)  
  - Notes (optional)  

- View a list of past entries (sorted newest-first)
- Delete entries
- All data is stored locally on your device

---

# Next Steps / Upcoming Features

The HRT Shot Tracker is currently in an early MVP state. The roadmap below outlines the planned evolution of the project, designed to uphold trans-focused privacy, local-first data ownership, and long-term maintainability.
---

## High-Level Roadmap

### Short-Term (MVP → v0.2)

- Add the ability to **edit existing shot entries**
- Add **filters** (e.g., last 30 days, only high-pain days, only thigh injections)
- Add **simple charts** (pain over time, mood trends)
- Improve UI layout and styling
- Add a **developer data viewer** (raw JSON, export panel)
- Strengthen accessibility (labels, keyboard navigation)
 - Add support for selecting different testosterone preparations and carrier oils, and save the last-used selection for faster logging

### Mid-Term (v0.3 → v0.5)

- Add **CSV export** for clinical conversations
- Add **PWA support** (installable, offline-first)- Add **app disguise mode**: change app icon and name for discretion (presets: clock, calculator, football, weather)- Add optional **symptom tagging** (fatigue, anxiety, headache)
- Add a local-only **“shot due soon”** reminder
- Add improved **mood encoding** (emoji scale or fixed categories)
- Add **theme support** (dark, light, high-contrast)

### Long-Term (Post-MVP)

- Anonymous **encrypted syncing backend** (no user accounts required)
- End-to-end **encrypted exports / backup bundles**
- Cross-device sync using private keys
- StoryGraph-style **trend analytics** and correlations
- Optional **user-defined custom fields**
- Smarter visualizations (moving averages, streaks, clusters)

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
