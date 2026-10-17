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
  /** First ~200 characters of the body, for previews. */
  excerpt: string;
}
