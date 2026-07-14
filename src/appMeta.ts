// App-level constants used across the export/import backup format.

/** Stable identifier stamped into backup files so we can recognise our own. */
export const APP_NAME = "t-shot-tracker";

/**
 * Backup schema version. Bump only when the on-disk shape changes in a way that
 * needs migration on import. Independent of the app's release version.
 */
export const FORMAT_VERSION = 1;

/**
 * Human-facing app version, recorded in backups for support/debugging. Injected
 * from package.json at build time (see vite.config.ts), so there's no second
 * copy to keep in sync. The fallback only applies if this module is ever loaded
 * in a context that didn't apply the `define` (e.g. a bare tooling script).
 */
export const APP_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
