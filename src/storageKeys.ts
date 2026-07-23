/**
 * Version of the on-disk shape of the localStorage stores (the shot array and
 * the profile object). It is carried in the key namespace — the `v${N}` segment
 * of each key below — rather than inside each value, because the shots store is a
 * bare JSON array with nowhere clean to stamp a field. Data under a `:v1:` key is
 * therefore unambiguously v1; there is no such thing as unversioned data to guess
 * about.
 *
 * This constant is the single source of truth: STORAGE_KEYS is built from it, so
 * the version and the keys can never drift. IMPORTANT: bumping it to 2 silently
 * repoints every key to `:v2:` (a fresh, empty store), so a bump MUST ship with a
 * migrate-on-read — read the old `:v1:` key, transform, write the new one — or all
 * existing user data is orphaned. Purely additive changes (a new optional field
 * the sanitizers already preserve) do NOT need a bump. This is the marker, not a
 * migration engine: add the transform only when the first breaking change arrives.
 */
export const STORAGE_SCHEMA_VERSION = 1;

const NAMESPACE = "hrt-shot-tracker";

export const STORAGE_KEYS = {
  shots: `${NAMESPACE}:v${STORAGE_SCHEMA_VERSION}:shots`,
  profile: `${NAMESPACE}:v${STORAGE_SCHEMA_VERSION}:profile`,
} as const;
