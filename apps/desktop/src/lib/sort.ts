import type { VaultEntry } from "@lumos/shared";

/**
 * How the note list is ordered.
 *
 * Filtering decides *which* notes are listed; this decides their order. They are kept apart
 * because the two questions have different answers: narrowing by a tag must not quietly reorder
 * what is left, and the order survives a change of folder the way the tag filter does not.
 */
export type SortOrder = "newest" | "oldest" | "title";

export const SORT_ORDER: readonly SortOrder[] = ["newest", "oldest", "title"];

export const SORT_LABEL: Record<SortOrder, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  title: "Title A–Z",
};

const STORAGE_KEY = "lumos.sort.v1";

/** A note's time, or null when its `created` is not a date anything can be ordered by. */
function timeOf(entry: VaultEntry): number | null {
  const time = Date.parse(entry.created);
  return Number.isNaN(time) ? null : time;
}

/** The path a note lives at, which breaks every tie so the order cannot wobble between renders. */
function byPath(a: VaultEntry, b: VaultEntry): number {
  return `${a.folder}/${a.name}`.localeCompare(`${b.folder}/${b.name}`);
}

/**
 * The notes in the order the list draws them.
 *
 * A note whose `created` does not parse is not quietly treated as 1970: it goes last under either
 * date order, so a broken frontmatter block cannot pass itself off as the newest thing in the
 * vault. The title order ignores case, because a list that puts `apple` after `Zebra` is not
 * alphabetical to the person reading it.
 */
export function sortEntries(entries: readonly VaultEntry[], order: SortOrder): VaultEntry[] {
  const sorted = [...entries];

  if (order === "title") {
    sorted.sort(
      (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) || byPath(a, b),
    );
    return sorted;
  }

  const direction = order === "newest" ? -1 : 1;
  sorted.sort((a, b) => {
    const at = timeOf(a);
    const bt = timeOf(b);
    if (at === null || bt === null) {
      if (at === bt) return byPath(a, b);
      return at === null ? 1 : -1;
    }
    return (at - bt) * direction || byPath(a, b);
  });
  return sorted;
}

/** A stored order, or `newest` for anything unusable - an older value, a hand-edited one, none. */
export function readSort(storage?: Storage | null): SortOrder {
  const value = storage?.getItem(STORAGE_KEY);
  return SORT_ORDER.find((order) => order === value) ?? "newest";
}

/** Keep the chosen order for the next launch. Storage that is full or off keeps it for this one. */
export function writeSort(order: SortOrder, storage?: Storage | null): void {
  try {
    storage?.setItem(STORAGE_KEY, order);
  } catch {
    // A browser can refuse to store; the order still applies until the window closes.
  }
}

/** The browser's storage, or null where there is none (a test, a server render, storage denied). */
export function localStore(): Storage | null {
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
