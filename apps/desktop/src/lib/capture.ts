import type { VaultEntry } from "@lumos/shared";

/**
 * What the app says when notes arrive while the window is open.
 *
 * A capture on WhatsApp writes to disk, and nothing pushes that to the app - so the app has to
 * notice. It already asks the daemon how the link is doing every few seconds, and that answer
 * carries when a message was last answered, which is a free signal that something was captured.
 * This module is the arithmetic of that: what is new, and what to say about it. No timers, no
 * fetch, so it is testable without either.
 */

/** The keys (`Folder/name.md`) the list already held. */
export type NoteKeys = ReadonlySet<string>;

/** The listing's key for a note, the same one the list addresses it by. */
export function entryKey(entry: VaultEntry): string {
  return `${entry.folder}/${entry.name}`;
}

/** Notes in `after` that were not in `before`, in the order the listing answered them. */
export function addedNotes(before: NoteKeys, after: readonly VaultEntry[]): VaultEntry[] {
  return after.filter((entry) => !before.has(entryKey(entry)));
}

/** What a notice should say, and which note it should offer to open. */
export interface CaptureNotice {
  text: string;
  /** The note to open when the action is taken: the newest of the ones that arrived. */
  open: { key: string; label: string };
}

/**
 * The notice for what arrived, or null when nothing did.
 *
 * One note is named, because the title is the whole point of a capture - it is what tells someone
 * whether the message became what they meant. Several are counted, with the newest offered: reading
 * a list of titles in a one-line bar is worse than opening the one that just landed.
 *
 * The notice opens the note rather than jumping to it. A capture can arrive mid-edit or mid-read,
 * and an app that moves under the hands of whoever is using it is worse than one that waits to be
 * asked.
 */
export function captureNotice(added: readonly VaultEntry[]): CaptureNotice | null {
  const newest = added[0];
  if (!newest) return null;

  if (added.length === 1) {
    return {
      text: `New note from WhatsApp: "${newest.title}"`,
      open: { key: entryKey(newest), label: "Open" },
    };
  }

  return {
    text: `${added.length} new notes from WhatsApp`,
    open: { key: entryKey(newest), label: "Open newest" },
  };
}
