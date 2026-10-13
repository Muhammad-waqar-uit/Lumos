/**
 * @lumos/shared - core types shared by the daemon and desktop apps.
 */

/** Vault folders that notes can be filed into. */
export type Folder = "Inbox" | "Ideas" | "Interviews" | "Goals" | "Reading";

/** All vault folders, in display order. */
export const FOLDERS: readonly Folder[] = [
  "Inbox",
  "Ideas",
  "Interviews",
  "Goals",
  "Reading",
] as const;

/** The payload needed to create a note. */
export interface NoteInput {
  folder: Folder;
  text: string;
  url?: string;
}

/** The result of parsing a raw message into an intent. */
export type Parsed =
  | ({ kind: "note" } & NoteInput)
  | { kind: "plan"; when: "today" | "tomorrow" }
  | { kind: "find"; query: string }
  | { kind: "help" }
  | { kind: "unknown"; command: string };

/** Where a note originated. */
export type NoteSource = "whatsapp" | "desktop" | "import" | (string & {});

/** YAML frontmatter stored at the top of every note. */
export interface Frontmatter {
  source: NoteSource;
  /** ISO-8601 creation timestamp. */
  created: string;
  tags: string[];
  status: string;
  url?: string;
  /** Allows forward-compatible extra keys. */
  [key: string]: unknown;
}

/** A fully loaded note. */
export interface Note {
  title: string;
  folder: string;
  /** Absolute path to the note file. */
  file: string;
  frontmatter: Frontmatter;
  /** Body content without the frontmatter block. */
  content: string;
}

/** A lightweight vault listing entry. */
export interface VaultEntry {
  title: string;
  folder: string;
  /** Absolute path to the note file. */
  file: string;
  /** Filename without the directory. */
  name: string;
  created: string;
  tags: string[];
  url?: string;
  /** First ~200 characters of the body, for previews. */
  excerpt: string;
}
