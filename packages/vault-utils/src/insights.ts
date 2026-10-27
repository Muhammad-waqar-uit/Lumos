import type { GraphData, VaultEntry } from "@lumos/shared";

/**
 * The vault, counted.
 *
 * A second brain is only as useful as its connections, and neither a listing nor a graph says how
 * connected it actually is: the list shows one folder at a time, and a canvas shows the shape
 * without any numbers on it. This is the arithmetic behind the desktop's insights pane and behind
 * the MCP server's `vault_health` tool - how many notes, how much links them, which notes carry the
 * most, and which have not been woven in yet.
 *
 * It is pure: the vault is only ever what the caller hands over (the listing and the graph), so the
 * desktop can count what it already holds and the server can count what it just read, from one
 * implementation. Nothing here touches the filesystem.
 */

/** How many rows each list shows; a total is always printed beside it, so nothing is hidden. */
export const INSIGHT_ROWS = 5;

/** A note or a tag with the number that put it on a list. */
export interface InsightRow {
  /** Vault id (`Folder/name.md`) for a note, `#tag` for a tag - what a click needs. */
  id: string;
  label: string;
  count: number;
}

/** A note that needs nothing counted beside it, only a way to open it. */
export interface InsightNote {
  /** Vault id (`Folder/name.md`). */
  id: string;
  label: string;
}

/** Everything the Insights pane shows. */
export interface VaultInsights {
  notes: number;
  /** Folders that hold at least one note, which is what the sidebar lists. */
  folders: number;
  /** Distinct tags across the vault. */
  tags: number;
  /** Links from one note to another, as the graph resolved them. */
  links: number;
  /** Links whose target is not a note in the vault yet. */
  unresolved: number;
  /**
   * False when the graph could not be read, so a link figure is unknown rather than zero. The
   * pane says so instead of printing a `0` that would read as "this vault has no links".
   */
  linksKnown: boolean;
  /** Notes created in the week and the month up to `now`. */
  thisWeek: number;
  thisMonth: number;
  /** How many notes nothing links to and that link nowhere - `mostLinked`'s opposite. */
  orphanCount: number;
  /** Notes with the most links pointing in, most first. */
  mostLinked: InsightRow[];
  /** Notes with no links in or out and no tags, the ones worth weaving in next. */
  orphans: InsightNote[];
  /** The tags most notes carry, most first. */
  topTags: InsightRow[];
  /** Notes per folder, fullest first. */
  perFolder: InsightRow[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Most first, then by label, so a list with equal counts does not reshuffle between reads. */
function byCountThenLabel(a: InsightRow, b: InsightRow): number {
  return b.count - a.count || a.label.localeCompare(b.label);
}

/** Notes created in the `days` up to `now`; a date the vault cannot parse is not counted. */
function createdWithin(entries: VaultEntry[], now: Date, days: number): number {
  const since = now.getTime() - days * DAY_MS;
  const until = now.getTime();
  return entries.filter((entry) => {
    const at = Date.parse(entry.created);
    // A note dated in the future (a hand-edited file, a clock that moved) is not "this week".
    return Number.isFinite(at) && at > since && at <= until;
  }).length;
}

/** Distinct tag → how many notes carry it, using the same rule the tag chips do. */
function tagCounts(entries: VaultEntry[]): InsightRow[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of new Set(entry.tags ?? [])) {
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([tag, count]) => ({ id: `#${tag}`, label: tag, count }))
    .sort(byCountThenLabel);
}

/** Notes per folder, from the listing rather than a separate read, so it matches the sidebar. */
function folderCounts(entries: VaultEntry[]): InsightRow[] {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.folder, (counts.get(entry.folder) ?? 0) + 1);
  return [...counts]
    .map(([folder, count]) => ({ id: folder, label: folder, count }))
    .sort(byCountThenLabel);
}

/**
 * Count the vault.
 *
 * `graph` is what `GET /graph` answered, or null when it could not be read: the link figures and
 * the two note lists then come back empty and `linksKnown` says so, because the only honest thing
 * to print for a graph nobody read is nothing.
 */
export function vaultInsights(
  entries: VaultEntry[],
  graph: GraphData | null,
  now: Date = new Date(),
): VaultInsights {
  const tags = tagCounts(entries);
  const folders = folderCounts(entries);

  const noteNodes = graph ? graph.nodes.filter((node) => node.kind === "note") : [];
  const orphans = noteNodes
    .filter((node) => node.orphan)
    .map((node) => ({ id: node.id, label: node.label }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const linked = noteNodes
    .filter((node) => node.inDegree > 0)
    .map((node) => ({ id: node.id, label: node.label, count: node.inDegree }))
    .sort(byCountThenLabel);

  return {
    notes: entries.length,
    folders: folders.length,
    tags: tags.length,
    links: graph ? graph.edges.filter((edge) => edge.kind === "link").length : 0,
    unresolved: graph ? graph.unresolved.length : 0,
    linksKnown: graph !== null,
    thisWeek: createdWithin(entries, now, 7),
    thisMonth: createdWithin(entries, now, 30),
    orphanCount: orphans.length,
    mostLinked: linked.slice(0, INSIGHT_ROWS),
    orphans: orphans.slice(0, INSIGHT_ROWS),
    topTags: tags.slice(0, INSIGHT_ROWS),
    perFolder: folders,
  };
}
