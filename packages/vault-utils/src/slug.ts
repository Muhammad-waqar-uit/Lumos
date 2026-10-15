/**
 * Slug helpers.
 *
 * Pure on purpose: the graph module needs the same slug rules, and it has to run
 * in the desktop webview as well as in the daemon, so nothing here may touch node.
 */

const SLUG_MAX = 50;

/** Turn a string into a filesystem-safe slug. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SLUG_MAX) || "note"
  );
}
