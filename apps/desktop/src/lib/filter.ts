import type { Folder, VaultEntry } from "@lumos/shared";

export type FolderFilter = Folder | "All";

/** Everything the note list narrows by. `tag` is a bare tag; `null` means no tag filter. */
export interface FilterInput {
  folder: FolderFilter;
  query: string;
  tag: string | null;
}

/** A tag and how many of the listed notes carry it. */
export interface TagCount {
  tag: string;
  count: number;
}

/** Strip a leading `#` and lower-case, so `#Rust`, `rust` and `#RUST` are one tag. */
function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

/**
 * The notes that pass every active filter. Pure, so the behaviour the list shows is the same
 * behaviour a test can pin: folder first, then the tag, then the free-text query over the
 * title, the excerpt and the tags.
 */
export function filterEntries(
  entries: readonly VaultEntry[],
  { folder, query, tag }: FilterInput,
): VaultEntry[] {
  const q = query.trim().toLowerCase();
  const wanted = tag === null ? "" : normalizeTag(tag);

  return entries.filter((entry) => {
    if (folder !== "All" && entry.folder !== folder) return false;
    if (wanted && !entry.tags.some((entryTag) => normalizeTag(entryTag) === wanted)) return false;
    if (!q) return true;
    return `${entry.title} ${entry.excerpt} ${entry.tags.join(" ")}`.toLowerCase().includes(q);
  });
}

/**
 * The tags to offer as filters, most used first and ties alphabetical, each counted once per
 * note. Counting the same set the list is drawn from keeps the numbers honest: a tag with a
 * count of zero is not shown.
 */
export function countTags(entries: readonly VaultEntry[]): TagCount[] {
  const counts = new Map<string, TagCount>();

  for (const entry of entries) {
    const seen = new Set<string>();
    for (const raw of entry.tags) {
      const tag = normalizeTag(raw);
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      const existing = counts.get(tag);
      if (existing) existing.count += 1;
      else counts.set(tag, { tag, count: 1 });
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** The tag a graph node stands for, from its `#tag` id or label. `null` for a note node. */
export function nodeTag(id: string): string | null {
  return id.startsWith("#") ? normalizeTag(id) : null;
}
