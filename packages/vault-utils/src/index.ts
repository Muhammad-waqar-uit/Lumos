/**
 * @lumos/vault-utils - read, list, search, parse, and write the Lumos Markdown vault.
 */
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type {
  Frontmatter,
  GraphData,
  GraphSourceNote,
  Note,
  NoteInput,
  NoteSource,
  VaultEntry,
} from "@lumos/shared";
import { buildGraphFromNotes, extractTags, linkResolver, rewriteLinks } from "./graph";
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

/**
 * Index just past the closing `---` of a frontmatter block, or null when there is no block.
 *
 * The same rule `parseNote` reads with, so a file is edited exactly as it is displayed.
 */
function frontmatterClose(text: string): number | null {
  if (!text.startsWith("---")) return null;
  const close = text.indexOf("\n---", 3);
  // + 1 for the newline and + 3 for the dashes themselves.
  return close === -1 ? null : close + 4;
}

/**
 * Replace a note file's body, returning the whole file, with the frontmatter block left exactly as
 * it was written.
 *
 * The block is deliberately not re-serialized. A hand-edited note may carry an invalid block, a
 * comment, an ordering or keys another tool owns, and saving the body must not repair, reorder or
 * drop any of it - the reader reports those problems rather than hiding the note, and the editor
 * has no business rewriting them behind the user's back.
 */
export function replaceNoteBody(raw: string, content: string): string {
  const text = raw.replace(/^\uFEFF/, "");
  const body = content.trim();
  const close = frontmatterClose(text);
  if (close === null) return body ? `${body}\n` : "";
  const block = text.slice(0, close).trimEnd();
  return body ? `${block}\n\n${body}\n` : `${block}\n`;
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

/** Build a Note from a file's text and where it lives. */
function noteFromRaw(raw: string, file: string, folder: string): Note {
  const { frontmatter, content, problems } = parseNote(raw);
  return {
    title: titleFromContent(content, path.basename(file, ".md")),
    folder,
    file,
    frontmatter,
    content,
    problems,
  };
}

/** Read a single note file. */
export async function readNote(file: string, folder: string): Promise<Note> {
  return noteFromRaw(await readFile(file, "utf8"), file, folder);
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

/** A note as the vault holds it: where it lives, its parsed form, and its text as written. */
interface VaultNote {
  folder: string;
  name: string;
  file: string;
  note: Note;
  raw: string;
}

/**
 * Every readable note in the vault, with its raw text.
 *
 * The graph and a rename both need more than a listing - titles, aliases, bodies - and both skip a
 * file they cannot read rather than failing the whole answer.
 */
async function readVaultNotes(vaultDir: string): Promise<VaultNote[]> {
  let dirents: Dirent[];
  try {
    dirents = await readdir(vaultDir, { withFileTypes: true });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const notes: VaultNote[] = [];
  for (const dirent of dirents.filter((d) => d.isDirectory())) {
    const folder = dirent.name;
    const dir = path.join(vaultDir, folder);
    for (const name of await listMarkdownFiles(dir)) {
      const file = path.join(dir, name);
      try {
        const raw = await readFile(file, "utf8");
        notes.push({ folder, name, file, note: noteFromRaw(raw, file, folder), raw });
      } catch {
        /* skip unreadable files */
      }
    }
  }
  return notes;
}

/**
 * Assemble the vault's link graph: notes, internal links, tags, and the links
 * whose target does not exist yet. Unreadable files are skipped, as the listings do.
 */
export async function buildVaultGraph(vaultDir: string): Promise<GraphData> {
  const notes = await readVaultNotes(vaultDir);
  const sources: GraphSourceNote[] = notes.map(({ folder, name, note }) => ({
    id: `${folder}/${name}`,
    title: note.title,
    folder,
    created: note.frontmatter.created,
    tags: note.frontmatter.tags,
    aliases: readAliases(note.frontmatter.aliases),
    content: note.content,
  }));
  return buildGraphFromNotes(sources);
}

/** A note as the operations address it: the folder it is filed in and its filename. */
export interface NoteRef {
  folder: string;
  name: string;
}

/** Why a path was refused, so a route can answer `400`, `404` or `409` instead of a `500`. */
export type NoteFileProblem = "unsafe" | "missing" | "exists";

/** A vault operation refusing a request. The message is written for the person who asked. */
export class NoteFileError extends Error {
  readonly reason: NoteFileProblem;

  constructor(reason: NoteFileProblem, message: string) {
    super(message);
    this.name = "NoteFileError";
    this.reason = reason;
  }
}

/**
 * Resolve a folder + filename inside the vault, refusing anything that escapes it.
 *
 * Both halves arrive untrusted, so the resolved path is checked against the vault root twice - once
 * per segment. A write is the one place a bad name destroys data, so the check lives here rather
 * than only in the route that happens to call it.
 */
function noteFile(vaultDir: string, { folder, name }: NoteRef): string {
  const root = path.resolve(vaultDir);
  const dir = path.resolve(root, folder);
  const file = path.resolve(dir, name);
  const inside = (base: string, target: string): boolean => target.startsWith(`${base}${path.sep}`);

  if (!inside(root, dir)) throw new NoteFileError("unsafe", "folder escapes the vault");
  if (!name.endsWith(".md") || !inside(dir, file))
    throw new NoteFileError("unsafe", "name escapes the folder");
  return file;
}

/** Re-throw a missing file as the answer a caller can act on, and anything else as it came. */
function missingNote(err: unknown): never {
  if ((err as NodeJS.ErrnoException).code === "ENOENT")
    throw new NoteFileError("missing", "note not found");
  throw err;
}

/**
 * Write a note in one step: a temporary file in the same folder, renamed over the target.
 *
 * The suffix keeps the temporary name out of every listing, because they all filter on `.md`. A
 * failure part-way leaves the old note intact instead of truncated.
 */
async function writeNoteFile(file: string, content: string): Promise<void> {
  const temp = `${file}.${process.pid}-${Date.now()}.tmp`;
  try {
    await writeFile(temp, content, { encoding: "utf8", flag: "wx" });
    await rename(temp, file);
  } catch (err: unknown) {
    // The failure that brought us here is the one worth reporting; a leftover temporary file cannot
    // be mistaken for a note, because its name does not end in `.md`.
    await rm(temp, { force: true }).catch(() => undefined);
    throw err;
  }
}

/**
 * Move a note file to a new path without ever overwriting what is already there.
 *
 * `rename()` would replace the target silently, and a note replaced by another note is data loss
 * with nothing to show for it - so the new file is created exclusively and the old one removed
 * afterwards. If the removal fails the copy is taken back out again, leaving the vault as it was.
 */
async function relocate(from: string, to: string, content: string): Promise<void> {
  await mkdir(path.dirname(to), { recursive: true });
  try {
    await writeFile(to, content, { encoding: "utf8", flag: "wx" });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST")
      throw new NoteFileError("exists", "a note with that name already exists");
    throw err;
  }
  try {
    await rm(from);
  } catch (err: unknown) {
    await rm(to, { force: true }).catch(() => undefined);
    throw err;
  }
}

/**
 * Save a new body into an existing note.
 *
 * Only the body is replaced; the frontmatter block is left exactly as the file has it.
 */
export async function updateNote(
  vaultDir: string,
  input: { folder: string; name: string; content: string },
): Promise<Note> {
  const file = noteFile(vaultDir, input);
  const raw = await readFile(file, "utf8");
  await writeNoteFile(file, replaceNoteBody(raw, input.content));
  return readNote(file, input.folder);
}

/**
 * Move a note into another folder, keeping its filename and its bytes.
 *
 * Moving a note to the folder it already sits in changes nothing and answers the note; the caller
 * does not have to know which folder it was in.
 */
export async function moveNote(
  vaultDir: string,
  input: { from: NoteRef; to: NoteRef },
): Promise<Note> {
  const from = noteFile(vaultDir, input.from);
  const to = noteFile(vaultDir, input.to);
  if (from === to) return readNote(from, input.to.folder);

  const raw = await readFile(from, "utf8").catch(missingNote);
  await relocate(from, to, raw);
  return readNote(to, input.to.folder);
}

/** The `YYYY-MM-DD-` prefix a vault filename carries, so a renamed note keeps its date. */
function datePrefixOf(name: string): string {
  return /^\d{4}-\d{2}-\d{2}-/.test(name) ? name.slice(0, 11) : "";
}

/**
 * Replace the heading that gives a note its title.
 *
 * Only the body is searched, so a `#` line in the frontmatter block is a YAML comment and stays one.
 */
function retitleBody(content: string, title: string): string {
  return content.replace(/^#\s+.+$/m, `# ${title}`);
}

/** A note file whose text changed, ready to be written. */
interface LinkEdit {
  /** Vault id: `Folder/name.md`. */
  id: string;
  file: string;
  text: string;
}

/**
 * The edits a rename needs so the links that point at the note still do.
 *
 * The resolver is built over the vault as it is *before* the rename, which is the only state in which
 * "this link points at that note" is still true - afterwards the old title resolves to nothing. A
 * link that resolves elsewhere, or not at all, is left alone, so a note that merely shares the old
 * title is not edited by someone else's rename.
 *
 * A link keeps the shape it was written in: `[[Learn Rust]]` becomes a new title, while
 * `[[2026-10-20-learn-rust.md]]` becomes the new filename, because that is what the author chose.
 */
async function linkEdits(
  vaultDir: string,
  renamedId: string,
  next: { name: string; title: string },
): Promise<LinkEdit[]> {
  const notes = await readVaultNotes(vaultDir);
  const sources = notes.map(({ folder, name, note }) => ({
    id: `${folder}/${name}`,
    title: note.title,
    folder,
    created: note.frontmatter.created,
    tags: note.frontmatter.tags,
    aliases: readAliases(note.frontmatter.aliases),
    content: note.content,
  }));
  const before = linkResolver(sources);
  // The vault as it will be: this note under its new name and title, everything else unchanged.
  const newId = `${renamedId.slice(0, renamedId.lastIndexOf("/") + 1)}${next.name}`;
  const after = linkResolver(
    sources.map((source) =>
      source.id === renamedId ? { ...source, id: newId, title: next.title } : source,
    ),
  );

  const replacement = (raw: string): string | null => {
    // A link that still reaches the note afterwards - an alias, say - is the author's wording, not
    // a stale title, so only a target this rename actually strands is rewritten.
    if (before(raw) !== renamedId || after(raw) === newId) return null;
    const target = raw.trim();
    const slash = Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\"));
    const prefix = slash === -1 ? "" : target.slice(0, slash + 1);
    const base = slash === -1 ? target : target.slice(slash + 1);
    return `${prefix}${/\.md$/i.test(base) ? next.name : next.title}`;
  };

  const edits: LinkEdit[] = [];
  for (const { folder, name, file, raw } of notes) {
    const id = `${folder}/${name}`;
    // A note is not its own neighbour, and its own text is being replaced anyway.
    if (id === renamedId) continue;
    const close = frontmatterClose(raw);
    const head = close === null ? "" : raw.slice(0, close);
    const { text, count } = rewriteLinks(close === null ? raw : raw.slice(close), replacement);
    // Only the body is rewritten, and only when something in it actually pointed here.
    if (count > 0) edits.push({ id, file, text: head + text });
  }
  return edits;
}

/** What a rename changed: the note as it now reads, and whose links followed it. */
export interface NoteRename {
  note: Note;
  /** Vault ids (`Folder/name.md`) of the notes whose links were rewritten to the new title. */
  updated: string[];
}

/**
 * Rename a note to a new title, and carry the links that point at it.
 *
 * The title is the note's, not its filename's: the file is renamed to `<date>-<new slug>.md` and
 * the body's first heading is rewritten to match, so the list, the viewer and the file's name all
 * say the same thing afterwards. A note with no heading has no title of its own - it falls back to
 * the filename - so only the filename changes.
 *
 * Every other note whose body links to this one is edited too, because a link resolves by title: a
 * rename that left them behind would quietly break every backlink in the vault. The files changed
 * are answered as `updated`, so the caller can say what happened rather than guess.
 *
 * Two notes can legitimately want one filename (the same title, the same day). That collision is
 * refused rather than resolved by a timestamp suffix: the person renaming is right there, and a
 * silent `-1758…` in their note's name is not what they asked for.
 */
export async function renameNote(
  vaultDir: string,
  input: { folder: string; name: string; title: string },
): Promise<NoteRename> {
  const title = input.title.trim();
  if (!title) throw new NoteFileError("unsafe", "a title is required");

  const from = noteFile(vaultDir, input);
  const name = `${datePrefixOf(input.name)}${slugify(title)}.md`;
  const to = noteFile(vaultDir, { folder: input.folder, name });

  const raw = await readFile(from, "utf8").catch(missingNote);
  const parsed = parseNote(raw);
  const next = replaceNoteBody(raw, retitleBody(parsed.content, title));
  const oldTitle = titleFromContent(parsed.content, path.basename(input.name, ".md"));

  // Read before the rename: a link points at the old title only while that title is the note's.
  // A title that did not change leaves every link resolving exactly as it did.
  const edits =
    oldTitle === title
      ? []
      : await linkEdits(vaultDir, `${input.folder}/${input.name}`, { name, title });

  if (to === from) await writeNoteFile(from, next);
  else await relocate(from, to, next);
  for (const edit of edits) await writeNoteFile(edit.file, edit.text);

  return { note: await readNote(to, input.folder), updated: edits.map((edit) => edit.id) };
}

/**
 * Delete a note file.
 *
 * There is no trash and no undo: the file is gone from the vault, which is the point of a delete
 * and the reason the app asks twice before it sends one. The path is checked first, so a request
 * cannot remove a file outside the folder it named.
 */
export async function deleteNote(vaultDir: string, ref: NoteRef): Promise<void> {
  await rm(noteFile(vaultDir, ref)).catch(missingNote);
}

/**
 * Write a note to the vault, never overwriting an existing file.
 *
 * `source` records where the note came from, because it is shown to the person reading it: WhatsApp
 * capture writes `whatsapp` (the default, so the capture path is unchanged) and the desktop writes
 * `desktop`. A note that claims the wrong origin is worse than one that says nothing.
 */
export async function saveNote(
  vaultDir: string,
  input: NoteInput,
  options: { source?: NoteSource } = {},
): Promise<{ title: string; file: string }> {
  const title = makeTitle(input);
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const dir = path.join(vaultDir, input.folder);
  await mkdir(dir, { recursive: true });

  const frontmatter: Frontmatter = {
    ...defaultFrontmatter(options.source ?? "whatsapp"),
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
