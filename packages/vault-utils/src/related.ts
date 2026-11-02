/**
 * @lumos/vault-utils - notes that sit near the one you are reading.
 *
 * The graph knows two kinds of edge, and both are already loaded: a note links to another, or two
 * notes share a tag. That is enough to answer "what else belongs with this?" without reading a
 * single body, so the viewer can answer it with the daemon stopped.
 */
import type { GraphData, VaultEntry } from "@lumos/shared";

/** How many related notes the viewer shows unless it asks for another number. */
export const RELATED_LIMIT = 5;

/** A note beside the open one, and the reasons it was chosen. */
export interface RelatedNote {
  /** Vault id: `Folder/name.md`, the key every list and the graph address notes by. */
  id: string;
  label: string;
  folder: string;
  /** The shared tags (`#rust`) and, for an outgoing link, `this note links to it`. */
  reasons: string[];
}

/** A tag as a filter and the graph write it. */
function cleanTag(raw: string): string {
  return raw.trim().replace(/^#/, "").toLowerCase();
}

/** The key a note is known by, the same one the graph's note nodes carry. */
function keyOf(entry: VaultEntry): string {
  return `${entry.folder}/${entry.name}`;
}

/**
 * Rank the notes near one note.
 *
 * A link out of the open note is the strongest signal - the author wrote down that these two belong
 * together - and a shared tag is the second: two notes about the same thing should be able to find
 * each other even when neither mentions the other. A shared folder alone is not a relationship
 * (every note in a folder would qualify), so it never puts a note on the list by itself.
 *
 * A note that links *here* is left out on purpose: the viewer already lists those under **Linked
 * from**, and the same neighbour in two panels reads as two different things. Titles break ties so
 * the order cannot wobble between renders, and an id the listing does not hold answers nothing.
 */
export function relatedNotes(
  notes: readonly VaultEntry[],
  graph: GraphData,
  id: string,
  limit = RELATED_LIMIT,
): RelatedNote[] {
  if (limit <= 0) return [];

  const byId = new Map(notes.map((entry) => [keyOf(entry), entry]));
  const self = byId.get(id);
  if (!self) return [];

  const mine = new Set(self.tags.map(cleanTag).filter(Boolean));
  const linksOut = new Set(
    graph.edges.filter((edge) => edge.kind === "link" && edge.source === id).map((e) => e.target),
  );
  const linksIn = new Set(
    graph.edges.filter((edge) => edge.kind === "link" && edge.target === id).map((e) => e.source),
  );

  const scored: { note: RelatedNote; score: number }[] = [];

  for (const entry of notes) {
    const other = keyOf(entry);
    if (other === id || linksIn.has(other)) continue;

    const shared = [...new Set(entry.tags.map(cleanTag).filter(Boolean))].filter((tag) =>
      mine.has(tag),
    );
    const outgoing = linksOut.has(other);
    const score = shared.length * 2 + (outgoing ? 3 : 0);
    if (score === 0) continue;

    scored.push({
      score,
      note: {
        id: other,
        label: entry.title,
        folder: entry.folder,
        reasons: [
          ...shared.slice(0, 3).map((tag) => `#${tag}`),
          ...(outgoing ? ["this note links to it"] : []),
        ],
      },
    });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.note.label.localeCompare(b.note.label) ||
      a.note.id.localeCompare(b.note.id),
  );
  return scored.slice(0, limit).map((row) => row.note);
}
