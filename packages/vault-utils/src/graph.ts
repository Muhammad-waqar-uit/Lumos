/**
 * @lumos/vault-utils - the vault link graph.
 *
 * Obsidian's model, in miniature: notes are nodes, internal links and tags are
 * edges, and a link whose target does not exist is reported rather than invented.
 *
 * Pure by design - no filesystem, no node builtins - so the desktop can assemble a
 * graph with the same code the daemon uses for the vault (its demo fallback).
 */
import type {
  GraphData,
  GraphEdge,
  GraphNode,
  GraphSourceNote,
  LinkRef,
  UnresolvedLink,
} from "@lumos/shared";
import { slugify } from "./slug";

/**
 * Fenced blocks and inline code are skipped, the way Obsidian ignores links in code.
 * Exported because scanning a note for external URLs has the same blind spot.
 */
export function stripCode(content: string): string {
  const fenced = content.replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, "");
  return fenced.replace(/`[^`\n]*`/g, "");
}

const LINK = /(!?)\[\[([^\]\n]+?)\]\]|\[([^\]\n]*)\]\(([^)\s]+)\)/g;
const TAG = /(^|[^\w#])#([A-Za-z0-9_][A-Za-z0-9_/-]*)/g;
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/;

/** Strip the decoration a target may carry. */
function normalizeTarget(raw: string): string {
  return raw.trim().replace(/^\.\//, "").replace(/\.md$/i, "").trim();
}

/** The lookup form of a target: comparative, not display-ready. */
function normalizeKey(raw: string): string {
  return normalizeTarget(raw).replace(/\s+/g, " ").toLowerCase();
}

/** The filename of a note id, without its folder or extension. */
function fileStem(id: string): string {
  const slash = Math.max(id.lastIndexOf("/"), id.lastIndexOf("\\"));
  return (slash === -1 ? id : id.slice(slash + 1)).replace(/\.md$/i, "");
}

/** Read a `[[wikilink]]`, or null when it only points inside the same note. */
function wikiLink(inner: string, embed: boolean): LinkRef | null {
  const pipe = inner.indexOf("|");
  const alias = pipe === -1 ? null : inner.slice(pipe + 1).trim();
  const body = pipe === -1 ? inner : inner.slice(0, pipe);
  const hash = body.indexOf("#");
  const heading = hash === -1 ? null : body.slice(hash + 1).trim();
  const target = normalizeTarget(hash === -1 ? body : body.slice(0, hash));
  if (!target) return null;
  return { target, alias: alias || null, heading: heading || null, embed };
}

/** Read a markdown link; only relative `.md` targets are vault notes. */
function markdownLink(url: string): LinkRef | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null; // http:, mailto:, data:
  if (url.startsWith("#")) return null; // a heading in the same note

  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch (err: unknown) {
    // A malformed escape is not fatal: resolve against the literal text instead.
    if (!(err instanceof URIError)) throw err;
  }

  const hash = decoded.indexOf("#");
  const heading = hash === -1 ? null : decoded.slice(hash + 1).trim();
  const withoutHash = hash === -1 ? decoded : decoded.slice(0, hash);
  if (!/\.md$/i.test(withoutHash)) return null; // attachments are not notes
  const target = normalizeTarget(withoutHash);
  if (!target) return null;
  return { target, alias: null, heading: heading || null, embed: false };
}

/** Every link written in a note body, in the order it appears. */
export function extractLinks(content: string): LinkRef[] {
  const refs: LinkRef[] = [];
  for (const match of stripCode(content).matchAll(LINK)) {
    const raw = match[0];
    const ref =
      raw.startsWith("[[") || raw.startsWith("![[")
        ? wikiLink(match[2], raw.startsWith("!"))
        : markdownLink(match[4]);
    if (ref) refs.push(ref);
  }
  return refs;
}

/** Tags from the frontmatter first, then inline `#tags`: lower-cased and unique. */
export function extractTags(content: string, frontmatterTags: readonly string[] = []): string[] {
  const tags: string[] = [];
  const add = (raw: string): void => {
    const tag = raw.trim().replace(/^#/, "").replace(/\/+$/, "").toLowerCase();
    if (tag && !tags.includes(tag)) tags.push(tag);
  };

  for (const tag of frontmatterTags) add(tag);
  for (const line of stripCode(content).split("\n")) {
    if (/^ {0,3}#{1,6}\s/.test(line)) continue; // a markdown heading, not a tag
    for (const match of line.matchAll(TAG)) add(match[2]);
  }
  return tags;
}

/**
 * Build a lookup from every name a link may use to the note it belongs to:
 * title, slug, filename, filename without its date prefix, the id, and aliases.
 */
function makeResolver(notes: readonly GraphSourceNote[]): (target: string) => string | null {
  const keys = new Map<string, string>();
  const remember = (raw: string, id: string): void => {
    const key = normalizeKey(raw);
    if (key && !keys.has(key)) keys.set(key, id);
  };

  for (const note of notes) {
    const stem = fileStem(note.id);
    remember(note.title, note.id);
    remember(slugify(note.title), note.id);
    remember(stem, note.id);
    remember(stem.replace(DATE_PREFIX, ""), note.id);
    remember(note.id, note.id);
    for (const alias of note.aliases ?? []) {
      remember(alias, note.id);
      remember(slugify(alias), note.id);
    }
  }

  return (target: string): string | null => {
    const direct = keys.get(normalizeKey(target));
    if (direct) return direct;

    // `[[Folder/Note]]` still has to find a note whose id carries a date prefix.
    const slash = Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\"));
    if (slash === -1) return null;
    const base = target.slice(slash + 1);
    return (
      keys.get(normalizeKey(base)) ?? keys.get(normalizeKey(base.replace(DATE_PREFIX, ""))) ?? null
    );
  };
}

/** Assemble the graph from note contents. Deterministic: ordering never depends on input order. */
export function buildGraphFromNotes(notes: readonly GraphSourceNote[]): GraphData {
  const sorted = [...notes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const resolve = makeResolver(sorted);

  const edges: GraphEdge[] = [];
  const unresolved: UnresolvedLink[] = [];
  const tagsById = new Map<string, string[]>();
  const seenEdges = new Set<string>();
  const seenMissing = new Set<string>();

  const addEdge = (source: string, target: string, kind: GraphEdge["kind"]): void => {
    const key = `${kind}\u0000${source}\u0000${target}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push({ source, target, kind });
  };

  for (const note of sorted) {
    const tags = extractTags(note.content, note.tags);
    tagsById.set(note.id, tags);
    for (const tag of tags) addEdge(note.id, `#${tag}`, "tag");

    for (const ref of extractLinks(note.content)) {
      const target = resolve(ref.target);
      if (target === note.id) continue; // a note is not its own neighbour
      if (target) {
        addEdge(note.id, target, "link");
        continue;
      }
      const missing = `${note.id}\u0000${ref.target}`;
      if (seenMissing.has(missing)) continue;
      seenMissing.add(missing);
      unresolved.push({ source: note.id, target: ref.target });
    }
  }

  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const edge of edges) {
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }
  const degree = (id: string): { inDegree: number; outDegree: number } => ({
    inDegree: incoming.get(id) ?? 0,
    outDegree: outgoing.get(id) ?? 0,
  });

  const nodes: GraphNode[] = sorted.map((note) => {
    const { inDegree, outDegree } = degree(note.id);
    return {
      id: note.id,
      label: note.title,
      kind: "note" as const,
      folder: note.folder,
      created: note.created,
      tags: tagsById.get(note.id) ?? [],
      inDegree,
      outDegree,
      orphan: inDegree + outDegree === 0,
    };
  });

  const tagIds = [...new Set(edges.filter((e) => e.kind === "tag").map((e) => e.target))].sort();
  for (const id of tagIds) {
    const { inDegree, outDegree } = degree(id);
    nodes.push({
      id,
      label: id,
      kind: "tag",
      tags: [id.slice(1)],
      inDegree,
      outDegree,
      orphan: inDegree + outDegree === 0,
    });
  }

  return { nodes, edges, unresolved };
}

/**
 * The notes that link to `id`. Tag references are deliberately not backlinks: a note that merely
 * shares a tag is a neighbour in the graph, not something that points at this note.
 *
 * Order follows the graph's node order, which the builder sorts by id, so the list is stable.
 */
export function backlinks(graph: GraphData, id: string): GraphNode[] {
  const sources = new Set(
    graph.edges
      .filter((edge) => edge.kind === "link" && edge.target === id)
      .map((edge) => edge.source),
  );
  return graph.nodes.filter((node) => node.kind === "note" && sources.has(node.id));
}

/** The local graph around one node: the node itself plus `depth` hops of neighbours. */
export function neighborhood(graph: GraphData, id: string, depth: number): GraphData {
  const start = graph.nodes.find((n) => n.id === id);
  if (!start) return { nodes: [], edges: [], unresolved: [] };

  const keep = new Set<string>([id]);
  if (depth > 0) {
    const adjacency = new Map<string, string[]>();
    const connect = (from: string, to: string): void => {
      const list = adjacency.get(from);
      if (list) list.push(to);
      else adjacency.set(from, [to]);
    };
    for (const edge of graph.edges) {
      connect(edge.source, edge.target);
      connect(edge.target, edge.source);
    }

    let frontier: string[] = [id];
    for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
      const next: string[] = [];
      for (const from of frontier) {
        for (const to of adjacency.get(from) ?? []) {
          if (keep.has(to)) continue;
          keep.add(to);
          next.push(to);
        }
      }
      frontier = next;
    }
  }

  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    unresolved: graph.unresolved.filter((u) => keep.has(u.source)),
  };
}
