// src/test/setup.ts
import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

// Render every test under StrictMode, matching main.tsx.
//
// Not a style choice — it closes a gap that shipped two real bugs in the History
// slice. StrictMode double-invokes effects and lazy initializers in development,
// and both bugs were caused by that: a cleanup racing its own remount (the log
// sheet closed the instant it opened) and an effect re-running to wipe restored
// state. Both passed the whole suite and were only visible by clicking the app.
// Testing what production renders under is the cheapest way to catch that class.
configure({ reactStrictMode: true })
