import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Note } from "@lumos/shared";
import { defaultFrontmatter, readNote, serializeNote } from "./index";

/** The folder a daily note lives in. One folder, so the year's entries sort together. */
export const DAILY_FOLDER = "Daily";

/**
 * The local calendar date as `YYYY-MM-DD`.
 *
 * Local parts rather than `toISOString().slice(0, 10)`: the note belongs to the day the person is
 * having, and an evening in one timezone must not be filed under tomorrow in another.
 */
export function dailyStamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Today's note: opened if it exists, written if it does not.
 *
 * The filename is the date and nothing else, so the same day always resolves to one file - asking
 * twice cannot fill the folder with near-duplicates. An existing file is read and returned
 * untouched, which is what makes this safe to run from a command: it opens what was written there,
 * including anything typed into it since.
 *
 * The creation uses `wx`, so two requests arriving together cannot both write; the loser reads the
 * winner's file. `created` says which one this call was, and the route turns that into `201`/`200`.
 */
export async function ensureDailyNote(
  vaultDir: string,
  date: Date = new Date(),
): Promise<{ note: Note; created: boolean }> {
  if (Number.isNaN(date.getTime())) throw new Error("a daily note needs a real date");

  const stamp = dailyStamp(date);
  const folder = DAILY_FOLDER;
  const file = join(vaultDir, folder, `${stamp}.md`);

  try {
    await readFile(file, "utf8");
    return { note: await readNote(file, folder), created: false };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  await mkdir(join(vaultDir, folder), { recursive: true });
  const frontmatter = { ...defaultFrontmatter("desktop"), created: date.toISOString() };
  let created = true;
  try {
    await writeFile(file, serializeNote(frontmatter, `# ${stamp}`), { flag: "wx" });
  } catch (err: unknown) {
    // Another request for the same day won the write. Its file is the answer, not an error.
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    created = false;
  }

  return { note: await readNote(file, folder), created };
}
