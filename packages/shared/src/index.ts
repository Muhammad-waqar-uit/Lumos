/**
 * @lumos/shared - core types shared by the daemon and desktop apps.
 */

/**
 * A vault folder. There is no fixed set: the vault's own directories are the folders, and anyone
 * can add one (`/newfolder Movies` on WhatsApp, or the button in the app).
 */
export type Folder = string;

/**
 * The folders a vault starts with, in display order.
 *
 * A seed, not a limit: these are the ones the app and the docs can name without first asking the
 * vault, so an empty vault still has somewhere for a note to go.
 */
export const DEFAULT_FOLDERS: readonly Folder[] = [
  "Inbox",
  "Ideas",
  "Interviews",
  "Goals",
  "Reading",
] as const;

/** Characters a folder name can never carry: a separator would let it escape the vault. */
const FOLDER_NAME_RE = /^[^\\/:*?"<>|]+$/;

/** A control character would travel into a filename; there is no folder name that needs one. */
function hasControlCharacter(value: string): boolean {
  return [...value].some((char) => char.charCodeAt(0) < 0x20 || char.charCodeAt(0) === 0x7f);
}

/**
 * Why a name cannot be a folder, or null when it can.
 *
 * The same rule guards the WhatsApp command and the HTTP route, because both end up as a directory
 * under the vault and a name carrying a separator would put it somewhere else entirely.
 */
export function folderNameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Give the folder a name.";
  if (trimmed.length > 64) return "A folder name is at most 64 characters.";
  if (trimmed === "." || trimmed === "..") return "That name is not a folder.";
  // Separators first: `../escape` is a traversal attempt, not a hidden folder, and the sentence
  // should say the thing the person actually typed.
  if (!FOLDER_NAME_RE.test(trimmed)) return 'A folder name cannot contain / \\ : * ? " < > |';
  if (hasControlCharacter(trimmed)) return "A folder name cannot contain control characters.";
  if (trimmed.startsWith(".")) return "A folder name cannot start with a dot.";
  return null;
}

/**
 * The word a folder answers to after a slash: `Movies` is `/movies`, `To Read` is `/to-read`.
 *
 * It has to be typeable on a phone keyboard, which is why spaces and punctuation collapse into a
 * dash rather than being kept as written.
 */
export function folderCommand(folder: string): string {
  return folder
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
  | { kind: "newFolder"; name: string }
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
  /** What is wrong with the frontmatter block, empty when the note is well formed. */
  problems: string[];
}

/** A link written inside a note body. */
export interface LinkRef {
  /** The target as written, without any alias or heading part. */
  target: string;
  /** Display text after a `|`, when the link has one. */
  alias: string | null;
  /** Heading or block reference after a `#`, when the link has one. */
  heading: string | null;
  /** True for `![[embed]]` links. Embeds count as links in the graph. */
  embed: boolean;
}

/** How a graph edge was formed. */
export type GraphEdgeKind = "link" | "tag";

/** A node in the vault graph: a note, or a tag that notes use. */
export interface GraphNode {
  /** Stable id: `Folder/name.md` for notes, `#tag` for tags. */
  id: string;
  /** Note title, or the tag including its `#`. */
  label: string;
  kind: "note" | "tag";
  folder?: string;
  created?: string;
  tags: string[];
  /** Incoming edges - how many notes point here. Drives node size. */
  inDegree: number;
  outDegree: number;
  /** Nothing links in or out, and the note carries no tags. */
  orphan: boolean;
}

/** A resolved relationship between two nodes. */
export interface GraphEdge {
  /** Source node id. */
  source: string;
  /** Target node id. */
  target: string;
  kind: GraphEdgeKind;
}

/** A link whose target is not a note in the vault. */
export interface UnresolvedLink {
  /** Id of the note the link was written in. */
  source: string;
  /** The target exactly as written, so it can be shown as a placeholder. */
  target: string;
}

/** Everything the graph view needs for one vault. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  unresolved: UnresolvedLink[];
}

/** The minimal note shape the pure graph builder needs. */
export interface GraphSourceNote {
  /** Same id the desktop lists notes by: `Folder/name.md`. */
  id: string;
  title: string;
  folder: string;
  created: string;
  tags: string[];
  /** Frontmatter aliases, which links are allowed to resolve to. */
  aliases?: string[];
  content: string;
}

/**
 * How a link can be shown inside the app. `youtube`, `vimeo`, `instagram` and `facebook`
 * all carry an `embedUrl` and play in place; `image` renders itself, and `page` is fetched
 * and read by the daemon.
 */
export type LinkMediaKind = "youtube" | "vimeo" | "instagram" | "facebook" | "image" | "page";

/**
 * The frame an embed needs: a 16:9 video, a vertical reel, or a tall post card.
 * Omitted means `landscape`, which is the shape a note viewer already gives a video.
 */
export type LinkFrame = "landscape" | "portrait" | "tall";

/** What the app can do with a link without asking the network. */
export interface LinkMedia {
  /** The link itself, trimmed. */
  url: string;
  kind: LinkMediaKind;
  /** Inline player URL, for the embeddable hosts. */
  embedUrl?: string;
  /** Poster image, when the host exposes one (a YouTube thumbnail). */
  poster?: string;
  /** Frame shape the embed needs, when it is not the default 16:9. */
  frame?: LinkFrame;
}

/** A link as the desktop shows it: whatever can be played, plus the scraped page details. */
export interface LinkCard {
  media: LinkMedia;
  /** Page title, or null when the page was not fetched. */
  title: string | null;
  /** `og:site_name`, or the host. */
  site: string | null;
  description: string | null;
  /** Lead image from the page, or the poster for a video. */
  image: string | null;
  /** Readable body text, whitespace-collapsed. Empty for media links. */
  text: string;
  /** True when the body text hit the length cap. */
  truncated: boolean;
  /** URL after redirects, when it differs from the link as written. */
  finalUrl?: string;
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
  /**
   * What is wrong with the note's frontmatter, absent when it is fine. A note with problems is
   * listed rather than skipped, so a hand-written file with a broken field cannot disappear.
   */
  problems?: string[];
  /** First ~200 characters of the body, for previews. */
  excerpt: string;
}
