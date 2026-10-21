/**
 * The empty search palette: the notes opened most recently.
 *
 * Only the order is kept here - the notes themselves come from the loaded listing, so a note that
 * left the vault simply disappears from the list instead of becoming a dead row. The state lives in
 * `App` because the palette unmounts on close, and a reload starts empty: a visit history that
 * survives the process would be storage, which this app has deliberately none of yet.
 */
import type { VaultEntry } from "@lumos/shared";
import { keyOfEntry } from "./search";

/** How many notes the empty palette offers. Enough to cover a session's thread, short enough to scan. */
export const RECENT_LIMIT = 5;

/**
 * Put a note at the front of the list, dropping any earlier visit of the same note, and cap it.
 * Pure: the caller's list is not mutated.
 */
export function rememberRecent(
  keys: readonly string[],
  key: string,
  limit: number = RECENT_LIMIT,
): string[] {
  return [key, ...keys.filter((seen) => seen !== key)].slice(0, limit);
}

/**
 * Resolve remembered keys against the loaded notes, in the order they were opened.
 *
 * A key the listing no longer holds is skipped rather than rendered as an empty row, which is what
 * happens to a note deleted or moved while the app was running. Duplicates cannot arrive from
 * `rememberRecent`, but the guard keeps this function total on its own.
 */
export function recentEntries(
  keys: readonly string[],
  entries: readonly VaultEntry[],
  limit: number = RECENT_LIMIT,
): VaultEntry[] {
  const byKey = new Map(entries.map((entry) => [keyOfEntry(entry), entry]));
  const found: VaultEntry[] = [];
  const seen = new Set<string>();

  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = byKey.get(key);
    if (entry) found.push(entry);
    if (found.length === limit) break;
  }

  return found;
}
