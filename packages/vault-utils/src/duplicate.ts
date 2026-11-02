import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Note } from "@lumos/shared";
import { NoteFileError, defaultFrontmatter, readNote, serializeNote } from "./index";
import { slugify } from "./slug";

/** The title a copy gets: the original's, plus the word that says it is one. */
export function copyTitle(title: string): string {
  const base = title.trim() || "note";
  return `${base} (copy)`;
}

/**
 * Copy a note beside itself.
 *
 * The copy keeps what the note says and where it belongs: the body minus its own heading, the tags,
 * the status and the link, with a fresh `created` and the desktop as its source. The heading is
 * rebuilt from the new title, so a copy is titled `<title> (copy)` rather than carrying two
 * headings and no way to tell them apart in the list.
 *
 * The filename follows the vault's own rule - date, then slug - and a copy made on a day the title
 * was already used gets a timestamp suffix instead of overwriting anything. The original is only
 * ever read.
 */
export async function duplicateNote(
  vaultDir: string,
  ref: { folder: string; name: string },
): Promise<Note> {
  if (
    !ref.name.endsWith(".md") ||
    ref.name.includes("/") ||
    ref.name.includes("\\") ||
    ref.name.includes("..")
  ) {
    throw new NoteFileError("unsafe", "invalid note name");
  }

  const source = path.join(vaultDir, ref.folder, ref.name);
  let original: Note;
  try {
    original = await readNote(source, ref.folder);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NoteFileError("missing", `there is no note at ${ref.folder}/${ref.name}`);
    }
    throw err;
  }

  const now = new Date();
  const title = copyTitle(original.title);
  const body = original.content.replace(/^#\s+.+$/m, "").trim();
  const frontmatter = {
    ...defaultFrontmatter("desktop"),
    created: now.toISOString(),
    tags: [...original.frontmatter.tags],
    status: original.frontmatter.status,
    ...(original.frontmatter.url ? { url: original.frontmatter.url } : {}),
  };
  const content = serializeNote(frontmatter, [`# ${title}`, "", body].join("\n"));

  const dir = path.join(vaultDir, ref.folder);
  await mkdir(dir, { recursive: true });
  const base = `${now.toISOString().slice(0, 10)}-${slugify(title)}`;
  let file = path.join(dir, `${base}.md`);
  try {
    await writeFile(file, content, { flag: "wx" });
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    // A second copy of one title on one day: distinct files, never an overwrite.
    file = path.join(dir, `${base}-${Date.now()}.md`);
    await writeFile(file, content);
  }

  return readNote(file, ref.folder);
}
