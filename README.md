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

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) for development
- `localStorage` for data persistence (local-only)
- No backend, no analytics, no third-party tracking

Future phases may add:

- PWA support
- Encrypted backend for anonymous accounts
- Charts (e.g. Recharts) for visualizing trends

---

## Privacy & Safety

This project is built with the following constraints:

- **No PII by default**  
  The app does not ask for your name, email, or location.
- **Local-only storage (current phase)**  
  All data stays in your browser’s `localStorage`. There is **no server** and no network sync in the MVP.
- **No analytics or tracking**  
  No Google Analytics, no crash reporting, no third-party SDKs by default.
- **Trans-focused safety**  
  All features are designed to respect the safety of trans and gender-diverse users.

For details, see:

- `LICENSE`
- `CLA.md`
- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`

---

## Getting Started (Development)

```bash
# install dependencies
npm install

# start dev server
npm run dev

# build for production
npm run build

# preview production build
npm run preview
