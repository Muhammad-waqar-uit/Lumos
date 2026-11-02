import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DAILY_FOLDER, dailyStamp, ensureDailyNote } from "./daily";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function freshVault(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "lumos-daily-"));
  dirs.push(dir);
  return dir;
}

describe("dailyStamp", () => {
  it("pads a local date into YYYY-MM-DD", () => {
    expect(dailyStamp(new Date(2026, 0, 2))).toBe("2026-01-02");
    expect(dailyStamp(new Date(2026, 10, 30))).toBe("2026-11-30");
  });
});

describe("ensureDailyNote", () => {
  it("makes the folder and the note, titled with its date", async () => {
    const vault = await freshVault();

    const { note, created } = await ensureDailyNote(vault, new Date(2026, 0, 2));

    expect(created).toBe(true);
    expect(note.folder).toBe(DAILY_FOLDER);
    expect(path.basename(note.file)).toBe("2026-01-02.md");
    expect(note.title).toBe("2026-01-02");
    expect(note.content).toContain("# 2026-01-02");
    expect(note.frontmatter.source).toBe("desktop");
    expect(await readdir(path.join(vault, DAILY_FOLDER))).toEqual(["2026-01-02.md"]);
  });

  it("opens the file it already wrote instead of making another", async () => {
    const vault = await freshVault();
    const first = await ensureDailyNote(vault, new Date(2026, 0, 2));

    const second = await ensureDailyNote(vault, new Date(2026, 0, 2));

    expect(second.created).toBe(false);
    expect(path.basename(second.note.file)).toBe(path.basename(first.note.file));
    expect(await readdir(path.join(vault, DAILY_FOLDER))).toHaveLength(1);
  });

  it("keeps what was typed into the note after it was made", async () => {
    const vault = await freshVault();
    await ensureDailyNote(vault, new Date(2026, 0, 2));
    const file = path.join(vault, DAILY_FOLDER, "2026-01-02.md");
    const raw = await readFile(file, "utf8");
    await writeFile(file, `${raw}\nA thought added later.\n`);

    const { note } = await ensureDailyNote(vault, new Date(2026, 0, 2));

    expect(note.content).toContain("A thought added later.");
  });

  it("gives each day its own file", async () => {
    const vault = await freshVault();

    const first = await ensureDailyNote(vault, new Date(2026, 0, 2));
    const second = await ensureDailyNote(vault, new Date(2026, 0, 3));

    expect(path.basename(first.note.file)).toBe("2026-01-02.md");
    expect(path.basename(second.note.file)).toBe("2026-01-03.md");
    expect(await readdir(path.join(vault, DAILY_FOLDER))).toHaveLength(2);
  });

  it("refuses a date that is not a date", async () => {
    await expect(ensureDailyNote(await freshVault(), new Date("nope"))).rejects.toThrow(
      /real date/,
    );
  });
});
