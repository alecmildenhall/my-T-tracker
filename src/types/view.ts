// src/types/view.ts

/**
 * The app's top-level destinations, one per bottom-nav tab.
 *
 * Deliberately plain typed state rather than a router: the app is a single
 * offline screen stack with no URLs to share and no deep links, so a routing
 * dependency would buy nothing. Browser-history/back-button integration is
 * deferred to the PWA phase, where an installed app makes it meaningful.
 */
export type View = "home" | "history" | "settings";
