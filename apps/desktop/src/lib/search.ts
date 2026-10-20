import Fuse, { type IFuseOptions } from "fuse.js";
import type { VaultEntry } from "@lumos/shared";

/** One row in the search modal: the note, and whether only its body matched. */
export interface SearchResult {
  entry: VaultEntry;
  /** True when the daemon's body search found the note but the local index did not. */
  body: boolean;
}

/** The search modal's shortcut, labelled for the platform the app is running on. */
export const SEARCH_SHORTCUT =
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform) ? "⌘K" : "Ctrl K";

/** The key the app addresses a note by, the same one the note list uses. */
export const keyOfEntry = (entry: VaultEntry): string => `${entry.folder}/${entry.name}`;

const OPTIONS: IFuseOptions<VaultEntry> = {
  keys: [
    { name: "title", weight: 0.6 },
    { name: "tags", weight: 0.25 },
    { name: "excerpt", weight: 0.15 },
  ],
  includeScore: true,
  // A query can match anywhere in a field, not only near its start, which matters for excerpts.
  ignoreLocation: true,
  threshold: 0.35,
  minMatchCharLength: 2,
};

/** The index over the loaded notes. Build it once per vault load, not per keystroke. */
export function makeSearchIndex(entries: readonly VaultEntry[]): Fuse<VaultEntry> {
  return new Fuse(entries, OPTIONS);
}

/**
 * Ranked matches over title, tags and excerpt, with the daemon's body-only matches appended.
 *
 * `bodyMatches` come from `GET /notes/search`, which reads whole files, so a query can find a note
 * by text the listing never saw. They are de-duplicated by note and marked, because the modal says
 * which notes only matched inside the body. The two sources are kept in order rather than re-scored
 * against each other: the local hits are ranked, the body hits arrive in the daemon's own order.
 */
export function searchVault(
  index: Fuse<VaultEntry>,
  query: string,
  bodyMatches: readonly VaultEntry[] = [],
  limit = 12,
): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const local: SearchResult[] = index
    .search(trimmed, { limit })
    .map(({ item }) => ({ entry: item, body: false }));

  const seen = new Set(local.map((hit) => keyOfEntry(hit.entry)));
  const extra: SearchResult[] = bodyMatches
    .filter((entry) => !seen.has(keyOfEntry(entry)))
    .map((entry) => ({ entry, body: true }));

  return [...local, ...extra].slice(0, limit);
}
