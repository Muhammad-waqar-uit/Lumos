import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NoteFileError, readNote, saveNote } from "./index";
import { copyTitle, duplicateNote } from "./duplicate";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function freshVault(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "lumos-copy-"));
  dirs.push(dir);
  return dir;
}

describe("copyTitle", () => {
  it("names the copy after the original", () => {
    expect(copyTitle("Morning walk")).toBe("Morning walk (copy)");
    expect(copyTitle("  ")).toBe("note (copy)");
  });
});

describe("duplicateNote", () => {
  it("copies the body once, with the tags and status the note carried", async () => {
    const vault = await freshVault();
    const { file } = await saveNote(
      vault,
      { folder: "Ideas", text: "a thought #idea\n\nwith a second line" },
      { source: "desktop" },
    );
    const name = path.basename(file);

    const copy = await duplicateNote(vault, { folder: "Ideas", name });

    expect(copy.title).toBe("a thought #idea (copy)");
    expect(copy.folder).toBe("Ideas");
    expect(copy.frontmatter.tags).toEqual(["idea"]);
    expect(copy.frontmatter.source).toBe("desktop");
    expect(copy.content.match(/^#\s+/gm)).toHaveLength(1);
    expect(copy.content).toContain("with a second line");
  });

  it("never touches the original, and gives the copy its own file", async () => {
    const vault = await freshVault();
    const { file } = await saveNote(vault, { folder: "Ideas", text: "one" }, { source: "desktop" });
    const name = path.basename(file);

    await duplicateNote(vault, { folder: "Ideas", name });

    expect(await readdir(path.join(vault, "Ideas"))).toHaveLength(2);
    expect((await readNote(file, "Ideas")).title).toBe("one");
    expect((await readNote(file, "Ideas")).content).not.toContain("(copy)");
  });

  it("refuses a note that is not there", async () => {
    const vault = await freshVault();
    await expect(
      duplicateNote(vault, { folder: "Ideas", name: "2026-01-01-gone.md" }),
    ).rejects.toMatchObject({ reason: "missing" });
  });

  it("refuses a name that could leave the folder", async () => {
    const vault = await freshVault();
    await expect(
      duplicateNote(vault, { folder: "Ideas", name: "../secrets.md" }),
    ).rejects.toBeInstanceOf(NoteFileError);
  });
});
