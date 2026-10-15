import type { GraphData, Note, VaultEntry } from "@lumos/shared";
import { buildGraphFromNotes } from "@lumos/vault-utils/graph";
import type { FolderCount } from "./api";

/**
 * Demo data shown when the daemon is not reachable, so the shell is never blank.
 * The desktop reads the real vault from the daemon once it is running.
 */

function entry(
  folder: VaultEntry["folder"],
  name: string,
  title: string,
  created: string,
  excerpt: string,
  extra: Partial<VaultEntry> = {},
): VaultEntry {
  return {
    folder,
    name,
    title,
    created,
    excerpt,
    file: `${folder}/${name}`,
    tags: [],
    ...extra,
  };
}

export const DEMO_NOTES: VaultEntry[] = [
  entry(
    "Ideas",
    "2026-10-13-build-a-habit-tracker.md",
    "Build a habit tracker",
    "2026-10-13T09:12:00.000Z",
    "A small app that tracks daily habits with streaks and gentle reminders.",
  ),
  entry(
    "Interviews",
    "2026-10-12-system-design-top-questions.md",
    "System design top questions",
    "2026-10-12T14:30:00.000Z",
    "Caching, rate limiting, sharding, and consistency trade-offs.",
    { url: "https://example.com/system-design" },
  ),
  entry(
    "Reading",
    "2026-10-11-async-rust-guide.md",
    "Async Rust guide",
    "2026-10-11T08:05:00.000Z",
    "Futures, executors, and the pinning model explained.",
    { url: "https://example.com/rust-async" },
  ),
  entry(
    "Goals",
    "2026-10-10-learn-rust.md",
    "Learn Rust",
    "2026-10-10T07:00:00.000Z",
    "Ship one small CLI in Rust this quarter.",
  ),
  entry(
    "Inbox",
    "2026-10-09-random-thought.md",
    "Random thought",
    "2026-10-09T21:44:00.000Z",
    "A thought captured straight from WhatsApp with no command.",
  ),
];

/**
 * Bodies for the demo notes. They carry links and tags so the offline graph has real
 * edges to draw instead of a scatter of unconnected dots.
 */
const DEMO_BODIES: Record<string, string> = {
  "2026-10-13-build-a-habit-tracker.md":
    "Pairs with [[Learn Rust]], and the setup is close to [[System design top questions]]. #ideas",
  "2026-10-12-system-design-top-questions.md":
    "Caching, rate limiting, sharding, consistency. Reread [[Async Rust guide]] for the executor part. #interview",
  "2026-10-11-async-rust-guide.md":
    "Futures, executors, and the pinning model, which backs the [[Learn Rust]] goal. #reading",
  "2026-10-10-learn-rust.md":
    "Ship one small CLI this quarter. [[Build a habit tracker]] is the obvious first target. #goal",
  "2026-10-09-random-thought.md":
    "A thought captured straight from WhatsApp, with nothing linking to it yet.",
};

/** The demo vault's link graph, assembled by the same pure builder the daemon uses. */
export const DEMO_GRAPH: GraphData = buildGraphFromNotes(
  DEMO_NOTES.map((n) => ({
    id: `${n.folder}/${n.name}`,
    title: n.title,
    folder: n.folder,
    created: n.created,
    tags: n.tags,
    content: DEMO_BODIES[n.name] ?? "",
  })),
);

export const DEMO_FOLDERS: FolderCount[] = ["Inbox", "Ideas", "Interviews", "Goals", "Reading"].map(
  (folder) => ({
    folder: folder as FolderCount["folder"],
    count: DEMO_NOTES.filter((n) => n.folder === folder).length,
  }),
);

/** Build a Note from a listing entry when the daemon cannot serve the full note. */
export function demoNote(from: VaultEntry): Note {
  return {
    title: from.title,
    folder: from.folder,
    file: from.file,
    frontmatter: {
      source: "demo",
      created: from.created,
      tags: from.tags,
      status: "new",
      ...(from.url ? { url: from.url } : {}),
    },
    content: `# ${from.title}\n\n${from.excerpt}\n\n${
      DEMO_BODIES[from.name] ?? ""
    }${from.url ? `\n\n${from.url}` : ""}`,
  };
}
