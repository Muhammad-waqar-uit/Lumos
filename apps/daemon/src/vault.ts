import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NoteInput } from "./commands.js";

const VAULT = process.env.VAULT_PATH ?? path.resolve(process.cwd(), "../../vault");

function makeTitle({ text, url }: NoteInput): string {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine) return firstLine.length > 60 ? firstLine.slice(0, 57) + "..." : firstLine;
  if (url) return new URL(url).hostname;
  return "Untitled";
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "note";
}

export async function saveNote(input: NoteInput) {
  const title = makeTitle(input);
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const dir = path.join(VAULT, input.folder);
  await mkdir(dir, { recursive: true });

  const frontmatter = [
    "---",
    "source: whatsapp",
    `created: ${now.toISOString()}`,
    "tags: []",
    "status: new",
    ...(input.url ? [`url: ${input.url}`] : []),
    "---",
  ].join("\n");

  const body = [`# ${title}`, "", input.text, input.url ?? ""].filter((l, i) => i < 2 || l).join("\n");
  const content = `${frontmatter}\n\n${body}\n`;

  const base = `${date}-${slugify(title)}`;
  let file = path.join(dir, `${base}.md`);
  try {
    await writeFile(file, content, { flag: "wx" });
  } catch (err: any) {
    if (err.code !== "EEXIST") throw err;
    file = path.join(dir, `${base}-${Date.now()}.md`);
    await writeFile(file, content);
  }
  return { title, file };
}
