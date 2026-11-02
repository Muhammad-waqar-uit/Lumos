import type { VaultEntry } from "@lumos/shared";

/** The key every list and the graph address a note by. */
function keyOf(entry: VaultEntry): string {
  return `${entry.folder}/${entry.name}`;
}

/**
 * Pick a note at random, avoiding the one already open when there is another choice.
 *
 * The whole point of the command is to be taken somewhere unexpected, so the note on screen is left
 * out of the pool; a vault of one note still answers it, because a command that does nothing when
 * there is exactly one thing to show is worse than opening the thing again.
 *
 * `random` is an argument rather than read inside, so the order can be tested without stubbing a
 * global. A value outside `[0, 1)` is clamped instead of indexing past the end of the list.
 */
export function pickRandomNote(
  entries: readonly VaultEntry[],
  exclude: string | null = null,
  random: () => number = Math.random,
): VaultEntry | null {
  if (entries.length === 0) return null;

  const others = entries.filter((entry) => keyOf(entry) !== exclude);
  const pool = others.length > 0 ? others : entries;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  return pool[index];
}
