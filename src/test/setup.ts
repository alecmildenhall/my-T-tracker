// src/test/setup.ts
import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// Render every test under StrictMode, matching main.tsx.
//
// Not a style choice — it closes a gap that shipped two real bugs in the History
// slice. StrictMode double-invokes effects and lazy initializers in development,
// and both bugs were caused by that: a cleanup racing its own remount (the log
// sheet closed the instant it opened) and an effect re-running to wipe restored
// state. Both passed the whole suite and were only visible by clicking the app.
// Testing what production renders under is the cheapest way to catch that class.
configure({ reactStrictMode: true });

// jsdom implements no layout, and therefore no `scrollIntoView` — the method is
// absent entirely, not a no-op. Any component that positions an element after
// focusing it throws `TypeError: not a function` here while working in every
// real browser, so the gap shows up as a crashing test rather than a missing
// behaviour. Stubbed so components can call the standard DOM API unconditionally
// instead of carrying a `?.` that exists only to appease the test environment.
//
// What this cannot check is where the element ended up. That stays a browser
// pass, alongside the other things jsdom cannot see (`inert`, CSS, layout).
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
