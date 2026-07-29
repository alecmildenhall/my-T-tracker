// src/components/TabBar.tsx
// The three-destination bottom navigation: Home, History, Settings. Three is the
// count both Material (3–5 destinations) and Apple's HIG endorse — fewer wants a
// segmented control, more wants a drawer. Charts do not get a fourth tab: they
// share the History tab behind a Patterns/History segmented control (slice D).
//
// Icons are hand-rolled inline SVG rather than an icon library: no dependency and
// no CDN request, which the privacy model requires. They're aria-hidden because
// each button already carries a visible text label.
import React from "react";
import type { View } from "../types/view";

interface TabBarProps {
  view: View;
  onNavigate: (view: View) => void;
}

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

// A rising line chart: History is the "your data and trends" destination, which
// is what it becomes in full once charts land beside the list.
const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4v16h16" />
    <path d="m7 15 3.5-4.5 3 2.2L21 7" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.8H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.8-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.8H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
  </svg>
);

const TABS: { view: View; label: string; Icon: React.FC }[] = [
  { view: "home", label: "Home", Icon: HomeIcon },
  { view: "history", label: "History", Icon: HistoryIcon },
  { view: "settings", label: "Settings", Icon: SettingsIcon },
];

export const TabBar: React.FC<TabBarProps> = ({ view, onNavigate }) => (
  <nav className="tabbar" aria-label="Main">
    {TABS.map(({ view: target, label, Icon }) => {
      const current = view === target;
      return (
        <button
          key={target}
          type="button"
          className="tab"
          // aria-current marks the active destination for screen readers; the
          // accent colour alone would be a colour-only cue.
          aria-current={current ? "page" : undefined}
          onClick={() => onNavigate(target)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      );
    })}
  </nav>
);
