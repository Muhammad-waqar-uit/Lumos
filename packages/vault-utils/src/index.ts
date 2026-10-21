/**
 * @lumos/vault-utils - read, list, search, parse, and write the Lumos Markdown vault.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type {
  Frontmatter,
  GraphData,
  GraphSourceNote,
  Note,
  NoteInput,
  VaultEntry,
} from "@lumos/shared";
import { buildGraphFromNotes, extractTags } from "./graph";
import { isMapping, validateFrontmatter } from "./frontmatter";
import { slugify } from "./slug";

export { slugify, validateFrontmatter };

const TITLE_MAX = 60;

/** Choose a human title for a note from its text, URL, or a fallback. */
export function makeTitle({ text, url }: Pick<NoteInput, "text" | "url">): string {
  const firstLine = (text ?? "").split("\n")[0].trim();
  if (firstLine) {
    return firstLine.length > TITLE_MAX ? firstLine.slice(0, TITLE_MAX - 3) + "..." : firstLine;
  }
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      /* fall through */
    }
  }
  return "Untitled";
}

/** A default frontmatter object. */
export function defaultFrontmatter(source = "whatsapp"): Frontmatter {
  return {
    source,
    created: new Date().toISOString(),
    tags: [],
    status: "new",
  };
}

/**
 * Normalize a parsed mapping into a Frontmatter object.
 *
 * Unrecognised keys ride along, so a field someone wrote for another tool survives the read. The
 * known fields are set after them, because a file that writes `created` as a number, or as a YAML
 * timestamp that parses to a Date, must not put that value behind a `string` type.
 */
function normalizeFrontmatter(data: Record<string, unknown>): Frontmatter {
  const tags = Array.isArray(data.tags)
    ? data.tags.map(String)
    : typeof data.tags === "string"
      ? [data.tags]
      : [];
  const created = data.created instanceof Date ? data.created.toISOString() : data.created;

  const extra = { ...data };
  for (const known of ["source", "created", "tags", "status", "url"]) delete extra[known];

  return {
    ...extra,
    source: typeof data.source === "string" ? data.source : "whatsapp",
    created: typeof created === "string" ? created : new Date().toISOString(),
    status: typeof data.status === "string" ? data.status : "new",
    tags,
    ...(typeof data.url === "string" ? { url: data.url } : {}),
  };
}

/** What a note file parses to: the normalised frontmatter, the body, and anything wrong with it. */
export interface ParsedNote {
  frontmatter: Frontmatter;
  content: string;
  /** Problems with the frontmatter block, empty when the note is well formed. */
  problems: string[];
}

/**
 * Read the frontmatter block without trusting it: invalid YAML and a block that is not a mapping
 * both come back as an empty mapping plus the reason, so the caller still gets the body.
 */
function readFrontmatter(block: string): { data: Record<string, unknown>; problems: string[] } {
  let parsed: unknown;
  try {
    parsed = YAML.parse(block);
  } catch {
    return { data: {}, problems: ["frontmatter is not valid YAML"] };
  }
  // An empty block (`---\n---`) parses to null, which is a note with defaults, not a broken one.
  if (parsed === null || parsed === undefined) return { data: {}, problems: [] };
  if (!isMapping(parsed)) return { data: {}, problems: ["frontmatter is not a mapping"] };
  return { data: parsed, problems: validateFrontmatter(parsed) };
}

/** Parse a raw note file into frontmatter + body content. */
export function parseNote(raw: string): ParsedNote {
  const normalized = raw.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---")) {
    return { frontmatter: normalizeFrontmatter({}), content: normalized.trim(), problems: [] };
  }
  const end = normalized.indexOf("\n---", 3);
  if (end === -1) {
    return { frontmatter: normalizeFrontmatter({}), content: normalized.trim(), problems: [] };
  }
  const block = normalized.slice(3, end).trim();
  const content = normalized
    .slice(end + 4)
    .replace(/^\r?\n/, "")
    .trim();
  const { data, problems } = readFrontmatter(block);
  return { frontmatter: normalizeFrontmatter(data), content, problems };
}

/** Serialize frontmatter + body into a complete Markdown document. */
export function serializeNote(frontmatter: Frontmatter, content: string): string {
  const block = YAML.stringify(frontmatter).trimEnd();
  return `---\n${block}\n---\n\n${content.trim()}\n`;
}

/** Extract the note title: the first `# heading`, else fallback. */
function titleFromContent(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function excerptFromContent(content: string, max = 200): string {
  const body = content.replace(/^#\s+.+$/m, "").trim();
  return body.length > max ? body.slice(0, max).trimEnd() + "..." : body;
}

/** Read a single note file. */
export async function readNote(file: string, folder: string): Promise<Note> {
  const raw = await readFile(file, "utf8");
  const { frontmatter, content, problems } = parseNote(raw);
  const fallback = path.basename(file, ".md");
  return {
    title: titleFromContent(content, fallback),
    folder,
    file,
    frontmatter,
    content,
    problems,
  };
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name);
}

/** Load one folder as lightweight vault entries. */
export async function getNotesByFolder(vaultDir: string, folder: string): Promise<VaultEntry[]> {
  const dir = path.join(vaultDir, folder);
  const names = await listMarkdownFiles(dir);
  const entries: VaultEntry[] = [];
  for (const name of names) {
    const file = path.join(dir, name);
    try {
      const note = await readNote(file, folder);
      entries.push({
        title: note.title,
        folder,
        file,
        name,
        created: note.frontmatter.created,
        tags: note.frontmatter.tags,
        ...(note.frontmatter.url ? { url: note.frontmatter.url } : {}),
        ...(note.problems.length > 0 ? { problems: note.problems } : {}),
        excerpt: excerptFromContent(note.content),
      });
    } catch {
      /* skip unreadable files */
    }
  }
  return entries.sort((a, b) => (a.created < b.created ? 1 : -1));
}

/** Load every folder under the vault. */
export async function listNotes(vaultDir: string): Promise<VaultEntry[]> {
  let dirents: Dirent[];
  try {
    dirents = await readdir(vaultDir, { withFileTypes: true });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const folders = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  const groups = await Promise.all(folders.map((f) => getNotesByFolder(vaultDir, f)));
  return groups.flat().sort((a, b) => (a.created < b.created ? 1 : -1));
}

/** Case-insensitive search across title, content, and tags. */
export async function searchNotes(vaultDir: string, query: string): Promise<VaultEntry[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = await listNotes(vaultDir);
  const results: VaultEntry[] = [];
  for (const entry of all) {
    const haystack = `${entry.title}\n${entry.excerpt}\n${entry.tags.join(" ")}`.toLowerCase();
    let full = haystack;
    if (!haystack.includes(q)) {
      try {
        full = (await readFile(entry.file, "utf8")).toLowerCase();
      } catch {
        full = haystack;
      }
    }
    if (full.includes(q)) results.push(entry);
  }
  return results;
}

/** Frontmatter aliases, which links may resolve to. */
function readAliases(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return [raw];
  return [];
}

/**
 * Assemble the vault's link graph: notes, internal links, tags, and the links
 * whose target does not exist yet. Unreadable files are skipped, as the listings do.
 */
export async function buildVaultGraph(vaultDir: string): Promise<GraphData> {
  const entries = await listNotes(vaultDir);
  const notes: GraphSourceNote[] = [];
  for (const entry of entries) {
    try {
      const note = await readNote(entry.file, entry.folder);
      notes.push({
        id: `${entry.folder}/${entry.name}`,
        title: note.title,
        folder: entry.folder,
        created: note.frontmatter.created,
        tags: note.frontmatter.tags,
        aliases: readAliases(note.frontmatter.aliases),
        content: note.content,
      });
    } catch {
      /* skip unreadable files */
    }
  }
  return buildGraphFromNotes(notes);
}

/** Write a note to the vault, never overwriting an existing file. */
export async function saveNote(
  vaultDir: string,
  input: NoteInput,
): Promise<{ title: string; file: string }> {
  const title = makeTitle(input);
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const dir = path.join(vaultDir, input.folder);
  await mkdir(dir, { recursive: true });

  const frontmatter: Frontmatter = {
    ...defaultFrontmatter("whatsapp"),
    created: now.toISOString(),
    // Hashtags in the message become the note's tags, read with the same rules the graph uses, so a
    // tag in the frontmatter and a tag node in the graph can never be two different things.
    tags: extractTags(input.text),
    ...(input.url ? { url: input.url } : {}),
  };
  const body = [`# ${title}`, "", input.text, input.url ?? ""]
    .filter((l, i) => i < 2 || l)
    .join("\n");
  const content = serializeNote(frontmatter, body);

  const base = `${date}-${slugify(title)}`;
  let file = path.join(dir, `${base}.md`);
  try {
    await writeFile(file, content, { flag: "wx" });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    file = path.join(dir, `${base}-${Date.now()}.md`);
    await writeFile(file, content);
  }
  return { title, file };
}
