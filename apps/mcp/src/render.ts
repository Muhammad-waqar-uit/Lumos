/**
 * How a result is written for the model that asked for it.
 *
 * Text, not JSON: a note is a note, and escaping one into a string so it can be parsed back out
 * would be a worse read than the heading lines below. A listing is one note per line with its key
 * first, so a key can be copied into `read_note` exactly as it was answered.
 */
import type { Note } from "@lumos/shared";
import type { TrashedNote } from "@lumos/vault-utils";
import type { FolderSummary, NoteSummary } from "./tools.js";

/** One line per note: the key, the title, the tags and the day. */
export function entryLines(entries: NoteSummary[]): string {
  if (entries.length === 0) return "no notes match.";
  return entries
    .map((entry) => {
      const tags = entry.tags.length > 0 ? ` · #${entry.tags.join(" #")}` : "";
      return `${entry.key} · ${entry.title}${tags} · ${entry.created.slice(0, 10)}`;
    })
    .join("\n");
}

/** The folders with their note counts, one per line. */
export function folderLines(folders: FolderSummary[]): string {
  if (folders.length === 0) return "the vault has no folders yet.";
  return folders.map((folder) => `${folder.name} · ${folder.notes} notes`).join("\n");
}

/**
 * A whole note: who it is and what it says.
 *
 * The key leads, because that is what every other tool takes; the body follows with nothing added
 * to it, because a model editing a note should see the text it is editing.
 */
export function noteText(key: string, note: Note): string {
  const tags = note.frontmatter.tags.length > 0 ? `#${note.frontmatter.tags.join(" #")}` : "none";
  const lines = [
    key,
    `${note.title} · tags: ${tags} · status: ${note.frontmatter.status} · created: ${note.frontmatter.created}`,
  ];
  if (note.frontmatter.url) lines.push(`url: ${note.frontmatter.url}`);
  if (note.problems.length > 0) lines.push(`frontmatter problems: ${note.problems.join("; ")}`);
  lines.push("", note.content);
  return lines.join("\n");
}

/** The trash, one entry per line: the id to restore it and the note it holds. */
export function trashLines(entries: TrashedNote[]): string {
  if (entries.length === 0) return "the trash is empty.";
  return entries
    .map((entry) => `${entry.id} · ${entry.folder}/${entry.name} · deleted ${entry.deleted}`)
    .join("\n");
}
