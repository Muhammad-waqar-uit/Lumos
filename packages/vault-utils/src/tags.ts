/**
 * @lumos/vault-utils - the vault's tags, counted.
 *
 * The listing already carries each note's tags, so a tag index needs no extra read: this is
 * arithmetic over what the window holds. It answers the questions the chips in the list cannot -
 * how much of the vault a tag covers, which folders it spans, and which tags travel together.
 */
import type { VaultEntry } from "@lumos/shared";

/** How many co-occurring tags are kept for one tag. */
export const TAG_RELATED = 4;

/** A tag that appears beside another one, and how many notes carry both. */
export interface TagPair {
  tag: string;
  count: number;
}

/** One tag, and the shape of its use across the vault. */
export interface TagSummary {
  /** The tag without its `#`, lower-cased, the way links and filters write it. */
  tag: string;
  /** How many notes carry it. */
  count: number;
  /** Where those notes live, busiest folder first. */
  folders: { folder: string; count: number }[];
  /** The tags most often carried by the same notes. */
  related: TagPair[];
}

/** Everything the Tags pane draws. */
export interface TagIndex {
  /** Tags, busiest first, then alphabetical. */
  tags: TagSummary[];
  /** How many distinct tags the vault has. */
  distinct: number;
  /** Notes carrying at least one tag. */
  tagged: number;
  /** Notes carrying none. */
  untagged: number;
}

/** A tag as the vault writes it: no `#`, lower-case, trimmed. */
function cleanTag(raw: string): string {
  return raw.trim().replace(/^#/, "").toLowerCase();
}

/** The key a note is known by, the same `Folder/name.md` the list and the graph use. */
function keyOf(entry: VaultEntry): string {
  return `${entry.folder}/${entry.name}`;
}

const byCount = (a: { count: number }, b: { count: number }): number => b.count - a.count;

/**
 * Count the vault's tags from its listing.
 *
 * A tag on one note counts once, however it was written: `#Rust`, `rust` and a duplicated
 * frontmatter entry are one tag, because the graph already reads them as one node. Notes are
 * identified by their vault key, so two entries for one file cannot inflate a count.
 *
 * The ordering is total (count, then name) rather than whatever the input order happened to be, so
 * two renders of the same vault cannot disagree.
 */
export function tagIndex(notes: readonly VaultEntry[]): TagIndex {
  const holders = new Map<string, Set<string>>();
  const tagsByNote = new Map<string, string[]>();
  const folders = new Map<string, Map<string, number>>();
  let untagged = 0;

  for (const entry of notes) {
    const key = keyOf(entry);
    const tags = [...new Set(entry.tags.map(cleanTag).filter(Boolean))];
    if (tags.length === 0) {
      untagged += 1;
      continue;
    }
    tagsByNote.set(key, tags);

    for (const tag of tags) {
      const notesWithTag = holders.get(tag) ?? new Set<string>();
      notesWithTag.add(key);
      holders.set(tag, notesWithTag);

      const spread = folders.get(tag) ?? new Map<string, number>();
      spread.set(entry.folder, (spread.get(entry.folder) ?? 0) + 1);
      folders.set(tag, spread);
    }
  }

  const tags: TagSummary[] = [...holders].map(([tag, notesWithTag]) => {
    // Co-occurrence counts notes, not pairs of entries: a note that names a tag twice still counts
    // once, and a tag is never its own neighbour.
    const pairs = new Map<string, number>();
    for (const key of notesWithTag) {
      for (const other of tagsByNote.get(key) ?? []) {
        if (other === tag) continue;
        pairs.set(other, (pairs.get(other) ?? 0) + 1);
      }
    }

    return {
      tag,
      count: notesWithTag.size,
      folders: [...(folders.get(tag) ?? new Map<string, number>())]
        .map(([folder, count]) => ({ folder, count }))
        .sort((a, b) => byCount(a, b) || a.folder.localeCompare(b.folder)),
      related: [...pairs]
        .map(([relatedTag, count]) => ({ tag: relatedTag, count }))
        .sort((a, b) => byCount(a, b) || a.tag.localeCompare(b.tag))
        .slice(0, TAG_RELATED),
    };
  });

  tags.sort((a, b) => byCount(a, b) || a.tag.localeCompare(b.tag));

  return {
    tags,
    distinct: holders.size,
    tagged: notes.length - untagged,
    untagged,
  };
}
