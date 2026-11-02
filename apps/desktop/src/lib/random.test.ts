import { describe, expect, it } from "vitest";
import type { VaultEntry } from "@lumos/shared";
import { pickRandomNote } from "./random";

function entry(name: string): VaultEntry {
  return {
    title: name.replace(/\.md$/, ""),
    folder: "Inbox",
    file: `Inbox/${name}`,
    name,
    created: "2026-10-20T09:00:00.000Z",
    tags: [],
    excerpt: "",
  };
}

const NOTES = [entry("a.md"), entry("b.md"), entry("c.md")];

describe("pickRandomNote", () => {
  it("uses the random value it is given instead of a global", () => {
    expect(pickRandomNote(NOTES, null, () => 0)?.name).toBe("a.md");
    expect(pickRandomNote(NOTES, null, () => 0.5)?.name).toBe("b.md");
    expect(pickRandomNote(NOTES, null, () => 0.999)?.name).toBe("c.md");
  });

  it("never picks the note that is already open when there is another choice", () => {
    for (const value of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(pickRandomNote(NOTES, "Inbox/b.md", () => value)?.name).not.toBe("b.md");
    }
  });

  it("still answers when the only note is the one open", () => {
    expect(pickRandomNote([entry("only.md")], "Inbox/only.md", () => 0.4)?.name).toBe("only.md");
  });

  it("clamps a value outside the usual range instead of falling off the list", () => {
    expect(pickRandomNote(NOTES, null, () => 1)?.name).toBe("c.md");
    expect(pickRandomNote(NOTES, null, () => -1)?.name).toBe("a.md");
  });

  it("answers an empty vault with nothing", () => {
    expect(pickRandomNote([], null, () => 0.5)).toBeNull();
  });
});
